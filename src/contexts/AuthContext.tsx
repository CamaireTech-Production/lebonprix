import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { 
  User as FirebaseUser, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  updatePassword
} from 'firebase/auth';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import type { Company, UserRole, UserCompanyRef, CompanyEmployee } from '../types/models';
import { ensureDefaultFinanceEntryTypes } from '../services/firestore';
import CompanyManager from '../services/storage/CompanyManager';
import FinanceTypesManager from '../services/storage/FinanceTypesManager';
import BackgroundSyncService from '../services/backgroundSync';
import { saveCompanyToCache, getCompanyFromCache, clearCompanyCache } from '../utils/companyCache';
import { getUserById, updateUserLastLogin, createUser } from '../services/userService';
import { saveUserSession, getUserSession, clearUserSession, updateUserSessionCompanies } from '../utils/userSession';

interface AuthContextType {
  user: FirebaseUser | null;
  currentUser: FirebaseUser | null; // For backward compatibility
  company: Company | null;
  loading: boolean;
  companyLoading: boolean; // New: indicates if company data is still loading in background
  effectiveRole: UserRole | 'owner' | 'vendeur' | 'gestionnaire' | 'magasinier' | null; // Role effectif de l'utilisateur
  isOwner: boolean; // Si l'utilisateur est propriétaire de l'entreprise
  currentEmployee: CompanyEmployee | null; // Informations de l'employé connecté
  userCompanies: UserCompanyRef[]; // Liste des entreprises de l'utilisateur
  selectedCompanyId: string | null; // Entreprise actuellement sélectionnée
  signUp: (email: string, password: string, companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) => Promise<FirebaseUser>;
  signIn: (email: string, password: string) => Promise<FirebaseUser>;
  signOut: () => Promise<void>;
  updateCompany: (data: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>>) => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  selectCompany: (companyId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [effectiveRole, setEffectiveRole] = useState<UserRole | 'owner' | 'vendeur' | 'gestionnaire' | 'magasinier' | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<CompanyEmployee | null>(null);
  const [userCompanies, setUserCompanies] = useState<UserCompanyRef[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const isInitialLoginRef = useRef(false);
  const isSigningInRef = useRef(false); // Track if signIn is in progress to prevent duplicate clicks

  // Mémoriser les informations de la compagnie pour les restaurer lors de la reconnexion
  const memoizedCompany = useMemo(() => {
    if (company) {
      // Sauvegarder les informations de la compagnie dans le cache
      saveCompanyToCache(company);
      return company;
    }
    
    // Essayer de restaurer depuis le cache si pas de compagnie en mémoire
    const cachedCompany = getCompanyFromCache();
    if (cachedCompany) {
      return cachedCompany;
    }
    
    return null;
  }, [company]);

  // Check localStorage session on mount and validate against Firebase
  useEffect(() => {
    const session = getUserSession();
    if (session) {
      console.log('🔍 Found active session in localStorage, checking Firebase auth state...');
      
      // Check if Firebase auth state matches localStorage session
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== session.userId) {
        console.log('⚠️ Session mismatch: Firebase auth state does not match localStorage session');
        console.log('🧹 Clearing invalid session from localStorage');
        clearUserSession();
      } else {
        console.log('✅ Session validated: Firebase auth matches localStorage session');
      }
    }
    // Let onAuthStateChanged handle the actual auth check and routing
  }, []);

  // NOTE: placed after function declarations to avoid "cannot access before initialization"
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔥 Auth state changed:', user ? `User logged in: ${user.uid}` : 'User logged out');
      console.log('🔥 isInitialLoginRef.current:', isInitialLoginRef.current);
      
      // Reset signing in flag when auth state changes
      isSigningInRef.current = false;
      
      setUser(user);
      
      if (user) {
        // 🚀 IMMEDIATE UI RENDER: Set loading to false right away
        console.log('✅ User authenticated - rendering UI immediately');
        setLoading(false);
        
        // 🚀 RESTORE COMPANY FROM CACHE: Try to restore company data immediately
        const cachedCompany = getCompanyFromCache();
        if (cachedCompany) {
          setCompany(cachedCompany);
          console.log('🚀 Company restored from cache:', cachedCompany.name);
          
          // Déterminer le rôle immédiatement si on a les données
          determineUserRole(cachedCompany, user.uid);
        }
        
        // 🔄 BACKGROUND LOADING: Start user and company data fetch in background
        console.log('🔄 Starting background user and company data loading...');
        console.log('🔄 User ID for background loading:', user.uid);
        
        // Ensure the background loading happens
        try {
          await loadUserAndCompanyDataInBackground(user.uid);
        } catch (error) {
          console.error('❌ Error in background loading:', error);
        }
        
        // 🔄 BACKGROUND LOADING: Start finance types in background
        console.log('🔄 Starting background finance types loading...');
        loadFinanceTypesInBackground();
        
      } else {
        setCompany(null);
        setEffectiveRole(null);
        setIsOwner(false);
        setCurrentEmployee(null);
        setLoading(false);
        // Nettoyer le cache lors de la déconnexion
        clearCompanyCache();
        clearUserSession();
      }
    });

    return unsubscribe;
  }, []);

  // 🔄 Migration automatique d'un utilisateur vers le nouveau système
  const migrateUserToNewSystem = async (userId: string) => {
    try {
      console.log(`🔄 Migration de l'utilisateur ${userId} vers le nouveau système...`);
      
      // Récupérer les données Firebase Auth
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error('Utilisateur Firebase non trouvé');
      }
      
      // Créer l'utilisateur dans le nouveau système
      await createUser(userId, {
        firstname: firebaseUser.displayName?.split(' ')[0] || 'Utilisateur',
        lastname: firebaseUser.displayName?.split(' ').slice(1).join(' ') || 'Anonyme',
        email: firebaseUser.email || '',
        phone: firebaseUser.phoneNumber || undefined,
        photoURL: firebaseUser.photoURL || undefined
      });
      
      console.log(`✅ Utilisateur ${userId} migré vers le nouveau système`);
      
    } catch (error) {
      console.error('❌ Erreur lors de la migration de l\'utilisateur:', error);
      throw error;
    }
  };

  // 🚀 INSTANT user and company data loading from localStorage with background sync
  const loadUserAndCompanyDataInBackground = async (userId: string) => {
    console.log('🔄 loadUserAndCompanyDataInBackground called for user:', userId);
    console.log('🔄 isInitialLoginRef.current at start:', isInitialLoginRef.current);
    setCompanyLoading(true);
    
    try {
      // 1. Charger les données utilisateur depuis le système unifié
      console.log('📡 Fetching user data for:', userId);
      const userData = await getUserById(userId);
      console.log('📡 getUserById result:', userData ? `Found user with ${userData.companies?.length || 0} companies` : 'User not found');
      console.log('📡 Full userData:', userData);
      
      if (userData) {
        setUserCompanies(userData.companies || []);
        console.log(`✅ Utilisateur chargé avec ${userData.companies?.length || 0} entreprises`);
        
        // 💾 Save user session to localStorage
        const currentUser = auth.currentUser;
        if (currentUser) {
          saveUserSession(
            userId,
            currentUser.email || userData.email,
            userData.companies?.map(c => ({
              companyId: c.companyId,
              name: c.name,
              role: c.role
            }))
          );
        }
        
        // Mettre à jour la dernière connexion
        await updateUserLastLogin(userId);
        
        // 2. Handle routing based on user's companies
        console.log(`📺 Checking if initial login routing needed...`);
        console.log(`📺 isInitialLoginRef.current:`, isInitialLoginRef.current);
        
        if (isInitialLoginRef.current) {
          console.log(`📺 Handling initial login routing...`);
          
          if (userData.companies && userData.companies.length > 0) {
            // User has companies - auto-select and go to dashboard
            console.log(`✅ User has ${userData.companies.length} companies, auto-selecting...`);
            console.log(`✅ Companies:`, userData.companies);
            
            // Find first company where user is owner or admin
            const ownerOrAdminCompany = userData.companies.find((company: UserCompanyRef) => 
              company.role === 'owner' || company.role === 'admin'
            );
            
            console.log(`🔍 Owner/Admin company found:`, ownerOrAdminCompany);
            
            if (ownerOrAdminCompany) {
              console.log(`🏢 Auto-selecting company: ${ownerOrAdminCompany.name} (ID: ${ownerOrAdminCompany.companyId})`);
              console.log(`🚀 Navigating to: /company/${ownerOrAdminCompany.companyId}/dashboard`);
              navigate(`/company/${ownerOrAdminCompany.companyId}/dashboard`);
            } else {
              // User is only employee - show company selection
              console.log(`👥 User is employee only, showing company selection`);
              console.log(`🚀 Navigating to: /companies/me/${userId}`);
              navigate(`/companies/me/${userId}`);
            }
          } else {
            // User has no companies - show mode selection
            console.log(`🆕 User has no companies, showing mode selection`);
            console.log(`🚀 Navigating to: /mode-selection`);
            navigate('/mode-selection');
          }
          
          console.log(`🔄 Resetting isInitialLoginRef.current to false`);
          isInitialLoginRef.current = false; // Reset après redirection
        } else {
          console.log(`📺 Not initial login, skipping routing`);
          
          // Still save session even if not initial login (for page refresh scenarios)
          const currentUser = auth.currentUser;
          if (currentUser) {
            saveUserSession(
              userId,
              currentUser.email || userData.email,
              userData.companies?.map(c => ({
                companyId: c.companyId,
                name: c.name,
                role: c.role
              }))
            );
          }
        }
      } else {
        console.log('⚠️ Utilisateur non trouvé dans le système unifié');
        // Créer l'utilisateur dans le nouveau système s'il n'existe pas
        await migrateUserToNewSystem(userId);
        // Puis recharger les données
        const userData = await getUserById(userId);
        if (userData) {
          setUserCompanies(userData.companies || []);
          console.log(`✅ Utilisateur migré avec ${userData.companies?.length || 0} entreprises`);
          // Handle routing after migration
          if (isInitialLoginRef.current) {
            console.log(`📺 Handling routing after migration...`);
            
            if (userData.companies && userData.companies.length > 0) {
              // User has companies - auto-select and go to dashboard
              console.log(`✅ Migrated user has ${userData.companies.length} companies, auto-selecting...`);
              
              // Find first company where user is owner or admin
              const ownerOrAdminCompany = userData.companies.find((company: UserCompanyRef) => 
                company.role === 'owner' || company.role === 'admin'
              );
              
              if (ownerOrAdminCompany) {
                console.log(`🏢 Auto-selecting company: ${ownerOrAdminCompany.name}`);
                navigate(`/company/${ownerOrAdminCompany.companyId}/dashboard`);
              } else {
                // User is only employee - show company selection
                console.log(`👥 Migrated user is employee only, showing company selection`);
                navigate(`/companies/me/${userId}`);
              }
            } else {
              // User has no companies - show mode selection
              console.log(`🆕 Migrated user has no companies, showing mode selection`);
              navigate('/mode-selection');
            }
            
            isInitialLoginRef.current = false; // Reset après redirection
          }
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des données utilisateur:', error);
      // Fallback vers l'ancien système
      await loadCompanyDataLegacy(userId);
    } finally {
      setCompanyLoading(false);
    }
  };

  // Fallback vers l'ancien système
  const loadCompanyDataLegacy = async (userId: string) => {
    // 1. INSTANT LOAD: Check localStorage first
    const localCompany = CompanyManager.load(userId);
    if (localCompany) {
      // Check if color fields are missing (for backward compatibility)
      const hasColorFields = localCompany.primaryColor !== undefined || 
                            localCompany.secondaryColor !== undefined || 
                            localCompany.tertiaryColor !== undefined;
      
      if (!hasColorFields) {
        console.log('🔄 Color fields missing from cache, forcing refresh...');
        // Force a fresh fetch from Firebase
        CompanyManager.remove(userId);
      } else {
        setCompany(localCompany);
        setCompanyLoading(false);
        console.log('🚀 Company data loaded instantly from localStorage');
        
        // 2. BACKGROUND SYNC: Update localStorage if needed
        BackgroundSyncService.syncCompany(userId, (freshCompany) => {
          setCompany(freshCompany);
          console.log('🔄 Company data updated from background sync');
        });
        return;
      }
    }
    
    // 3. FALLBACK: No localStorage data, fetch from Firebase
    try {
      console.log('📡 No cached company data, fetching from Firebase...');
      
      const companyDoc = await getDoc(doc(db, 'companies', userId));
      
      if (companyDoc.exists()) {
        const companyData = { id: companyDoc.id, ...companyDoc.data() } as Company;
        setCompany(companyData);
        
        // Déterminer le rôle effectif et ownership
        determineUserRole(companyData, userId);
        
        // Save to localStorage for future instant loads
        CompanyManager.save(userId, companyData);
        
        // Mettre à jour le cache global
        saveCompanyToCache(companyData);
        console.log('✅ Company data loaded from Firebase and cached to localStorage');
      } else {
        console.log('⚠️ No company document found for user');
      }
    } catch (error) {
      console.error('❌ Company loading failed:', error);
    } finally {
      setCompanyLoading(false);
    }
  };

  // Charger les données d'une entreprise spécifique
  const loadCompanyData = async (companyId: string, userId: string) => {
    try {
      console.log(`📡 Chargement de l'entreprise ${companyId}...`);
      
      const companyDoc = await getDoc(doc(db, 'companies', companyId));
      
      if (companyDoc.exists()) {
        const companyData = { id: companyDoc.id, ...companyDoc.data() } as Company;
        setCompany(companyData);
        
        // Déterminer le rôle effectif et ownership
        determineUserRole(companyData, userId);
        
        // Save to localStorage for future instant loads
        CompanyManager.save(userId, companyData);
        
        // Mettre à jour le cache global
        saveCompanyToCache(companyData);
        console.log(`✅ Entreprise ${companyData.name} chargée avec succès`);
      } else {
        console.log(`⚠️ Entreprise ${companyId} non trouvée`);
      }
    } catch (error) {
      console.error(`❌ Erreur lors du chargement de l'entreprise ${companyId}:`, error);
    }
  };

  // Déterminer le rôle effectif de l'utilisateur
  const determineUserRole = async (companyData: Company, userId: string) => {
    try {
      // 1. Vérifier si l'utilisateur est propriétaire de l'entreprise (nouveau système)
      // CORRECTED: Check userId field (owner reference) instead of companyId
      const isCompanyOwner = companyData.userId === userId;
      setIsOwner(isCompanyOwner);
      
      if (isCompanyOwner) {
        setEffectiveRole('owner');
        console.log('✅ User is company owner (new system)');
        return;
      }
      
      // 2. Check users[].companies[] for employee roles (new system)
      const userDocForRole = await getDoc(doc(db, 'users', userId));
      if (userDocForRole.exists()) {
        const userData = userDocForRole.data();
        const userCompanyRef = userData.companies?.find((c: UserCompanyRef) => c.companyId === companyData.id);
        
        if (userCompanyRef) {
          // Map the role from users[].companies[] to UI role
          const roleMapping: Record<string, string> = {
            'staff': 'vendeur',
            'manager': 'gestionnaire',
            'admin': 'magasinier',
            'owner': 'owner'
          };
          
          const uiRole = roleMapping[userCompanyRef.role] || userCompanyRef.role;
          setEffectiveRole(uiRole as UserRole | 'owner' | 'vendeur' | 'gestionnaire' | 'magasinier');
          console.log('✅ Employee role determined from users[].companies[]:', userCompanyRef.role, '-> UI role:', uiRole);
          return;
        }
      }
      
      // 3. Fallback vers l'ancien système - vérifier si c'est un employé
      const employee = companyData.employees ? 
        Object.values(companyData.employees).find(emp => emp.firebaseUid === userId) : null;
      
      if (employee) {
        // Mapper le rôle employé vers le rôle UI
        const roleMapping: Record<string, string> = {
          'staff': 'vendeur',
          'manager': 'gestionnaire', 
          'admin': 'magasinier',
          'owner': 'owner'
        };
        setEffectiveRole(roleMapping[employee.role] as UserRole | 'owner' | 'vendeur' | 'gestionnaire' | 'magasinier');
        setCurrentEmployee(employee);
        console.log('✅ Employee role determined (legacy system):', employee.role, '-> UI role:', roleMapping[employee.role]);
        return;
      }
      
      // 4. Si pas d'employé, chercher dans users/{uid} pour le rôle
      const userDocForFallback = await getDoc(doc(db, 'users', userId));
      if (userDocForFallback.exists()) {
        const userData = userDocForFallback.data();
        const role = userData.role as UserRole;
        const roleMapping: Record<string, string> = {
          'staff': 'vendeur',
          'manager': 'gestionnaire',
          'admin': 'magasinier',
          'owner': 'owner'
        };
        setEffectiveRole(roleMapping[role] as UserRole | 'owner' | 'vendeur' | 'gestionnaire' | 'magasinier');
        console.log('✅ User role determined:', role, '-> UI role:', roleMapping[role]);
      } else {
        setEffectiveRole(null);
        console.log('⚠️ No role found for user');
      }
    } catch (error) {
      console.error('❌ Error determining user role:', error);
      setEffectiveRole(null);
    }
  };

  // 🚀 INSTANT finance types loading with localStorage flag
  const loadFinanceTypesInBackground = async () => {
    if (!user?.uid) return;
    
    // 1. INSTANT CHECK: Check localStorage flag first
    if (!FinanceTypesManager.needsSetup(user.uid)) {
      console.log('🚀 Finance types already setup - skipping');
      return;
    }
    
    // 2. SETUP NEEDED: Ensure finance types and mark as setup
    try {
      console.log('📡 Setting up finance types...');
      
      await ensureDefaultFinanceEntryTypes();
      
      // Mark as setup in localStorage to skip future checks
      FinanceTypesManager.markAsSetup(user.uid);
      console.log('✅ Finance types setup completed and marked in localStorage');
    } catch (error) {
      console.error('❌ Finance types setup failed:', error);
      // App continues to work without finance types setup
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>
  ): Promise<FirebaseUser> => {
    // This signUp function is deprecated - users should be created first, then companies
    // For now, we'll throw an error to force migration to the new pattern
    console.warn('SignUp with company creation is deprecated. Please use: 1) Create user account first, 2) Then create company separately');
    console.warn('Parameters received:', { email, password, companyData });
    throw new Error('SignUp with company creation is deprecated. Please use: 1) Create user account first, 2) Then create company separately');
  };

  const signIn = async (email: string, password: string): Promise<FirebaseUser> => {
    console.log('🔐 signIn called with email:', email);
    
    // Prevent duplicate login attempts
    if (isSigningInRef.current) {
      console.log('⚠️ Sign in already in progress, ignoring duplicate request');
      throw new Error('Une tentative de connexion est déjà en cours. Veuillez patienter...');
    }
    
    // Marquer AVANT le try pour garantir son exécution même en cas d'erreur précoce
    isInitialLoginRef.current = true;
    isSigningInRef.current = true;
    
    try {
      // Validation de l'instance auth avant utilisation
      if (!auth) {
        throw new Error('Firebase Auth instance not initialized');
      }
      
      // Créer une promesse avec timeout optionnel en mode dev pour éviter les blocages
      const signInPromise = signInWithEmailAndPassword(auth, email, password);
      
      let response;
      if (import.meta.env.DEV) {
        // En mode dev, ajouter un timeout pour détecter les blocages
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Sign in timeout: opération prend plus de 30 secondes')), 30000)
        );
        
        response = await Promise.race([signInPromise, timeoutPromise]);
      } else {
        response = await signInPromise;
      }
      
      console.log('✅ signInWithEmailAndPassword succeeded, user:', response.user.uid);
      console.log('✅ User email:', response.user.email);
      
      // The onAuthStateChanged listener will handle the routing and reset isSigningInRef
      // Let the background loading handle routing based on user's companies
      console.log('🔄 Waiting for onAuthStateChanged to trigger routing...');
      
      // Note: isSigningInRef will be reset in onAuthStateChanged to prevent duplicate clicks
      // The loading state will be maintained until onAuthStateChanged completes
      
      return response.user;
    } catch (error: any) {
      console.error('❌ signIn error:', error);
      isInitialLoginRef.current = false; // Reset on error
      isSigningInRef.current = false; // Reset on error
      
      // Gestion d'erreurs améliorée avec messages explicites
      if (error.code) {
        // Erreur Firebase Auth
        const errorMessages: Record<string, string> = {
          'auth/user-not-found': 'Utilisateur non trouvé',
          'auth/wrong-password': 'Mot de passe incorrect',
          'auth/invalid-email': 'Email invalide',
          'auth/user-disabled': 'Compte utilisateur désactivé',
          'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
          'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
        };
        
        const userMessage = errorMessages[error.code] || `Erreur d'authentification: ${error.code}`;
        const enhancedError = new Error(userMessage);
        (enhancedError as any).code = error.code;
        throw enhancedError;
      }
      
      // Erreur générique
      throw error;
    }
  };

  const signOut = (): Promise<void> => {
    // Nettoyer le cache lors de la déconnexion
    clearCompanyCache();
    clearUserSession(); // Clear user session from localStorage
    setCompany(null);
    setEffectiveRole(null);
    setIsOwner(false);
    setCurrentEmployee(null);
    return firebaseSignOut(auth);
  };

  const updateCompany = async (data: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>>) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    const companyRef = doc(db, 'companies', selectedCompanyId || user.uid);
    const updateData = {
      ...data,
      updatedAt: Timestamp.now()
    };

    await updateDoc(companyRef, updateData);
    
    // Update local state and localStorage
    const updatedCompany = company ? { ...company, ...updateData } : null;
    setCompany(updatedCompany);
    
    if (updatedCompany) {
      CompanyManager.save(user.uid, updatedCompany);
      console.log('✅ Company data updated and cached with new color fields');
    }
  };

  const updateUserPassword = async (currentPassword: string, newPassword: string) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    // Reauthenticate user before changing password
    const credential = await signInWithEmailAndPassword(auth, user.email!, currentPassword);
    await updatePassword(credential.user, newPassword);
  };

  // Sélectionner une entreprise
  const selectCompany = async (companyId: string) => {
    if (!user) {
      throw new Error('No user logged in');
    }
    
    setSelectedCompanyId(companyId);
    await loadCompanyData(companyId, user.uid);
  };

  const value = {
    user,
    currentUser: user, // For backward compatibility
    company: memoizedCompany, // Utiliser la compagnie mémorisée
    loading,
    companyLoading,
    effectiveRole,
    isOwner,
    currentEmployee,
    userCompanies,
    selectedCompanyId,
    signUp,
    signIn,
    signOut,
    updateCompany,
    updateUserPassword,
    selectCompany
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};