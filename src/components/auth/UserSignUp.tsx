import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { validateUsername } from '@utils/validation/usernameValidation';
import { signUpUser } from '@services/auth/authService';
import { useAuth } from '@contexts/AuthContext';
import { User, Mail, Lock } from 'lucide-react';

/**
 * Composant d'inscription utilisateur (sans entreprise)
 * 
 * Architecture simplifiée : l'utilisateur s'inscrit d'abord,
 * puis peut créer des entreprises via le dashboard Netflix
 */
export const UserSignUp: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Données du formulaire
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Field errors state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};
    let hasErrors = false;

    // Username validation
    if (!formData.username.trim()) {
      errors.username = 'Le nom d\'utilisateur est requis';
      hasErrors = true;
    } else {
      const usernameValidation = validateUsername(formData.username);
      if (!usernameValidation.valid) {
        errors.username = usernameValidation.error || 'Nom d\'utilisateur invalide';
        hasErrors = true;
      }
    }

    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'L\'adresse email est requise';
      hasErrors = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Veuillez entrer une adresse email valide';
      hasErrors = true;
    }

    // Password validation
    if (formData.password.length < 6) {
      errors.password = 'Le mot de passe doit contenir au moins 6 caractères';
      hasErrors = true;
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas';
      hasErrors = true;
    }

    setFieldErrors(errors);
    return !hasErrors;
  };

  /**
   * Gérer la soumission du formulaire
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      
      await signUpUser(formData.email, formData.password, {
        username: formData.username.trim()
      });

      // 2. Se connecter automatiquement
      await signIn(formData.email, formData.password);
      
      // 3. Rediriger vers la page de sélection de mode
      navigate('/mode-selection');
      
    } catch (error: any) {
      setError(error.message || 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Gérer les changements dans le formulaire
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Créer votre compte
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Inscrivez-vous pour accéder à vos entreprises
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Nom d'utilisateur *
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className={`appearance-none block w-full pl-10 pr-3 py-2 border rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    fieldErrors.username ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Kinno Meli"
                />
              </div>
              {fieldErrors.username && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.username}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">3-30 caractères</p>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Adresse email *
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className={`appearance-none block w-full pl-10 pr-3 py-2 border rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    fieldErrors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="jean.dupont@example.com"
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
              )}
            </div>


            {/* Mot de passe */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Mot de passe *
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className={`appearance-none block w-full pl-10 pr-3 py-2 border rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    fieldErrors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="••••••••"
                />
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">Minimum 6 caractères</p>
            </div>

            {/* Confirmation mot de passe */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirmer le mot de passe *
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`appearance-none block w-full pl-10 pr-3 py-2 border rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    fieldErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="••••••••"
                />
              </div>
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            {/* Message d'erreur */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Bouton de soumission */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Création du compte...' : 'Créer mon compte'}
              </button>
            </div>
          </form>

          {/* Lien vers la connexion */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Déjà un compte ?</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <a
                href="/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Se connecter
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Information sur le processus */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
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
    </div>
  );
};

export default UserSignUp;
