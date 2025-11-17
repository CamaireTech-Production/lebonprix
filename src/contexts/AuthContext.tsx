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
import { doc, getDoc, updateDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import type { Company, UserRole, UserCompanyRef, CompanyEmployee } from '../types/models';
import { ensureDefaultFinanceEntryTypes } from '../services/firestore';
import CompanyManager from '../services/storage/CompanyManager';
import FinanceTypesManager from '../services/storage/FinanceTypesManager';
import BackgroundSyncService from '../services/backgroundSync';
import { saveCompanyToCache, getCompanyFromCache, clearCompanyCache } from '../utils/companyCache';
import { getUserById, updateUserLastLogin, createUser } from '../services/userService';
import { saveUserSession, getUserSession, clearUserSession, updateUserSessionCompanies } from '../utils/userSession';
import { clearUserDataOnLogout } from '../utils/logoutCleanup';

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

  // Check localStorage session on mount and wait for Firebase auth to restore
  useEffect(() => {
    const session = getUserSession();
    if (session) {
      // Wait for Firebase auth persistence to restore before validating
      // Give it a few seconds as Firebase auth persistence is async
      const checkInterval = setInterval(() => {
        const currentUser = auth.currentUser;
        if (currentUser) {
          // Firebase auth restored - validate match
          if (currentUser.uid !== session.userId) {
            console.log('⚠️ Session mismatch: Firebase auth does not match localStorage session');
            clearUserSession(session.userId);
          } else {
            console.log('✅ Session validated: Firebase auth matches localStorage session');
          }
          clearInterval(checkInterval);
        }
      }, 100);
      
      // Stop checking after 3 seconds (Firebase auth should restore by then)
      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        const currentUser = auth.currentUser;
        // If still no Firebase auth after timeout, keep session (will validate in onAuthStateChanged)
        if (!currentUser) {
          console.log('⏳ Firebase auth not restored yet, session validation will happen in onAuthStateChanged');
        }
      }, 3000);
      
      return () => {
        clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    }
    // Let onAuthStateChanged handle the actual auth check and routing
  }, []);

  // NOTE: placed after function declarations to avoid "cannot access before initialization"
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Reset signing in flag when auth state changes
      isSigningInRef.current = false;
      
      setUser(user);
      
      if (user) {
        // 🚀 IMMEDIATE UI RENDER: Set loading to false right away
        setLoading(false);
        
        // 🚀 RESTORE COMPANY FROM CACHE: Try to restore company data immediately
        const cachedCompany = getCompanyFromCache();
        if (cachedCompany) {
          setCompany(cachedCompany);
          
          // Déterminer le rôle immédiatement si on a les données
          determineUserRole(cachedCompany, user.uid);
        }
        
        // 🔄 BACKGROUND LOADING: Start user and company data fetch in background
        // Ensure the background loading happens
        try {
          await loadUserAndCompanyDataInBackground(user.uid);
        } catch (error) {
          console.error('❌ Error in background loading:', error);
        }
        
        // 🔄 BACKGROUND LOADING: Start finance types in background
        loadFinanceTypesInBackground();
        
      } else {
        setCompany(null);
        setEffectiveRole(null);
        setIsOwner(false);
        setCurrentEmployee(null);
        setLoading(false);
        // Nettoyer le cache lors de la déconnexion
        clearCompanyCache();
        // Clear user session (no userId means clear all - but we know user is null)
        clearUserSession();
      }
    });

    return unsubscribe;
  }, []);

  // 🔄 Écouter les changements dans users.companies[] pour mettre à jour le rôle effectif
  useEffect(() => {
    if (!user?.uid || !company?.id) return;

    console.log('👂 Écoute des changements du rôle utilisateur pour company:', company.id);

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (userSnap) => {
      if (!userSnap.exists()) {
        console.log('⚠️ [AuthContext] Document utilisateur n\'existe pas');
        return;
      }

      console.log('📡 [AuthContext] Snapshot reçu pour user:', user.uid);
      const userData = userSnap.data();
      const userCompanyRef = userData.companies?.find((c: UserCompanyRef) => c.companyId === company.id);

      console.log('📡 [AuthContext] Companies trouvées:', userData.companies?.length || 0);
      console.log('📡 [AuthContext] Company actuelle trouvée:', userCompanyRef ? { companyId: userCompanyRef.companyId, role: userCompanyRef.role } : 'non trouvée');

      // Mettre à jour userCompanies
      setUserCompanies(userData.companies || []);

      // Si le rôle a changé pour la company actuelle, mettre à jour le rôle effectif
      if (userCompanyRef) {
        const roleMapping: Record<string, string> = {
          'staff': 'vendeur',
          'manager': 'gestionnaire',
          'admin': 'magasinier',
          'owner': 'owner'
        };

        const uiRole = roleMapping[userCompanyRef.role] || userCompanyRef.role;
        const newEffectiveRole = uiRole as UserRole | 'owner' | 'vendeur' | 'gestionnaire' | 'magasinier';

        // Toujours mettre à jour le rôle (le listener se déclenche seulement quand il y a un changement)
        console.log('🔄 [AuthContext] Rôle effectif mis à jour:', { old: effectiveRole, new: newEffectiveRole, companyId: company.id, userId: user.uid });
        setEffectiveRole(newEffectiveRole);
      } else {
        // Si l'utilisateur n'est plus dans cette company
        // Vérifier si c'est le propriétaire avant de réinitialiser
        const isCompanyOwner = company.userId === user.uid;
        if (!isCompanyOwner) {
          console.log('⚠️ [AuthContext] Utilisateur retiré de la company, réinitialisation du rôle');
          setEffectiveRole(null);
        }
      }
    }, (error) => {
      console.error('❌ [AuthContext] Erreur lors de l\'écoute des changements utilisateur:', error);
    });

    return () => {
      console.log('🔇 Arrêt de l\'écoute des changements du rôle utilisateur');
      unsubscribe();
    };
  }, [user?.uid, company?.id]);

  // 🔄 Migration automatique d'un utilisateur vers le nouveau système
  const migrateUserToNewSystem = async (userId: string) => {
    try {
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
      
    } catch (error) {
      console.error('❌ Erreur lors de la migration de l\'utilisateur:', error);
      throw error;
    }
  };

  // 🚀 INSTANT user and company data loading from localStorage with background sync
  const loadUserAndCompanyDataInBackground = async (userId: string) => {
    setCompanyLoading(true);
    
    try {
      // 1. Charger les données utilisateur depuis le système unifié
      const userData = await getUserById(userId);
      
      if (userData) {
        setUserCompanies(userData.companies || []);
        
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
        if (isInitialLoginRef.current) {
          if (userData.companies && userData.companies.length > 0) {
            // User has companies - auto-select and go to dashboard
            // Find first company where user is owner or admin
            const ownerOrAdminCompany = userData.companies.find((company: UserCompanyRef) => 
              company.role === 'owner' || company.role === 'admin'
            );
            
            if (ownerOrAdminCompany) {
              navigate(`/company/${ownerOrAdminCompany.companyId}/dashboard`);
            } else {
              // User is only employee - show company selection
              navigate(`/companies/me/${userId}`);
            }
          } else {
            // User has no companies - show mode selection
            navigate('/mode-selection');
          }
          
          isInitialLoginRef.current = false; // Reset après redirection
        } else {
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
        // Créer l'utilisateur dans le nouveau système s'il n'existe pas
        await migrateUserToNewSystem(userId);
        // Puis recharger les données
        const userData = await getUserById(userId);
        if (userData) {
          setUserCompanies(userData.companies || []);
          // Handle routing after migration
          if (isInitialLoginRef.current) {
            if (userData.companies && userData.companies.length > 0) {
              // User has companies - auto-select and go to dashboard
              // Find first company where user is owner or admin
              const ownerOrAdminCompany = userData.companies.find((company: UserCompanyRef) => 
                company.role === 'owner' || company.role === 'admin'
              );
              
              if (ownerOrAdminCompany) {
                navigate(`/company/${ownerOrAdminCompany.companyId}/dashboard`);
              } else {
                // User is only employee - show company selection
                navigate(`/companies/me/${userId}`);
              }
            } else {
              // User has no companies - show mode selection
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
        // Force a fresh fetch from Firebase
        CompanyManager.remove(userId);
      } else {
        setCompany(localCompany);
        setCompanyLoading(false);
        
        // 2. BACKGROUND SYNC: Update localStorage if needed
        BackgroundSyncService.syncCompany(userId, (freshCompany) => {
          setCompany(freshCompany);
        });
        return;
      }
    }
    
    // 3. FALLBACK: No localStorage data, fetch from Firebase
    try {
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
      } else {
        setEffectiveRole(null);
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
      return;
    }
    
    // 2. SETUP NEEDED: Ensure finance types and mark as setup
    try {
      await ensureDefaultFinanceEntryTypes();
      
      // Mark as setup in localStorage to skip future checks
      FinanceTypesManager.markAsSetup(user.uid);
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
    // Prevent duplicate login attempts
    if (isSigningInRef.current) {
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
      
      console.log('✅ Successful login:', response.user.email);
      
      // The onAuthStateChanged listener will handle the routing and reset isSigningInRef
      // Let the background loading handle routing based on user's companies
      
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
          'auth/user-not-found': 'Invalid Email or Password',
          'auth/wrong-password': 'Invalid Email or Password',
          'auth/invalid-credential': 'Invalid Email or Password',
          'auth/invalid-login-credentials': 'Invalid Email or Password',
          'auth/invalid-email': 'Format d\'email invalide',
          'auth/user-disabled': 'Compte utilisateur désactivé. Contactez l\'administrateur.',
          'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion internet.',
          'auth/too-many-requests': 'Trop de tentatives de connexion. Veuillez réessayer plus tard.',
          'auth/operation-not-allowed': 'Méthode de connexion non autorisée.',
          'auth/email-already-in-use': 'Cet email est déjà utilisé.',
        };
        
        // Use a default message for credentials errors
        const userMessage = errorMessages[error.code] || 'Invalid Email or Password. Veuillez vérifier vos identifiants.';
        const enhancedError = new Error(userMessage);
        (enhancedError as any).code = error.code;
        throw enhancedError;
      }
      
      // Erreur générique
      throw error;
    }
  };

  const signOut = (): Promise<void> => {
    // Get userId before clearing state
    const currentUserId = user?.uid;
    
    // Comprehensive logout cleanup - clears all user-specific data
    // Preserves: PWA update data and checkout data
    clearUserDataOnLogout(currentUserId);
    
    // Also clear company cache (for backward compatibility)
    clearCompanyCache();
    
    // Clear user session (included in clearUserDataOnLogout but keeping for clarity)
    if (currentUserId) {
      clearUserSession(currentUserId);
    } else {
      clearUserSession();
    }
    
    // Clear React state
    setCompany(null);
    setEffectiveRole(null);
    setIsOwner(false);
    setCurrentEmployee(null);
    setUserCompanies([]);
    setSelectedCompanyId(null);
    
    return firebaseSignOut(auth);
  };

  // Fonction utilitaire pour nettoyer les valeurs undefined récursivement
  const removeUndefinedValues = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return undefined;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => removeUndefinedValues(item)).filter(item => item !== undefined);
    }
    
    if (typeof obj === 'object' && obj.constructor === Object) {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanedValue = removeUndefinedValues(value);
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
      return cleaned;
    }
    
    return obj;
  };

  const updateCompany = async (data: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>>) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    const companyRef = doc(db, 'companies', selectedCompanyId || user.uid);
    
    // Nettoyer les valeurs undefined avant de mettre à jour
    const cleanedData = removeUndefinedValues(data);
    const updateData = {
      ...cleanedData,
      updatedAt: Timestamp.now()
    };

    await updateDoc(companyRef, updateData);
    
    // Update local state and localStorage
    const updatedCompany = company ? { ...company, ...updateData } : null;
    setCompany(updatedCompany);
    
    if (updatedCompany) {
      CompanyManager.save(user.uid, updatedCompany);
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
      {children}
    </AuthContext.Provider>
  );
};