import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChefHat, Eye, EyeOff, Store } from 'lucide-react';
import { getAuth, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import designSystem from '../../designSystem';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    restaurantName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateStep = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.restaurantName.trim()) {
      newErrors.restaurantName = 'Restaurant name is required';
    }
    if (formData.email.trim() && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    try {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      
      
      // Check if restaurant document already exists
      const db = getFirestore();
      const restaurantRef = doc(db, 'restaurants', userCredential.user.uid);
      const existingRestaurant = await getDoc(restaurantRef);
      
      if (existingRestaurant.exists()) {
        // Restaurant account already exists, redirect to profile setup
        toast.success('Account found! Please complete your profile setup.');
        navigate('/profile-setup');
        return;
      }
      
      // Create restaurant document with minimal data
      const restaurantData = {
        email: userCredential.user.email,
        name: '', // Will be filled in profile setup
        phone: '', // Will be filled in profile setup
        address: '',
        description: '',
        currency: 'XAF',
        deliveryFee: 0,
        logo: '',
        primaryColor: '#8B0000',
        secondaryColor: '#FFFFFF',
        mtnMerchantCode: '',
        orangeMerchantCode: '',
        paymentLink: '',
        isVerified: false, // New accounts require verification
        verificationStatus: 'pending', // Set to pending for admin review
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      await setDoc(restaurantRef, restaurantData);
      
      toast.success('Account created successfully! Your account is pending verification. Please complete your profile setup.');
      
      // Redirect to profile setup
      navigate('/profile-setup');
    } catch (error: unknown) {
      console.error('Google sign-up error:', error);
      let errorMessage = 'Failed to sign up with Google';
      
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string };
        if (firebaseError.code === 'auth/popup-closed-by-user') {
          errorMessage = 'Sign-up cancelled';
        } else if (firebaseError.code === 'auth/popup-blocked') {
          errorMessage = 'Popup blocked. Please allow popups for this site.';
        } else if (firebaseError.code === 'auth/email-already-in-use') {
          errorMessage = 'An account with this email already exists. Please try logging in instead.';
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate the form
    if (!validateStep()) {
      return;
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const db = getFirestore();

      // Generate a temporary email if none provided
      const email = formData.email.trim() || `${formData.phone.replace(/\D/g, '')}@temp.restaurant.local`;

      // Create Firebase Auth user with email/password
      const userCredential = await createUserWithEmailAndPassword(auth, email, formData.password);
      
      // Create restaurant document in Firestore
      const restaurantData = {
        email: formData.email.trim() || '', // Store actual email or empty string
        name: formData.restaurantName, // Use 'name' field to match Restaurant interface
        phone: formData.phone,
        address: '',
        description: '',
        currency: 'XAF',
        deliveryFee: 0,
        logo: '',
        primaryColor: '#8B0000',
        secondaryColor: '#FFFFFF',
        mtnMerchantCode: '',
        orangeMerchantCode: '',
        paymentLink: '',
        isVerified: false, // New accounts require verification
        verificationStatus: 'pending', // Set to pending for admin review
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'restaurants', userCredential.user.uid), restaurantData);

      toast.success('Restaurant account created successfully! Your account is pending verification. Please complete your profile setup.', {
        style: {
          background: designSystem.colors.success,
          color: designSystem.colors.textInverse,
        },
      });

      // Redirect to profile setup
      navigate('/profile-setup');
    } catch (error: unknown) {
      console.error('Registration error:', error);
      let errorMessage = 'Failed to create restaurant account';
      
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string };
        if (firebaseError.code === 'auth/email-already-in-use') {
          errorMessage = 'An account with this email already exists';
        } else if (firebaseError.code === 'auth/invalid-email') {
          errorMessage = 'Please enter a valid email address';
        } else if (firebaseError.code === 'auth/weak-password') {
          errorMessage = 'Password is too weak. Please use a stronger password';
        }
      }
      
      toast.error(errorMessage, {
        style: {
          background: designSystem.colors.error,
          color: designSystem.colors.textInverse,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <ChefHat size={48} className="text-primary" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create Your Restaurant Account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Get started with your restaurant in just a few steps
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Google Sign-up Option */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                Continue with Google
              </button>
              
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or register with email</span>
                </div>
              </div>
            </div>
            
            {/* Restaurant Name */}
            <div>
              <label htmlFor="restaurantName" className="block text-sm font-medium text-gray-700">
                Restaurant Name *
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Store size={18} className="text-gray-400" />
                </div>
                <input
                  id="restaurantName"
                  name="restaurantName"
                  type="text"
                  required
                  value={formData.restaurantName}
                  onChange={handleInputChange}
                  className={`pl-10 block w-full py-3 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary ${
                    errors.restaurantName ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your restaurant name"
                />
              </div>
              {errors.restaurantName && (
                <p className="mt-1 text-sm text-red-600">{errors.restaurantName}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address (Optional)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <ChefHat size={18} className="text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`pl-10 block w-full py-3 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your email address (optional)"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password *
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`block w-full px-3 py-3 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} className="text-gray-400" /> : <Eye size={20} className="text-gray-400" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password *
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`block w-full px-3 py-3 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary ${
                    errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={20} className="text-gray-400" /> : <Eye size={20} className="text-gray-400" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number *
              </label>
              <div className="mt-1 relative rounded-md shadow-sm flex">
                <select
                  className="block appearance-none w-24 py-3 pl-3 pr-8 border border-gray-300 bg-white rounded-l-md shadow-sm focus:ring-primary focus:border-primary"
                  value={'+237'}
                  disabled
                >
                  <option value="+237">🇨🇲 +237</option>
                </select>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={`block w-full py-3 border-t border-b border-r border-gray-300 rounded-r-md shadow-sm focus:ring-primary focus:border-primary px-3 ${
                    errors.phone ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your phone number"
                />
              </div>
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
              )}
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <LoadingSpinner size={20} />
                    <span className="ml-2">Creating Account...</span>
                  </div>
                ) : (
                  'Create Restaurant Account'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-primary hover:text-primary-dark">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;