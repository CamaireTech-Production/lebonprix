import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '@services/core/firebase';
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updatePassword,
  updateEmail,
  sendEmailVerification
} from 'firebase/auth';
import { doc, getDoc, getDocFromCache, updateDoc, Timestamp, onSnapshot, type DocumentReference } from 'firebase/firestore';
import type { Company, UserRole, UserCompanyRef, CompanyEmployee } from '../types/models';
import { ensureDefaultFinanceEntryTypes } from '@services/firestore/finance/financeService';
import CompanyManager from '@services/storage/CompanyManager';
import FinanceTypesManager from '@services/storage/FinanceTypesManager';
import BackgroundSyncService from '@services/utilities/backgroundSync';
import { saveCompanyToCache, getCompanyFromCache, clearCompanyCache } from '@utils/storage/companyCache';
import { getUserById, updateUserLastLogin, createUser, updateUser } from '@services/utilities/userService';
import { saveUserSession, getUserSession, clearUserSession } from '@utils/storage/userSession';
import { clearUserDataOnLogout } from '@utils/core/logoutCleanup';
import { logError, logWarning } from '@utils/core/logger';
import { signInWithGoogle as signInWithGoogleService } from '@services/auth/authService';

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
  signInWithGoogle: () => Promise<FirebaseUser>;
  signOut: () => Promise<void>;
  updateCompany: (data: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>>) => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateUserEmail: (newEmail: string, currentPassword: string) => Promise<void>;
  selectCompany: (companyId: string) => Promise<void>;
  getUserAuthProvider: () => string | null; // Get the authentication provider (password, google.com, etc.)
  canChangePassword: () => boolean; // Check if user can change password (only email/password users)
  canChangeEmail: () => boolean; // Check if user can change email (only email/password users, not Google)
  refreshUser: () => Promise<void>; // Refresh user data from Firebase (e.g., after linking a new provider)
}

const AuthContext = createContext<AuthContextType | null>(null);

const isOfflineFirestoreError = (error: any) => {
  if (!error) return false;
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return error.code === 'unavailable' || message.includes('offline');
};

const getDocWithCache = async <T = unknown>(ref: DocumentReference<T>) => {
  try {
    return await getDoc(ref);
  } catch (error: any) {
    if (isOfflineFirestoreError(error)) {
      try {
        return await getDocFromCache(ref);
      } catch (cacheError) {
        logError('Firestore cache miss', cacheError);
      }
    }
    throw error;
  }
};

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

  // Stabilize userCompanies to prevent unnecessary re-renders in useRolePermissions
  // Only recalculate when the actual data changes (by comparing companyId, role, permissionTemplateId)
  const memoizedUserCompanies = useMemo(() => {
    return userCompanies;
  }, [
    userCompanies.length,
    userCompanies.map(c => `${c.companyId}-${c.role}-${c.permissionTemplateId || ''}`).join(',')
  ]);
  const isSigningInRef = useRef(false); // Track if signIn is in progress to prevent duplicate clicks

  // Mémoriser les informations de la compagnie pour les restaurer lors de la reconnexion
  // Solution 4: Stabilize company object reference by only depending on id and name
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
  }, [company]); // Depend on the full company object to capture all updates (currency, logo, etc.)

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
            clearUserSession(session.userId);
          } else {
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
      isSigningInRef.current = false;
      setUser(user);
      if (user) {
        // Detect if this is a first login/signup (not a page refresh or token refresh)
        const sessionKey = `lebonprix_first_login_${user.uid}`;
        let isFirstLogin = false;
        if (!sessionStorage.getItem(sessionKey)) {
          isFirstLogin = true;
          sessionStorage.setItem(sessionKey, 'true');
        }
        isInitialLoginRef.current = isFirstLogin;
        try {
          await loadUserAndCompanyDataInBackground(user.uid);
        } catch (error) {
          logError('Error in background loading', error);
        }
        loadFinanceTypesInBackground();
      } else {
        setCompany(null);
        setEffectiveRole(null);
        setIsOwner(false);
        setCurrentEmployee(null);
        setLoading(false);
        clearCompanyCache();
        clearUserSession();
        // Clear all first login flags on logout
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('lebonprix_first_login_')) {
            sessionStorage.removeItem(key);
          }
        });
      }
    });
    return unsubscribe;
  }, []);

  // Écouter les changements dans users.companies[] pour mettre à jour le rôle effectif
  // 🔄 Écouter les changements dans users.companies[] pour mettre à jour le rôle effectif
  useEffect(() => {
    if (!user?.uid || !company?.id) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (userSnap) => {
      if (!userSnap.exists()) {
        return;
      }

      const userData = userSnap.data();
      const userCompanyRef = userData.companies?.find((c: UserCompanyRef) => c.companyId === company.id);

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
        setEffectiveRole(newEffectiveRole);
      } else {
        // Si l'utilisateur n'est plus dans cette company
        // Vérifier si c'est le propriétaire avant de réinitialiser
        const isCompanyOwner = company.userId === user.uid;
        if (!isCompanyOwner) {
          setEffectiveRole(null);
        }
      }
    }, (error) => {
      console.error('❌ [AuthContext] Erreur lors de l\'écoute des changements utilisateur:', error);
    });

    return () => {
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
      // Use displayName as username, or generate from email if not available
      const username = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'user' + Date.now();
      await createUser(userId, {
        username: username,
        email: firebaseUser.email || '',
        photoURL: firebaseUser.photoURL || undefined
      });

    } catch (error) {
      logError('Error migrating user', error);
      throw error;
    }
  };

  // INSTANT user and company data loading from localStorage with background sync
  const loadUserAndCompanyDataInBackground = async (userId: string) => {
    setCompanyLoading(true);
    try {
      let userData = await getUserById(userId);
      if (!userData) {
        await new Promise(resolve => setTimeout(resolve, 500));
        userData = await getUserById(userId);
      }
      if (userData) {
        setUserCompanies(userData.companies || []);
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
        await updateUserLastLogin(userId);
        if (isInitialLoginRef.current) {
          // 0. Check for invitation - SKIP redirect if invitation is present
          // The Login page will handle the invitation acceptance
          const searchParams = new URLSearchParams(window.location.search);
          if (searchParams.get('invite')) {
            console.log('✉️ Invitation detected, skipping auto-redirect');
            isInitialLoginRef.current = false;
            return;
          }

          if (userData.companies && userData.companies.length > 0) {
            // 1. Single Company Logic
            if (userData.companies.length === 1) {
              const company = userData.companies[0];
              if (company.role === 'owner' || company.role === 'admin') {
                navigate(`/company/${company.companyId}/dashboard`);
              } else {
                // Employee / Other roles -> Default to Employee Dashboard
                navigate('/employee/dashboard');
              }
            }
            // 2. Multiple Companies Logic
            else {
              // User has mixed roles or multiple companies -> Let them choose mode
              navigate('/mode-selection');
            }
          } else {
            // 3. No Companies (New User) Logic
            // Redirect directly to creation with flag
            navigate('/company/create?new_user=true');
          }
          isInitialLoginRef.current = false;
        }
      } else {
        const firebaseUser = auth.currentUser;
        if (firebaseUser && firebaseUser.displayName) {
          try {
            await migrateUserToNewSystem(userId);
            userData = await getUserById(userId);
            if (userData) {
              setUserCompanies(userData.companies || []);
              if (isInitialLoginRef.current) {
                // Same logic as above for migrated users
                const searchParams = new URLSearchParams(window.location.search);
                if (searchParams.get('invite')) {
                  isInitialLoginRef.current = false;
                  return;
                }

                if (userData.companies && userData.companies.length > 0) {
                  if (userData.companies.length === 1) {
                    const company = userData.companies[0];
                    if (company.role === 'owner' || company.role === 'admin') {
                      navigate(`/company/${company.companyId}/dashboard`);
                    } else {
                      navigate('/employee/dashboard');
                    }
                  } else {
                    navigate('/mode-selection');
                  }
                } else {
                  navigate('/company/create?new_user=true');
                }
                isInitialLoginRef.current = false;
              }
            }
          } catch (migrationError) {
            if (isInitialLoginRef.current) {
              const searchParams = new URLSearchParams(window.location.search);
              if (!searchParams.get('invite')) {
                navigate('/company/create?new_user=true'); // Fallback for new users
              }
              isInitialLoginRef.current = false;
            }
          }
        } else {
          if (isInitialLoginRef.current) {
            const searchParams = new URLSearchParams(window.location.search);
            if (!searchParams.get('invite')) {
              navigate('/company/create?new_user=true'); // Fallback for new users
            }
            isInitialLoginRef.current = false;
          }
        }
      }
    } catch (error) {
      logError('Error loading user data', error);
      await loadCompanyDataLegacy(userId);
    } finally {
      setCompanyLoading(false);
      setLoading(false);
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
      const companyDoc = await getDocWithCache(doc(db, 'companies', userId));

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
      logError('Company loading failed', error);
    } finally {
      setCompanyLoading(false);
    }
  };

  // Charger les données d'une entreprise spécifique
  const loadCompanyData = async (companyId: string, userId: string) => {
    try {
      const companyDoc = await getDocWithCache(doc(db, 'companies', companyId));

      if (companyDoc.exists()) {
        const companyData = { id: companyDoc.id, ...companyDoc.data() } as Company;
        setCompany(companyData);

        // Déterminer le rôle effectif et ownership
        await determineUserRole(companyData, userId);

        // Save to localStorage for future instant loads
        CompanyManager.save(userId, companyData);

        // Mettre à jour le cache global
        saveCompanyToCache(companyData);
      } else {
        console.error('❌ [loadCompanyData] Company document does not exist:', companyId);
        console.log('🔍  this is the company informations', companyId);
      }
    } catch (error) {
      logError('Error loading company', error);
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
      const userDocForRole = await getDocWithCache(doc(db, 'users', userId));
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

          // Create CompanyEmployee from user data for currentEmployee
          const employee: CompanyEmployee = {
            id: userId, // Use userId as id
            username: userData.username || '',
            email: userData.email || '',
            phone: userData.phone || undefined,
            role: userCompanyRef.role as UserRole,
            firebaseUid: userId,
            createdAt: userCompanyRef.joinedAt || Timestamp.now(),
            updatedAt: Timestamp.now()
          };
          setCurrentEmployee(employee);
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
      const userDocForFallback = await getDocWithCache(doc(db, 'users', userId));
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
      logError('Error determining user role', error);
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
      logError('Finance types setup failed', error);
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
    logWarning('SignUp with company creation is deprecated. Please use: 1) Create user account first, 2) Then create company separately');
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


      // The onAuthStateChanged listener will handle the routing and reset isSigningInRef
      // Let the background loading handle routing based on user's companies

      // Note: isSigningInRef will be reset in onAuthStateChanged to prevent duplicate clicks
      // The loading state will be maintained until onAuthStateChanged completes

      return response.user;
    } catch (error: any) {
      logError('Sign in error', error);
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

  const signInWithGoogle = async (): Promise<FirebaseUser> => {
    // Prevent duplicate login attempts
    if (isSigningInRef.current) {
      throw new Error('Une tentative de connexion est déjà en cours. Veuillez patienter...');
    }

    // Marquer AVANT le try pour garantir son exécution même en cas d'erreur précoce
    isInitialLoginRef.current = true;
    isSigningInRef.current = true;

    try {
      // Call the Google sign-in service
      const user = await signInWithGoogleService();

      // The onAuthStateChanged listener will handle the routing and reset isSigningInRef
      // Let the background loading handle routing based on user's companies

      // Note: isSigningInRef will be reset in onAuthStateChanged to prevent duplicate clicks
      // The loading state will be maintained until onAuthStateChanged completes

      return user;
    } catch (error: any) {
      logError('Google sign in error', error);
      isInitialLoginRef.current = false; // Reset on error
      isSigningInRef.current = false; // Reset on error

      // Re-throw the error (it already has user-friendly messages from authService)
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

  const updateUserEmail = async (newEmail: string, currentPassword: string) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    // Check if user can change email (must have password provider)
    if (!canChangeEmail()) {
      throw new Error('Email cannot be changed for Google-authenticated accounts. Please change your email in your Google account settings.');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      throw new Error('Invalid email format');
    }

    // Check if email is different
    if (user.email?.toLowerCase() === newEmail.toLowerCase()) {
      throw new Error('New email must be different from current email');
    }

    // Reauthenticate user before changing email
    const credential = await signInWithEmailAndPassword(auth, user.email!, currentPassword);

    // Update email in Firebase Auth
    await updateEmail(credential.user, newEmail);

    // Send verification email to the new address
    await sendEmailVerification(credential.user);

    // Update email in Firestore user document
    try {
      await updateUser(user.uid, { email: newEmail });
    } catch (error) {
      logError('Error updating email in user document', error);
      // Don't throw - email was updated in Auth, Firestore update can be retried
    }

    // Update email in Firestore company document if company exists
    if (company && selectedCompanyId) {
      try {
        const companyRef = doc(db, 'companies', selectedCompanyId);
        await updateDoc(companyRef, {
          email: newEmail,
          updatedAt: Timestamp.now()
        });

        // Update local company state
        const updatedCompany = { ...company, email: newEmail };
        setCompany(updatedCompany);
        CompanyManager.save(user.uid, updatedCompany);
      } catch (error) {
        logError('Error updating email in company document', error);
        // Don't throw - email was updated in Auth, Firestore update can be retried
      }
    }

    // Refresh user data to get updated email
    await refreshUser();
  };

  // Sélectionner une entreprise
  const selectCompany = async (companyId: string) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    setSelectedCompanyId(companyId);
    await loadCompanyData(companyId, user.uid);
  };

  /**
   * Get the authentication provider for the current user
   * Returns: 'password' for email/password, 'google.com' for Google, etc.
   */
  const getUserAuthProvider = (): string | null => {
    if (!user) return null;

    // providerData contains all linked providers
    // The first provider is typically the primary sign-in method
    const providerData = user.providerData;
    if (providerData && providerData.length > 0) {
      return providerData[0]?.providerId || null;
    }

    return null;
  };

  /**
   * Check if the current user can change their password
   * Users can change their password if they have the password provider linked
   * This includes both email/password users and Google users who added a password
   */
  const canChangePassword = (): boolean => {
    if (!user) return false;

    // Check if user has password provider linked (not just as primary)
    return user.providerData.some(
      (provider) => provider?.providerId === 'password'
    );
  };

  /**
   * Check if the current user can change their email
   * Users can only change email if they use email/password authentication (not Google)
   * Google users must change their email through Google account settings
   */
  const canChangeEmail = (): boolean => {
    if (!user) return false;

    // Can only change email if primary provider is password (email/password auth)
    // Google users cannot change email through the app
    const primaryProvider = getUserAuthProvider();
    return primaryProvider === 'password';
  };

  /**
   * Refresh the current user's data from Firebase
   * Useful after operations that modify user data (e.g., linking a new provider)
   */
  const refreshUser = async (): Promise<void> => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await currentUser.reload();
      // Update the state with the refreshed user to trigger re-renders
      setUser(auth.currentUser);
    }
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
    userCompanies: memoizedUserCompanies, // Use memoized version to prevent unnecessary re-renders
    selectedCompanyId,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateCompany,
    updateUserPassword,
    updateUserEmail,
    selectCompany,
    getUserAuthProvider,
    canChangePassword,
    canChangeEmail,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};