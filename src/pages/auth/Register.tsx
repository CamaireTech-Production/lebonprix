import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { FirebaseError } from 'firebase/app';
import LoadingScreen from '../../components/common/LoadingScreen';
import { signUpUser } from '../../services/authService';

const Register = () => {
  // User form state only
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { currentUser, loading, signOut } = useAuth();
  const navigate = useNavigate();

  // Déconnecter automatiquement l'utilisateur s'il est déjà connecté
  useEffect(() => {
    if (currentUser && !loading) {
      signOut();
    }
  }, [currentUser, loading, signOut]);

  if (loading) {
    return <LoadingScreen />;
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length <= 9) { // Only allow 9 digits after +237
      setPhone(value);
    }
  };

  const validateForm = () => {
    const errors: string[] = [];

    // Required fields validation
    if (!firstname.trim()) {
      errors.push('Le prénom est requis');
    }
    if (!lastname.trim()) {
      errors.push('Le nom est requis');
    }
    if (!email.trim()) {
      errors.push('L\'adresse email est requise');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Veuillez entrer une adresse email valide');
    }
    if (!password) {
      errors.push('Le mot de passe est requis');
    } else if (password.length < 6) {
      errors.push('Le mot de passe doit contenir au moins 6 caractères');
    }
    if (!confirmPassword) {
      errors.push('La confirmation du mot de passe est requise');
    }
    
    if (password !== confirmPassword) {
      errors.push('Les mots de passe ne correspondent pas');
    }
    
    if (!agreeTerms) {
      errors.push('Vous devez accepter les conditions d\'utilisation');
    }

    // Validate phone number format (9 digits after +237) - only if provided
    if (phone && phone.length !== 9) {
      errors.push('Le numéro de téléphone doit contenir 9 chiffres après +237');
    }

    // Validate name length
    if (firstname.length < 2) {
      errors.push('Le prénom doit contenir au moins 2 caractères');
    }
    if (lastname.length < 2) {
      errors.push('Le nom doit contenir au moins 2 caractères');
    }

    // Validate password strength
    if (password && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre');
    }
    
    if (errors.length > 0) {
      setError(errors.join('\n'));
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
      setError('');
      setIsLoading(true);

      const userData = {
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        phone: phone ? `+237${phone}` : undefined
      };

      await signUpUser(email, password, userData);
      // Redirection vers la page de connexion après inscription réussie
      navigate('/auth/login');
    } catch (err) {
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case 'auth/email-already-in-use':
            setError(
              'Cette adresse email est déjà utilisée. ' +
              'Veuillez vous connecter si vous avez déjà un compte, ' +
              'ou utiliser une autre adresse email.'
            );
            break;
          case 'auth/invalid-email':
            setError('L\'adresse email n\'est pas valide');
            break;
          case 'auth/operation-not-allowed':
            setError('L\'inscription par email n\'est pas activée. Veuillez contacter le support.');
            break;
          case 'auth/weak-password':
            setError('Le mot de passe est trop faible. Veuillez utiliser un mot de passe plus fort.');
            break;
          default:
            setError('Une erreur est survenue lors de la création du compte. Veuillez réessayer.');
            console.error('Registration error:', err);
        }
      } else {
        setError('Une erreur inattendue est survenue. Veuillez réessayer.');
        console.error('Unexpected error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Créer votre compte</h2>
      
      {error && (
        <div className="bg-red-50 text-red-800 p-4 rounded-md mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Erreur d'inscription</h3>
              <div className="mt-2 text-sm text-red-700 whitespace-pre-line">
                {error}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Informations personnelles</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Prénom"
              id="firstname"
              name="firstname"
              type="text"
              value={firstname}
              onChange={(e) => setFirstname(e.target.value)}
              required
              helpText="Minimum 2 caractères"
            />
            
            <Input
              label="Nom"
              id="lastname"
              name="lastname"
              type="text"
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
              required
              helpText="Minimum 2 caractères"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Numéro de téléphone
            </label>
            <div className="flex rounded-md shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                +237
              </span>
              <Input
                type="tel"
                name="phone"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="678904568"
                className="flex-1 rounded-l-none"
                helpText="9 chiffres après +237 (optionnel)"
              />
            </div>
          </div>
        </div>

        {/* Account Information Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Informations du compte</h3>
          
          <Input
            label="Email"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            helpText="Une adresse email valide"
          />
          
          <Input
            label="Mot de passe"
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            helpText="Minimum 6 caractères, incluant une majuscule, une minuscule et un chiffre"
          />
          
          <Input
            label="Confirmer le mot de passe"
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="agree-terms"
              name="agreeTerms"
              type="checkbox"
              className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              required
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="agree-terms" className="text-gray-700">
              J'accepte les{' '}
              <a href="#" className="text-indigo-600 hover:text-indigo-500">
                conditions d'utilisation
              </a>
            </label>
          </div>
        </div>
        
        <Button
          type="submit"
          className="w-full"
          isLoading={isLoading}
        >
          Créer mon compte
        </Button>
      </form>
      
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