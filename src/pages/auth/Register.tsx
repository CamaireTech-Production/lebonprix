import { useState, FormEvent, ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import { Upload } from 'lucide-react';
import { FirebaseError } from 'firebase/app';

const Register = () => {
  // Company form state
  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyLocation, setCompanyLocation] = useState('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [, setLogoFile] = useState<File | null>(null);

  // User form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length <= 9) { // Only allow 9 digits after +237
      setCompanyPhone(value);
    }
  };

  const validateForm = () => {
    const errors: string[] = [];

    // Required fields validation
    if (!companyName.trim()) {
      errors.push('Le nom de l\'entreprise est requis');
    }
    if (!companyPhone.trim()) {
      errors.push('Le numéro de téléphone est requis');
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

    // Validate phone number format (9 digits after +237)
    if (companyPhone.length !== 9) {
      errors.push('Le numéro de téléphone doit contenir 9 chiffres après +237');
    }

    // Validate company name length
    if (companyName.length < 2) {
      errors.push('Le nom de l\'entreprise doit contenir au moins 2 caractères');
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

      const companyData = {
        name: companyName.trim(),
        description: companyDescription.trim() || undefined,
        phone: `+237${companyPhone}`,
        location: companyLocation.trim() || undefined,
        logo: companyLogo || undefined,
        email: email.trim().toLowerCase()
      };

      await signUp(email, password, companyData);
      navigate('/');
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
        {/* Company Information Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Informations de l'entreprise</h3>
          
          <Input
            label="Nom de l'entreprise"
            id="company-name"
            name="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            helpText="Minimum 2 caractères"
          />
          
          <Textarea
            label="Description de l'entreprise"
            id="company-description"
            name="companyDescription"
            value={companyDescription}
            onChange={(e) => setCompanyDescription(e.target.value)}
            rows={3}
            helpText="Optionnel"
          />
          
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
                name="companyPhone"
                value={companyPhone}
                onChange={handlePhoneChange}
                placeholder="678904568"
                className="flex-1 rounded-l-none"
                required
                helpText="9 chiffres après +237"
              />
            </div>
          </div>
          
          <Input
            label="Adresse"
            id="company-location"
            name="companyLocation"
            type="text"
            value={companyLocation}
            onChange={(e) => setCompanyLocation(e.target.value)}
            helpText="Optionnel"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Logo
            </label>
            <div className="mt-1 flex items-center space-x-4">
              <div className="flex-shrink-0">
                {companyLogo ? (
                  <img
                    src={companyLogo}
                    alt="Company logo preview"
                    className="h-16 w-16 object-cover rounded-lg"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <Upload className="h-6 w-6 text-gray-400" />
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-gray-300 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
            </div>
            <p className="mt-1 text-sm text-gray-500">Optional. Upload your company logo</p>
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
          S'inscrire
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
    </div>
  );
};

export default Register;