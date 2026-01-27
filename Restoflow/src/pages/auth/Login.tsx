import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import { Mail, Lock, ChefHat, AlertCircle, Eye, EyeOff } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { signIn, signInWithGoogle } = useAuth();
  const { language } = useLanguage();

  // Auto-detect browser language if not set
  React.useEffect(() => {
    if (!language) {
      // You can add logic here to set the detected language
    }
  }, [language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signIn(email, password);
      toast.success(t('login_successful', language));
    } catch (error: unknown) {
      console.log('Login error caught:', error);
      let errorMessage = t('login_failed', language);
      
      // Handle specific error codes and messages
      if (error && typeof error === 'object' && 'message' in error) {
        const customError = error as { message: string; code?: string };
        if (customError.message === 'NO_RESTAURANT_ACCOUNT') {
          errorMessage = 'No account found. Please verify your credentials or contact your restaurant manager if you are an employee.';
        } else if (customError.message === 'RESTAURANT_ACCOUNT_DELETED') {
          errorMessage = t('restaurant_account_deleted', language);
        } else if (customError.message === 'RESTAURANT_ACCOUNT_DISABLED') {
          errorMessage = 'Your account has been disabled. Please contact support for assistance.';
        } else if (customError.message === 'ACCOUNT_NOT_FOUND') {
          errorMessage = 'No account found with this email. Please create an account first.';
        } else if (customError.message === 'INVALID_CREDENTIALS') {
          errorMessage = 'Invalid email or password. Please check your credentials.';
        } else if (customError.message === 'EMPLOYEE_ACCOUNT_DISABLED') {
          errorMessage = 'Your employee account has been disabled. Please contact your restaurant manager.';
        } else if (customError.code === 'auth/invalid-credential' || customError.code === 'auth/wrong-password') {
          errorMessage = t('invalid_credentials', language);
        } else if (customError.code === 'auth/user-not-found') {
          errorMessage = 'No account found with this email. Please create an account first.';
        } else if (customError.code === 'auth/network-request-failed') {
          errorMessage = t('network_error', language);
        }
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);

    try {
      await signInWithGoogle();
      toast.success(t('login_successful', language));
    } catch (error: unknown) {
      console.log('Google sign-in error caught:', error);
      let errorMessage = t('login_failed', language);
      
      // Handle specific error messages
      if (error && typeof error === 'object' && 'message' in error) {
        const customError = error as { message: string; code?: string };
        if (customError.message === 'NO_RESTAURANT_ACCOUNT') {
          errorMessage = 'No restaurant account found. You will be redirected to complete your registration.';
          // Redirect to register page after a short delay
          setTimeout(() => {
            window.location.href = '/register';
          }, 3000);
        } else if (customError.message === 'RESTAURANT_ACCOUNT_DELETED') {
          errorMessage = t('restaurant_account_deleted', language);
        } else if (customError.message === 'RESTAURANT_ACCOUNT_DISABLED') {
          errorMessage = 'Your account has been disabled. Please contact support for assistance.';
        } else if (customError.message === 'ACCOUNT_NOT_FOUND') {
          errorMessage = 'No account found with this email. Please create an account first.';
        } else if (customError.message === 'EMPLOYEE_ACCOUNT_DISABLED') {
          errorMessage = 'Your employee account has been disabled. Please contact your restaurant manager.';
        } else if (customError.code === 'auth/popup-closed-by-user') {
          errorMessage = t('sign_in_cancelled', language);
        } else if (customError.code === 'auth/popup-blocked') {
          errorMessage = t('sign_in_popup_blocked', language);
        } else if (customError.code === 'auth/network-request-failed') {
          errorMessage = t('network_error', language);
        }
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <ChefHat size={48} className="text-primary" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Restaurant Management System
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Sign in to your restaurant account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-md">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <span>{error}</span>
                {(error.includes('No account found') || error.includes('No restaurant account found')) && (
                  <div className="mt-2">
                    <Link 
                      to="/register" 
                      className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-500 underline"
                    >
                      Create your restaurant account now
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={18} className="text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 block w-full py-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="restaurant@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 block w-full py-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="flex justify-end mt-2">
                                  <a
                    href="/reset-password"
                    className="text-sm text-primary hover:underline focus:outline-none"
                  >
                    {t('forgot_password', language)}
                  </a>
              </div>
            </div>

            <div className="space-y-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? t('signing_in', language) : t('sign_in', language)}
              </button>
              
              
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">{t('or_continue_with', language)}</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                                 {t('google_sign_in', language)}
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have a restaurant account?{' '}
              <Link to="/register" className="font-medium text-primary hover:text-primary-dark underline">
                Create one here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;