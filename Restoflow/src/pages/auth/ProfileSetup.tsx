import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, MapPin, User, Phone, FileText, Upload, X, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ProcessingModal from '../../components/ui/ProcessingModal';
import designSystem from '../../designSystem';
import imageCompression from 'browser-image-compression';

const ProfileSetup: React.FC = () => {
  const navigate = useNavigate();
  const { restaurant, updateRestaurantProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    // Step 1
    restaurantName: restaurant?.name || '',
    managerName: '',
    phone: restaurant?.phone || '',
    address: '',
    
    // Step 2
    mtnNumber: '',
    orangeNumber: '',
    description: '',
    menuFiles: [] as File[],
    logo: null as File | null,
  });

  const [compressedFiles, setCompressedFiles] = useState<File[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(restaurant?.logo || null);
  
  // Processing modal state
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [processingTitle, setProcessingTitle] = useState('');
  const [processingMessage, setProcessingMessage] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentProcessingStep, setCurrentProcessingStep] = useState('');

  // Cleanup object URLs on component unmount
  useEffect(() => {
    return () => {
      formData.menuFiles.forEach(file => {
        if (file && file.type.startsWith('image/')) {
          URL.revokeObjectURL(URL.createObjectURL(file));
        }
      });
    };
  }, [formData.menuFiles]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Utility function to compress files
  const compressFile = async (file: File): Promise<File> => {
    // Only compress images, not PDFs
    if (file.type.startsWith('image/')) {
      try {
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 0.5, // 500KB max
          maxWidthOrHeight: 1024,
          useWebWorker: true,
        });
        console.log(`[File Compression] ${file.name}: ${file.size} -> ${compressedFile.size} bytes`);
        return compressedFile;
      } catch (error) {
        console.error(`[File Compression Error] ${file.name}:`, error);
        return file; // Return original file if compression fails
      }
    }
    return file; // Return original file for non-images
  };

  // Utility function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      
      // Check file sizes (10MB limit)
      const oversizedFiles = files.filter(file => file.size > 10 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        const fileNames = oversizedFiles.map(f => f.name).join(', ');
        toast.error(`Files too large (max 10MB): ${fileNames}. Please choose smaller files.`);
        return;
      }
      
      // Check total file count
      if (formData.menuFiles.length + files.length > 10) {
        toast.error(`Maximum 10 files allowed. You already have ${formData.menuFiles.length} files.`);
        return;
      }
      
      setIsCompressing(true);
      
      try {
        // Compress all files
        const compressedFilesList = await Promise.all(
          files.map(file => compressFile(file))
        );
        
        // Update both original and compressed files
        setFormData(prev => ({ 
          ...prev, 
          menuFiles: [...prev.menuFiles, ...files].slice(0, 10) // Keep original for display
        }));
        setCompressedFiles(prev => [...prev, ...compressedFilesList].slice(0, 10));
        
        toast.success(`Successfully added ${files.length} file(s)`);
      } catch (error) {
        console.error("Error compressing files:", error);
        toast.error("Error processing files. Please try again.");
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const removeFile = (index: number) => {
    // Revoke object URL to prevent memory leaks
    const file = formData.menuFiles[index];
    if (file && file.type.startsWith('image/')) {
      URL.revokeObjectURL(URL.createObjectURL(file));
    }
    
    setFormData(prev => ({
      ...prev,
      menuFiles: prev.menuFiles.filter((_, i) => i !== index)
    }));
    setCompressedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file for the logo');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Logo file size must be less than 5MB');
        return;
      }
      
      setFormData(prev => ({ ...prev, logo: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      toast.success('Logo uploaded successfully');
    }
  };

  const removeLogo = () => {
    setFormData(prev => ({ ...prev, logo: null }));
    setLogoPreview(null);
  };

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.restaurantName.trim()) {
        newErrors.restaurantName = 'Restaurant name is required';
      }
      if (!formData.managerName.trim()) {
        newErrors.managerName = 'Manager/Proprietor name is required';
      }
      if (!formData.phone.trim()) {
        newErrors.phone = 'Phone number is required';
      }
      if (!formData.address.trim()) {
        newErrors.address = 'Address is required';
      }
    }

    if (step === 2) {
      if (!formData.mtnNumber.trim() && !formData.orangeNumber.trim()) {
        newErrors.paymentNumbers = 'At least one payment number (MTN Money or Orange Money) is required';
      }
      // if (!formData.description.trim()) {
      //   newErrors.description = 'Restaurant description is required';
      // }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    console.log('Next button clicked, current step:', currentStep);
    if (validateStep(currentStep)) {
      console.log('Validation passed, moving to next step');
      setCurrentStep(prev => prev + 1);
    } else {
      console.log('Validation failed, staying on current step');
    }
  };

  const handlePrevious = () => {
    console.log('Previous button clicked, current step:', currentStep);
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(2)) {
      return;
    }

    setLoading(true);
    setShowProcessingModal(true);
    setProcessingTitle('Setting up your account...');
    setProcessingMessage('This may take a few moments while we prepare everything for you');
    setProcessingProgress(0);
    setCurrentProcessingStep('');

    try {
      let totalSteps = 0;
      let currentStep = 0;

      // Count total steps
      if (formData.logo) totalSteps++;
      if (formData.menuFiles.length > 0) totalSteps += formData.menuFiles.length;
      totalSteps++; // For saving profile

      // Process logo first
      let logoBase64 = null;
      if (formData.logo) {
        currentStep++;
        setProcessingTitle('Preparing your logo...');
        setProcessingMessage('We\'re optimizing your logo for the best quality');
        setCurrentProcessingStep(`Optimizing: ${formData.logo.name}`);
        setProcessingProgress((currentStep / totalSteps) * 100);
        
        logoBase64 = await fileToBase64(formData.logo);
      }

      // Process menu files with progress feedback
      let menuFilesBase64: string[] = [];
      if (formData.menuFiles.length > 0) {
        setProcessingTitle('Preparing your menu...');
        setProcessingMessage('We\'re getting your menu files ready for your customers');
        
        const filesToConvert = compressedFiles.length > 0 ? compressedFiles : formData.menuFiles;
        
        // Process files one by one to avoid memory issues with large files
        for (let i = 0; i < filesToConvert.length; i++) {
          const file = filesToConvert[i];
          currentStep++;
          setCurrentProcessingStep(`Preparing ${i + 1} of ${filesToConvert.length}: ${file.name}`);
          setProcessingProgress((currentStep / totalSteps) * 100);
          
          try {
            const base64 = await fileToBase64(file);
            menuFilesBase64.push(base64);
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            // Continue with other files even if one fails
          }
        }
      }

      // Update restaurant profile
      currentStep++;
      setProcessingTitle('Almost done...');
      setProcessingMessage('We\'re saving everything securely to your account');
      setCurrentProcessingStep('Saving your information...');
      setProcessingProgress((currentStep / totalSteps) * 100);

      await updateRestaurantProfile({
        name: formData.restaurantName,
        phone: formData.phone,
        address: formData.address,
        description: formData.description,
        logo: logoBase64,
        paymentInfo: {
          mtnMerchantCode: formData.mtnNumber,
          orangeMerchantCode: formData.orangeNumber,
        },
        managerName: formData.managerName,
        menuFiles: menuFilesBase64,
        updatedAt: serverTimestamp(),
      } as any);

      // Show completion
      setProcessingTitle('Welcome to your restaurant!');
      setProcessingMessage('Your account is ready. Taking you to your dashboard...');
      setCurrentProcessingStep('All set! 🎉');
      setProcessingProgress(100);

      // Wait a moment to show completion, then redirect
      setTimeout(() => {
        setShowProcessingModal(false);
        navigate('/dashboard');
      }, 1500);

    } catch (error) {
      console.error('Error updating profile:', error);
      setShowProcessingModal(false);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            
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

            {/* Manager/Proprietor Name */}
            <div>
              <label htmlFor="managerName" className="block text-sm font-medium text-gray-700">
                Manager/Proprietor Name *
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-gray-400" />
                </div>
                <input
                  id="managerName"
                  name="managerName"
                  type="text"
                  required
                  value={formData.managerName}
                  onChange={handleInputChange}
                  className={`pl-10 block w-full py-3 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary ${
                    errors.managerName ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter manager or proprietor name"
                />
              </div>
              {errors.managerName && (
                <p className="mt-1 text-sm text-red-600">{errors.managerName}</p>
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

            {/* Address */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                Address *
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin size={18} className="text-gray-400" />
                </div>
                <input
                  id="address"
                  name="address"
                  type="text"
                  required
                  value={formData.address}
                  onChange={handleInputChange}
                  className={`pl-10 block w-full py-3 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary ${
                    errors.address ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your restaurant address"
                />
              </div>
              {errors.address && (
                <p className="mt-1 text-sm text-red-600">{errors.address}</p>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Payment & Menu Setup</h3>
            
            {/* Logo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Restaurant Logo
              </label>
              <div className="flex items-center space-x-4">
                {logoPreview ? (
                  <div className="relative">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-20 h-20 object-cover rounded-lg border-2 border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={removeLogo}
                      disabled={isCompressing}
                      className={`absolute -top-2 -right-2 text-white rounded-full p-1 transition-colors ${
                        isCompressing 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-red-500 hover:bg-red-600'
                      }`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                    <Store size={24} className="text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <label
                    htmlFor="logo-upload"
                    className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium transition-colors ${
                      isCompressing 
                        ? 'cursor-not-allowed bg-gray-100 text-gray-400 opacity-50' 
                        : 'cursor-pointer text-gray-700 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <Upload size={16} className="mr-2" />
                    {logoPreview ? 'Change Logo' : 'Upload Logo'}
                  </label>
                  <input
                    id="logo-upload"
                    name="logo-upload"
                    type="file"
                    className="sr-only"
                    accept="image/*"
                    disabled={isCompressing}
                    onChange={handleLogoChange}
                  />
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG, GIF up to 5MB</p>
                </div>
              </div>
            </div>
            
            {/* Payment Numbers */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="mtnNumber" className="block text-sm font-medium text-gray-700">
                  MTN Money Number
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <div className="flex items-center px-3 py-3 border border-r-0 border-gray-300 bg-gray-50 rounded-l-md">
                    <Phone size={18} className="text-gray-400 mr-2" />
                    <select
                      className="block appearance-none bg-transparent border-none text-sm font-medium text-gray-700 focus:outline-none"
                      value={'+237'}
                      disabled
                    >
                      <option value="+237">🇨🇲 +237</option>
                    </select>
                  </div>
                  <input
                    id="mtnNumber"
                    name="mtnNumber"
                    type="tel"
                    value={formData.mtnNumber}
                    onChange={handleInputChange}
                    className="flex-1 block py-3 border border-gray-300 rounded-r-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary px-3"
                    placeholder="Enter MTN Money number"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="orangeNumber" className="block text-sm font-medium text-gray-700">
                  Orange Money Number
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <div className="flex items-center px-3 py-3 border border-r-0 border-gray-300 bg-gray-50 rounded-l-md">
                    <Phone size={18} className="text-gray-400 mr-2" />
                    <select
                      className="block appearance-none bg-transparent border-none text-sm font-medium text-gray-700 focus:outline-none"
                      value={'+237'}
                      disabled
                    >
                      <option value="+237">🇨🇲 +237</option>
                    </select>
                  </div>
                  <input
                    id="orangeNumber"
                    name="orangeNumber"
                    type="tel"
                    value={formData.orangeNumber}
                    onChange={handleInputChange}
                    className="flex-1 block py-3 border border-gray-300 rounded-r-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary px-3"
                    placeholder="Enter Orange Money number"
                  />
                </div>
              </div>
            </div>

            {errors.paymentNumbers && (
              <p className="text-sm text-red-600">{errors.paymentNumbers}</p>
            )}

            {/* Menu Import */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Import Current Menu (PDF or Images)
              </label>
              <label
                htmlFor="menu-upload"
                className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md transition-colors ${
                  isCompressing 
                    ? 'cursor-not-allowed bg-gray-100 opacity-50' 
                    : 'cursor-pointer hover:border-gray-400'
                }`}
              >
                <div className="space-y-1 text-center">
                  <Upload size={48} className="mx-auto text-gray-400" />
                  <div className="text-sm text-gray-600">
                    <span className="font-medium text-primary hover:text-primary-dark">Click to upload menu files</span>
                    <span className="text-gray-500"> or drag and drop</span>
                  </div>
                  <p className="text-xs text-gray-500">PDF, JPG, PNG, GIF up to 10MB each (max 10 files)</p>
                </div>
                <input
                  id="menu-upload"
                  name="menu-upload"
                  type="file"
                  className="sr-only"
                  accept=".pdf,.jpg,.jpeg,.png,.gif"
                  multiple
                  disabled={isCompressing}
                  onChange={handleFileChange}
                />
              </label>
              {isCompressing && (
                <div className="mt-2 text-center">
                  <div className="flex items-center justify-center text-sm text-gray-600">
                    <LoadingSpinner size={16} />
                    <span className="ml-2">Compressing files...</span>
                  </div>
                </div>
              )}

              {/* File Preview */}
              {formData.menuFiles.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Uploaded Files ({formData.menuFiles.length})
                  </h4>
                  <div className="relative">
                    <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    {formData.menuFiles.map((file, index) => (
                      <div key={index} className="flex-shrink-0 relative group">
                        <div className="w-24 h-24 border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                          {file.type === 'application/pdf' ? (
                            <div className="flex flex-col items-center">
                              <FileText size={32} className="text-red-500" />
                              <span className="text-xs text-gray-500 mt-1">PDF</span>
                            </div>
                          ) : file.type.startsWith('image/') ? (
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center">
                              <FileText size={32} className="text-gray-400" />
                              <span className="text-xs text-gray-500 mt-1">
                                {file.name.split('.').pop()?.toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* File info overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="text-center text-white">
                            <p className="text-xs font-medium truncate px-1">{file.name}</p>
                            <p className="text-xs">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                              {compressedFiles[index] && compressedFiles[index].size !== file.size && (
                                <span className="text-green-300 ml-1">
                                  → {(compressedFiles[index].size / 1024 / 1024).toFixed(2)} MB
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        
                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          disabled={isCompressing}
                          className={`absolute -top-2 -right-2 w-6 h-6 text-white rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 ${
                            isCompressing 
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-red-500 hover:bg-red-600'
                          }`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    </div>
                    {/* Scroll indicator */}
                    {formData.menuFiles.length > 4 && (
                      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none"></div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Restaurant Description
                </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute top-3 left-3 pointer-events-none">
                  <FileText size={18} className="text-gray-400" />
                </div>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleInputChange}
                  className={`pl-10 block w-full py-3 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary ${
                    errors.description ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Describe your restaurant, specialties, and what makes it unique..."
                />
              </div>
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="flex justify-center">
          <Store size={48} className="text-primary" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Complete Your Profile
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Set up your restaurant profile in 2 simple steps
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Step {currentStep} of 2</span>
              <span className="text-sm text-gray-500">{Math.round((currentStep / 2) * 100)}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / 2) * 100}%` }}
              ></div>
            </div>
          </div>

          <form onSubmit={(e) => e.preventDefault()}>
            {renderStep()}

            {/* Navigation Buttons */}
            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                title={`Current step: ${currentStep}`}
              >
                <ArrowLeft size={16} className="mr-2" />
                Previous
              </button>

              {currentStep < 2 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isCompressing}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCompressing ? (
                    <div className="flex items-center">
                      <LoadingSpinner size={16} />
                      <span className="ml-2">Processing Files...</span>
                    </div>
                  ) : (
                    <>
                      Next
                      <ArrowRight size={16} className="ml-2" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || isCompressing}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <LoadingSpinner size={20} />
                      <span className="ml-2">Completing Setup...</span>
                    </div>
                  ) : isCompressing ? (
                    <div className="flex items-center">
                      <LoadingSpinner size={20} />
                      <span className="ml-2">Processing Files...</span>
                    </div>
                  ) : (
                    'Complete Setup'
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Processing Modal */}
      <ProcessingModal
        isVisible={showProcessingModal}
        title={processingTitle}
        message={processingMessage}
        progress={processingProgress}
        currentStep={currentProcessingStep}
        totalSteps={formData.menuFiles.length + (formData.logo ? 1 : 0) + 1}
      />
    </div>
  );
};

export default ProfileSetup;