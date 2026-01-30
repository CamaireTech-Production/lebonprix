import React, { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { Button, Input, SkeletonTable } from '@components/common';
import { LoginPWAInstallButton } from '@components/pwa';
import { getUserSession, hasActiveSession } from '@utils/storage/userSession';
import { showErrorToast, showSuccessToast } from '@utils/core/toast';
import { acceptInvitation, getInvitation } from '@services/firestore/employees/invitationService';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteId = searchParams.get('invite');
  
  const { loading, signIn, signInWithGoogle, user, companyLoading } = useAuth();

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

  // Check localStorage session on mount and redirect if already logged in
  useEffect(() => {
    if (!loading && hasActiveSession()) {
      const session = getUserSession();
      if (session) {
        // If user is already authenticated, redirect based on companies
        if (session.companies && session.companies.length > 0) {
          // Find first company where user is owner or admin
          const ownerOrAdminCompany = session.companies.find(
            (c) => c.role === 'owner' || c.role === 'admin'
          );
          
          if (ownerOrAdminCompany) {
            navigate(`/company/${ownerOrAdminCompany.companyId}/dashboard`);
            return;
          } else {
            // User is only employee - show company selection
            navigate(`/companies/me/${session.userId}`);
            return;
          }
        } else {
          // User has no companies - show mode selection
          navigate('/mode-selection');
          return;
        }
      }
    }
  }, [loading, navigate]);

  // Watch for user authentication state and company verification completion
  // Also handle invitation acceptance if invite parameter is present
  useEffect(() => {
    if (user && isLoading && companyLoading === false) {
      // Company verification is complete, handle invitation if present
      const handleInvitationAndRedirect = async () => {
        try {
          if (inviteId && user.uid) {
            // Get invitation first to get companyId
            const invitation = await getInvitation(inviteId);
            if (!invitation) {
              throw new Error('Invitation not found');
            }
            
            // Accept invitation after successful login
            await acceptInvitation(inviteId, user.uid);
            showSuccessToast('Invitation acceptée avec succès !');
            
            // Redirect directly to the company dashboard
            navigate(`/company/${invitation.companyId}/dashboard`);
            setIsLoading(false);
            return;
          }
          
          // No invitation, proceed with normal redirect
          setIsLoading(false);
        } catch (error) {
          console.error('Error accepting invitation:', error);
          showErrorToast('Erreur lors de l\'acceptation de l\'invitation. Vous pouvez toujours accéder à votre compte.');
          setIsLoading(false);
          // Still redirect normally even if invitation fails
        }
      };
      
      handleInvitationAndRedirect();
    }
  }, [user, isLoading, companyLoading, inviteId, navigate]);

  if (loading) {
    return <SkeletonTable rows={3} />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Prevent duplicate submissions
    if (isLoading) {
      return;
    }
    
    if (!email || !password) {
      showErrorToast('Veuillez entrer votre email et votre mot de passe');
      return;
    }
    
    try {
      setIsLoading(true);
      
      await signIn(email, password);
      
      // Show success message
      showSuccessToast('Connexion réussie ! Redirection en cours...');
      
      // signIn completed successfully, but user state might not be updated yet
      // Keep loading state true until user is set (handled by useEffect above)
      
      // Don't set isLoading to false here - wait for user state to change
      // The useEffect above will handle stopping the loading state when user is authenticated
      // This prevents the button from stopping loading before auth completes
    } catch (err: any) {
      console.error('Login error:', err);
      setIsLoading(false); // Only stop loading on error
      
      // Show user-friendly error messages
      if (err.message && err.message.includes('déjà en cours')) {
        showErrorToast(err.message);
      } else if (err.code) {
        const errorMessages: Record<string, string> = {
          'auth/user-not-found': 'Email ou mot de passe incorrect. Veuillez vérifier vos identifiants.',
          'auth/wrong-password': 'Email ou mot de passe incorrect. Veuillez vérifier vos identifiants.',
          'auth/invalid-credential': 'Email ou mot de passe incorrect. Veuillez vérifier vos identifiants.',
          'auth/invalid-login-credentials': 'Email ou mot de passe incorrect. Veuillez vérifier vos identifiants.',
          'auth/invalid-email': 'Format d\'email invalide. Veuillez vérifier votre adresse email.',
          'auth/user-disabled': 'Compte utilisateur désactivé. Veuillez contacter l\'administrateur.',
          'auth/network-request-failed': 'Erreur réseau. Veuillez vérifier votre connexion internet et réessayer.',
          'auth/too-many-requests': 'Trop de tentatives de connexion. Veuillez réessayer plus tard.',
          'auth/operation-not-allowed': 'Méthode de connexion non autorisée. Veuillez contacter le support.',
          'auth/email-already-in-use': 'Cet email est déjà utilisé.',
        };
        // Use a default message for credentials errors
        const errorMessage = errorMessages[err.code] || 'Email ou mot de passe incorrect. Veuillez vérifier vos identifiants et réessayer.';
        showErrorToast(errorMessage);
      } else {
        // Generic error - default to credentials error message
        showErrorToast(err.message || 'Email ou mot de passe incorrect. Veuillez vérifier vos identifiants.');
      }
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign in to your account</h2>
      {inviteId && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            📧 You have a pending invitation. Sign in to accept it and join the company.
          </p>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <Input
            label="Email"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          
          <Input
            label="Password"
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                Remember me
              </label>
            </div>
            
            <div className="text-sm">
              <a href="#" className="text-indigo-600 hover:text-indigo-500">
                Forgot your password?
              </a>
            </div>
          </div>
          
          <Button
            type="submit"
            className="w-full"
            isLoading={isLoading}
            loadingText="Connexion en cours..."
            disabled={isLoading}
          >
            Sign in
          </Button>
        </div>
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
              showSuccessToast('Connexion avec Google réussie ! Redirection en cours...');
            } catch (err: any) {
              console.error('Google sign in error:', err);
              setIsLoading(false);
              showErrorToast(err.message || 'Erreur lors de la connexion avec Google. Veuillez réessayer.');
            }
          }}
          isLoading={isLoading}
          loadingText="Connexion en cours..."
          disabled={isLoading}
        >
          Continuer avec Google
        </Button>
      </div>
      
      <div className="mt-6">
        <p className="text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link to="/auth/register" className="text-indigo-600 hover:text-indigo-500">
            Register
          </Link>
        </p>
      </div>

      {/* PWA Install Button */}
      <LoginPWAInstallButton />
    </div>
  );
};

export default Login;