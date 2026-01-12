import { useState, FormEvent, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { Button, Input, LoadingScreen } from '@components/common';
import { FirebaseError } from 'firebase/app';
import { signUpUser } from '@services/auth/authService';
import { showErrorToast, showSuccessToast } from '@utils/core/toast';
import { validateUsername } from '@utils/validation/usernameValidation';
import { getInvitation } from '@services/firestore/employees/invitationService';
import { saveUserSession } from '@utils/storage/userSession';
import { auth } from '@services/core/firebase';

const Register = () => {
  // User form state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Field errors state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});



  const { currentUser, loading, signOut, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteId = searchParams.get('invite');

  // Déconnecter automatiquement l'utilisateur s'il est déjà connecté
  useEffect(() => {
    if (currentUser && !loading) {
      signOut();
    }
  }, [currentUser, loading, signOut]);

  // Pre-fill email from invitation if present
  useEffect(() => {
    if (inviteId && !email) {
      const loadInvitationEmail = async () => {
        try {
          const invitation = await getInvitation(inviteId);
          if (invitation && invitation.email) {
            setEmail(invitation.email);
          }
        } catch (error) {
          console.error('Error loading invitation email:', error);
          // Silently fail - user can still enter email manually
        }
      };
      loadInvitationEmail();
    }
  }, [inviteId, email]);



  if (loading) {
    return <LoadingScreen />;
  }

  const validateForm = () => {
    const errors: Record<string, string> = {};
    let hasErrors = false;

    // Required fields validation with individual error messages
    if (!username.trim()) {
      errors.username = 'Le nom d\'utilisateur est requis';
      hasErrors = true;
    } else {
      const usernameValidation = validateUsername(username);
      if (!usernameValidation.valid) {
        errors.username = usernameValidation.error || 'Nom d\'utilisateur invalide';
        hasErrors = true;
      }
      // Note: Username availability check removed - username is not used for authentication
    }

    if (!email.trim()) {
      errors.email = 'L\'adresse email est requise';
      hasErrors = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Veuillez entrer une adresse email valide';
      hasErrors = true;
    }

    if (!password) {
      errors.password = 'Le mot de passe est requis';
      hasErrors = true;
    } else if (password.length < 6) {
      errors.password = 'Le mot de passe doit contenir au moins 6 caractères';
      hasErrors = true;
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      errors.password = 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre';
      hasErrors = true;
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'La confirmation du mot de passe est requise';
      hasErrors = true;
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas';
      hasErrors = true;
    }

    if (!agreeTerms) {
      errors.agreeTerms = 'Vous devez accepter les conditions d\'utilisation';
      hasErrors = true;
    }

    // Set field errors for highlighting
    setFieldErrors(errors);

    if (hasErrors) {
      // Show toast with first error or summary
      const firstError = Object.values(errors)[0];
      if (firstError) {
        showErrorToast(firstError);
      } else {
        showErrorToast('Veuillez corriger les erreurs dans le formulaire');
      }
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);

      const userData = {
        username: username.trim()
      };

      await signUpUser(email, password, userData);

      // 💾 Save session IMMEDIATELY after signup to prevent race condition
      // This ensures ProtectedRoute can verify authentication even if onAuthStateChanged hasn't fired yet
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        saveUserSession(
          firebaseUser.uid,
          firebaseUser.email || email,
          [] // Empty companies array for new users (will be updated by AuthContext background loading)
        );
      }

      // Show success message
      showSuccessToast('Compte créé avec succès ! Redirection en cours...');

      // Wait for onAuthStateChanged to fire and update the auth state
      // Increased timeout to ensure auth state is properly propagated
      await new Promise(resolve => setTimeout(resolve, 500));

      // Redirection vers la page de sélection de mode
      // (onAuthStateChanged peut aussi gérer cela, mais on le fait ici pour être sûr)
      navigate('/mode-selection');
    } catch (err: any) {
      // Check for Firebase error code (works for both FirebaseError and errors with code property)
      const errorCode = err?.code || (err instanceof FirebaseError ? err.code : null);

      if (errorCode) {
        switch (errorCode) {
          case 'auth/email-already-in-use':
            showErrorToast(
              '❌ Cette adresse email est déjà utilisée. Veuillez vous connecter avec votre compte existant.'
            );
            break;
          case 'auth/invalid-email':
            showErrorToast('❌ L\'adresse email n\'est pas valide. Veuillez vérifier votre email.');
            break;
          case 'auth/operation-not-allowed':
            showErrorToast('❌ L\'inscription par email n\'est pas activée. Veuillez contacter le support.');
            break;
          case 'auth/weak-password':
            showErrorToast('❌ Le mot de passe est trop faible. Veuillez utiliser un mot de passe plus fort.');
            break;
          case 'auth/network-request-failed':
            showErrorToast('❌ Erreur de connexion. Vérifiez votre connexion internet et réessayez.');
            break;
          default:
            showErrorToast(`❌ Erreur lors de la création du compte: ${err?.message || 'Erreur inconnue'}. Veuillez réessayer.`);
            console.error('Registration error:', err);
        }
      } else {
        // Handle non-Firebase errors
        const errorMessage = err?.message || 'Une erreur inattendue est survenue';
        showErrorToast(`❌ ${errorMessage}. Veuillez réessayer.`);
        console.error('Unexpected error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Créer votre compte</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Account Information Section */}
        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Nom d'utilisateur <span className="text-red-500">*</span>
            </label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                // Clear error when user starts typing
                if (fieldErrors.username) {
                  setFieldErrors(prev => ({ ...prev, username: '' }));
                }
              }}
              error={fieldErrors.username}
              helpText="3-30 caractères, lettres, chiffres, tirets et underscores"
              className={fieldErrors.username ? 'border-red-500' : ''}
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors(prev => ({ ...prev, email: '' }));
                }
              }}
              error={fieldErrors.email}
              helpText="Une adresse email valide"
              className={fieldErrors.email ? 'border-red-500' : ''}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe <span className="text-red-500">*</span>
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors(prev => ({ ...prev, password: '' }));
                }
              }}
              error={fieldErrors.password}
              helpText="Minimum 6 caractères, incluant une majuscule, une minuscule et un chiffre"
              className={fieldErrors.password ? 'border-red-500' : ''}
              required
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmer le mot de passe <span className="text-red-500">*</span>
            </label>
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors(prev => ({ ...prev, confirmPassword: '' }));
                }
              }}
              error={fieldErrors.confirmPassword}
              className={fieldErrors.confirmPassword ? 'border-red-500' : ''}
              required
            />
          </div>
        </div>

        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="agree-terms"
              name="agreeTerms"
              type="checkbox"
              className={`h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded ${fieldErrors.agreeTerms ? 'border-red-500' : ''
                }`}
              checked={agreeTerms}
              onChange={(e) => {
                setAgreeTerms(e.target.checked);
                if (fieldErrors.agreeTerms) {
                  setFieldErrors(prev => ({ ...prev, agreeTerms: '' }));
                }
              }}
              required
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="agree-terms" className={`${fieldErrors.agreeTerms ? 'text-red-600' : 'text-gray-700'}`}>
              J'accepte les{' '}
              <a href="#" className="text-indigo-600 hover:text-indigo-500">
                conditions d'utilisation
              </a>{' '}
              <span className="text-red-500">*</span>
            </label>
            {fieldErrors.agreeTerms && (
              <p className="mt-1 text-sm text-red-500">{fieldErrors.agreeTerms}</p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          isLoading={isLoading}
          loadingText="Creating account..."
        >
          Créer mon compte
        </Button>
      </form>

      {/* Divider */}
      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Ou</span>
          </div>
        </div>
      </div>

      {/* Google Sign In Button */}
      <div className="mt-6">
        <Button
          type="button"
          variant="outline"
          className="w-full border-gray-300 hover:bg-gray-50"
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          }
          onClick={async () => {
            if (isLoading) return;
            try {
              setIsLoading(true);
              await signInWithGoogle();
              showSuccessToast('Inscription avec Google réussie ! Redirection en cours...');
              // Small delay to let onAuthStateChanged handle routing
              await new Promise(resolve => setTimeout(resolve, 100));
              navigate('/mode-selection');
            } catch (err: any) {
              console.error('Google sign in error:', err);
              setIsLoading(false);
              showErrorToast(err.message || 'Erreur lors de l\'inscription avec Google. Veuillez réessayer.');
            }
          }}
          isLoading={isLoading}
          loadingText="Inscription en cours..."
          disabled={isLoading}
        >
          Continuer avec Google
        </Button>
      </div>

      <div className="mt-6">
        <p className="text-center text-sm text-gray-600">
          Vous avez déjà un compte ?{' '}
          <Link to="/auth/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
            Se connecter
          </Link>
        </p>
      </div>

      {/* Information sur le processus */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">
          Comment ça marche ?
        </h3>
        <ol className="text-sm text-blue-700 space-y-1">
          <li>1. Créez votre compte utilisateur</li>
          <li>2. Accédez au dashboard de vos entreprises</li>
          <li>3. Créez votre première entreprise</li>
          <li>4. Invitez des employés si nécessaire</li>
        </ol>
      </div>
    </div>
  );
};

export default Register;