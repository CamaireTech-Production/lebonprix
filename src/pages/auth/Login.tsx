import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import LoadingScreen from '../../components/common/LoadingScreen';
import { LoginPWAInstallButton } from '../../components/LoginPWAInstallButton';
import { getUserSession, hasActiveSession } from '../../utils/userSession';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  
  const { loading, signIn, user } = useAuth();

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

  // Watch for user authentication state and stop loading when authenticated
  useEffect(() => {
    if (user && isLoading) {
      // Keep loading until navigation completes or after a short delay
      // This ensures the button shows loading during the entire auth process
      setTimeout(() => {
        setIsLoading(false);
      }, 1000); // Delay to ensure navigation is initiated and user sees the loading state
      // Navigation will be handled by AuthContext
    }
  }, [user, isLoading]);

  if (loading) {
    return <LoadingScreen />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Prevent duplicate submissions
    if (isLoading) {
      return;
    }
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    try {
      setError('');
      setIsLoading(true);
      
      await signIn(email, password);
      
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
        setError(err.message);
      } else if (err.code) {
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
        const errorMessage = errorMessages[err.code] || 'Invalid Email or Password. Veuillez vérifier vos identifiants et réessayer.';
        setError(errorMessage);
      } else {
        // Generic error - default to credentials error message
        setError(err.message || 'Invalid Email or Password. Veuillez vérifier vos identifiants.');
      }
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign in to your account</h2>
      
      {error && (
        <div className="bg-red-50 text-red-800 p-3 rounded-md mb-4 text-sm">
          {error}
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