import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
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
import type { Company, UserRole } from '../types/models';
import { ensureDefaultFinanceEntryTypes } from '../services/firestore';
import CompanyManager from '../services/storage/CompanyManager';
import FinanceTypesManager from '../services/storage/FinanceTypesManager';
import BackgroundSyncService from '../services/backgroundSync';
import { saveCompany } from '../services/companyService';
import { saveCompanyToCache, getCompanyFromCache, clearCompanyCache } from '../utils/companyCache';
import { getUserById, updateUserLastLogin, createUser } from '../services/userService';

interface AuthContextType {
  user: FirebaseUser | null;
  currentUser: FirebaseUser | null; // For backward compatibility
  company: Company | null;
  loading: boolean;
  companyLoading: boolean; // New: indicates if company data is still loading in background
  effectiveRole: UserRole | 'owner' | 'vendeur' | 'gestionnaire' | 'magasinier' | null; // Role effectif de l'utilisateur
  isOwner: boolean; // Si l'utilisateur est propriétaire de l'entreprise
  currentEmployee: any | null; // Informations de l'employé connecté
  userCompanies: any[]; // Liste des entreprises de l'utilisateur
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
  const [currentEmployee, setCurrentEmployee] = useState<any | null>(null);
  const [userCompanies, setUserCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isInitialLogin, setIsInitialLogin] = useState(false);

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔥 Auth state changed:', user ? 'User logged in' : 'User logged out');
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
        loadUserAndCompanyDataInBackground(user.uid);
        
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
    setCompanyLoading(true);
    
    try {
      // 1. Charger les données utilisateur depuis le système unifié
      const userData = await getUserById(userId);
      if (userData) {
        setUserCompanies(userData.companies || []);
        console.log(`✅ Utilisateur chargé avec ${userData.companies?.length || 0} entreprises`);
        
        // Mettre à jour la dernière connexion
        await updateUserLastLogin(userId);
        
        // 2. Rediriger vers la page de sélection de mode SEULEMENT lors du login initial
        if (isInitialLogin) {
          console.log(`📺 Redirection vers la page de sélection de mode`);
          setTimeout(() => {
            navigate('/mode-selection');
            setIsInitialLogin(false); // Reset après redirection
          }, 100);
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
          // Rediriger vers la page de sélection de mode après migration SEULEMENT lors du login initial
          if (isInitialLogin) {
            setTimeout(() => {
              navigate('/mode-selection');
              setIsInitialLogin(false); // Reset après redirection
            }, 100);
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
      const isCompanyOwner = companyData.companyId === userId;
      setIsOwner(isCompanyOwner);
      
      if (isCompanyOwner) {
        setEffectiveRole('owner');
        console.log('✅ User is company owner (new system)');
        return;
      }
      
      // 2. ❌ SUPPRIMÉ - Architecture simplifiée ne gère plus employeeRefs
      // Les rôles sont déterminés depuis users[].companies[].role
      
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
        setEffectiveRole(roleMapping[employee.role] as any);
        setCurrentEmployee(employee);
        console.log('✅ Employee role determined (legacy system):', employee.role, '-> UI role:', roleMapping[employee.role]);
        return;
      }
      
      // 4. Si pas d'employé, chercher dans users/{uid} pour le rôle
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData.role as UserRole;
        const roleMapping: Record<string, string> = {
          'staff': 'vendeur',
          'manager': 'gestionnaire',
          'admin': 'magasinier',
          'owner': 'owner'
        };
        setEffectiveRole(roleMapping[role] as any);
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
    // Utiliser le nouveau service de compagnie qui préserve la logique existante
    const company = await saveCompany(email, password, companyData);
    
    // Set company in state and localStorage (logique existante préservée)
    setCompany(company);
    CompanyManager.save(company.id, company);

    // Retourner l'utilisateur (pour compatibilité avec l'interface existante)
    return auth.currentUser!;
  };

  const signIn = async (email: string, password: string): Promise<FirebaseUser> => {
    setIsInitialLogin(true); // Marquer comme login initial
    const response = await signInWithEmailAndPassword(auth, email, password);
    if(isInitialLogin){
      navigate('/mode-selection');
      setIsInitialLogin(false); // Reset après redirection
    }
    return response.user;
  };

  const signOut = (): Promise<void> => {
    // Nettoyer le cache lors de la déconnexion
    clearCompanyCache();
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