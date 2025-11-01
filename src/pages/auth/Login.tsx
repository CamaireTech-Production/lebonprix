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
        console.log('🔍 Found active session in localStorage, checking user authentication...');
        
        // If user is already authenticated, redirect based on companies
        if (session.companies && session.companies.length > 0) {
          // Find first company where user is owner or admin
          const ownerOrAdminCompany = session.companies.find(
            (c) => c.role === 'owner' || c.role === 'admin'
          );
          
          if (ownerOrAdminCompany) {
            console.log('🚀 Redirecting to dashboard:', ownerOrAdminCompany.companyId);
            navigate(`/company/${ownerOrAdminCompany.companyId}/dashboard`);
            return;
          } else {
            // User is only employee - show company selection
            console.log('🚀 Redirecting to company selection:', session.userId);
            navigate(`/companies/me/${session.userId}`);
            return;
          }
        } else {
          // User has no companies - show mode selection
          console.log('🚀 Redirecting to mode selection');
          navigate('/mode-selection');
          return;
        }
      }
    }
  }, [loading, navigate]);

  // Watch for user authentication state and stop loading when authenticated
  useEffect(() => {
    if (user && isLoading) {
      console.log('✅ User authenticated, stopping loading state');
      setIsLoading(false);
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
      console.log('⚠️ Login already in progress, ignoring duplicate submission');
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
          'auth/user-not-found': 'Utilisateur non trouvé',
          'auth/wrong-password': 'Mot de passe incorrect',
          'auth/invalid-email': 'Email invalide',
          'auth/user-disabled': 'Compte utilisateur désactivé',
          'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
          'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
        };
        setError(errorMessages[err.code] || 'Erreur lors de la connexion. Veuillez réessayer.');
      } else {
        setError(err.message || 'Failed to sign in. Please check your credentials.');
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
            loadingText="Signing in..."
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