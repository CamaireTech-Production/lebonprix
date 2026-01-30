// src/pages/expenses/shared/ExpenseFormModal.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X } from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';
import { Modal, ModalFooter, Input, PriceInput, CreatableSelect, ImageWithSkeleton } from '@components/common';
import { createExpense, updateExpense } from '@services/firestore/expenses/expenseService';
import { FirebaseStorageService } from '@services/core/firebaseStorage';
import { syncFinanceEntryWithExpense } from '@services/firestore/finance/financeService';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { logError, logWarning } from '@utils/core/logger';
import { useExpenseCategories } from '@hooks/business/useExpenseCategories';
import { getUserById } from '@services/utilities/userService';
import { getCurrentEmployeeRef } from '@utils/business/employeeUtils';
import imageCompression from 'browser-image-compression';
import type { Expense} from '../../../types/models';

interface ExpenseFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  expense?: Expense;
  onClose: () => void;
  onSuccess: (expense: Expense) => void;
}

const ExpenseFormModal = ({ isOpen, mode, expense, onClose, onSuccess }: ExpenseFormModalProps) => {
  const { t } = useTranslation();
  const { user, company, currentEmployee, isOwner } = useAuth();
  const { expenseTypes, expenseTypesList, createCategory, loadExpenseTypes } = useExpenseCategories();
  
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'transportation',
    date: new Date().toISOString().split('T')[0],
    image: '',
    imagePath: '',
    compressedImageFile: null as File | null,
  });
  const [selectedType, setSelectedType] = useState<{ label: string; value: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Load expense data when editing or reset when opening in add mode
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && expense) {
        // Convert date to string format for input
        let dateValue = new Date().toISOString().split('T')[0];
        if (expense.date?.seconds) {
          dateValue = new Date(expense.date.seconds * 1000).toISOString().split('T')[0];
        } else if (expense.createdAt?.seconds) {
          dateValue = new Date(expense.createdAt.seconds * 1000).toISOString().split('T')[0];
        }
        
        setFormData({
          description: expense.description,
          amount: expense.amount.toString(),
          category: expense.category,
          date: dateValue,
          image: expense.image || '',
          imagePath: expense.imagePath || '',
          compressedImageFile: null,
        });
        setSelectedType({ 
          label: t(`expenses.categories.${expense.category}`, expense.category), 
          value: expense.category 
        });
      } else {
        // Reset form for add mode
        setFormData({
          description: '',
          amount: '',
          category: 'transportation',
          date: new Date().toISOString().split('T')[0],
          image: '',
          imagePath: '',
          compressedImageFile: null,
        });
        setSelectedType(null);
      }
    }
  }, [isOpen, mode, expense, t]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      showErrorToast('Please select a valid image file');
      return;
    }

    // Validate file size before processing (max 10MB before compression)
    const maxSizeBeforeCompression = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeBeforeCompression) {
      showErrorToast('Image is too large. Please select an image smaller than 10MB');
      return;
    }

    setIsUploadingImage(true);
    try {
      console.log('Compressing image:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      // Compress image with more aggressive settings
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.5, // Reduced from 1MB to 0.5MB
        maxWidthOrHeight: 600, // Reduced from 800 to 600
        useWebWorker: true,
        initialQuality: 0.7, // Add quality setting
        fileType: 'image/jpeg' // Force JPEG for better compression
      });

      console.log('Image compressed:', {
        originalSize: file.size,
        compressedSize: compressedFile.size,
        reduction: `${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`
      });

      // Store the compressed file in state (don't upload yet)
      setFormData(prev => ({ 
        ...prev, 
        compressedImageFile: compressedFile,
        image: URL.createObjectURL(compressedFile) // For preview only
      }));
      setIsUploadingImage(false);
    } catch (error) {
      console.error('Error compressing image:', error);
      showErrorToast(`Error processing image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsUploadingImage(false);
    }
  };

  // Remove image
  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, image: '', imagePath: '', compressedImageFile: null }));
  };

  const resetForm = () => {
    setFormData({
      description: '',
      amount: '',
      category: 'transportation',
      date: new Date().toISOString().split('T')[0],
      image: '',
      imagePath: '',
      compressedImageFile: null,
    });
    setSelectedType(null);
  };

  const handleSubmit = async () => {
    if (!user || !company) {
      showErrorToast(t('errors.notAuthenticated'));
      return;
    }

    try {
      const typeValue = selectedType?.value || formData.category;
      
      // Validation
      if (!formData.description?.trim()) {
        showWarningToast(t('errors.fillAllFields') || 'Veuillez remplir tous les champs');
        return;
      }
      
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        showWarningToast('Le montant doit être un nombre positif');
        return;
      }
      
      if (!typeValue) {
        showWarningToast('Veuillez sélectionner une catégorie');
        return;
      }
      
      // Validate category exists
      const categoryExists = expenseTypesList.some(cat => cat.name === typeValue) ||
                             ['transportation', 'purchase', 'other'].includes(typeValue);
      if (!categoryExists) {
        showWarningToast('Catégorie invalide');
        return;
      }
      
      // Validate date
      if (!formData.date) {
        showWarningToast('Veuillez sélectionner une date');
        return;
      }
      
      const expenseDate = new Date(formData.date + 'T00:00:00');
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (expenseDate > today) {
        showWarningToast('La date ne peut pas être dans le futur');
        return;
      }

      setIsSubmitting(true);
      
      if (mode === 'add') {
        // Get createdBy employee reference
        let createdBy = null;
        if (user && company) {
          let userData = null;
          if (isOwner && !currentEmployee) {
            // If owner, fetch user data to create EmployeeRef
            try {
              userData = await getUserById(user.uid);
            } catch (error) {
              logError('Error fetching user data for createdBy', error);
            }
          }
          createdBy = getCurrentEmployeeRef(currentEmployee, user, isOwner, userData);
          
          // Verify createdBy
          if (!createdBy) {
            logWarning('[ExpenseFormModal] createdBy is null');
          }
        }
        
        let imageUrl = '';
        let imagePath = '';
        
        // Upload image first if available
        if (formData.compressedImageFile) {
          try {
            // Validate image size before upload
            const maxSize = 2 * 1024 * 1024; // 2MB
            if (formData.compressedImageFile.size > maxSize) {
              console.warn('Image too large, skipping upload:', formData.compressedImageFile.size);
              showWarningToast('Image is too large. Expense will be created without image.');
            } else {
              const storageService = new FirebaseStorageService();
              // Generate a temporary ID for the upload
              const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              
              console.log('Uploading expense image:', {
                size: formData.compressedImageFile.size,
                type: formData.compressedImageFile.type,
                userId: user.uid,
                companyId: company.id,
                tempId
              });
              
              const uploadResult = await storageService.uploadExpenseImage(
                formData.compressedImageFile,
                user.uid, // Use user.uid, not company.id
                tempId
              );
              imageUrl = uploadResult.url;
              imagePath = uploadResult.path;
              console.log('Image uploaded successfully:', { imageUrl, imagePath });
            }
          } catch (error) {
            console.error('Error uploading image:', error);
            // Log detailed error information
            if (error instanceof Error) {
              if ('code' in error) {
                console.error('Firebase Storage error code:', (error as any).code);
              }
              console.error('Error message:', error.message);
            }
            // Continue without image - don't block expense creation
            showWarningToast('Image upload failed. Expense will be created without image.');
          }
        }
        
        const newExpense = await createExpense({
          description: formData.description.trim(),
          amount: amount,
          category: typeValue,
          userId: user.uid,
          companyId: company.id,
          date: expenseDate as any,
          image: imageUrl,
          imagePath: imagePath,
        }, company.id, createdBy);
        
        // Verify createdBy is in the returned expense
        if (newExpense.createdBy) {
          console.log('[ExpenseFormModal] Expense created with createdBy:', newExpense.createdBy);
        } else {
          logWarning('[ExpenseFormModal] Expense created but createdBy is missing in returned object');
        }
        
        await syncFinanceEntryWithExpense(newExpense);
        resetForm();
        onSuccess(newExpense);
        showSuccessToast(t('expenses.messages.addSuccess'));
      } else {
        // Edit mode
        if (!expense) return;
        
        // Handle new image upload if one was selected
        let imageUrl = formData.image;
        let imagePath = formData.imagePath;
        
        if (formData.compressedImageFile) {
          try {
            const storageService = new FirebaseStorageService();
            const uploadResult = await storageService.uploadExpenseImage(
              formData.compressedImageFile,
              user.uid, // Use user.uid, not company.id
              expense.id
            );
            imageUrl = uploadResult.url;
            imagePath = uploadResult.path;
          } catch (error) {
            console.error('Error uploading new image:', error);
            showErrorToast('Expense updated but image upload failed');
            return;
          }
        }
        
        const transactionDate = expenseDate;
        
        try {
          await updateExpense(expense.id, {
            description: formData.description.trim(),
            amount: amount,
            category: typeValue,
            userId: user.uid,
            date: transactionDate as any,
            image: imageUrl,
            imagePath: imagePath,
          }, company.id);
          
          // Construct updated expense for optimistic update
          const updatedExpense: Expense = {
            ...expense,
            description: formData.description.trim(),
            amount: amount,
            category: typeValue,
            date: expense.date || expense.createdAt, // Keep existing date or createdAt
            image: imageUrl,
            imagePath: imagePath,
            updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
          };
          
          onSuccess(updatedExpense);
          showSuccessToast(t('expenses.messages.updateSuccess'));
        } catch (error) {
          // Rollback would be handled by parent component
          throw error;
        }
      }
      
      handleClose();
    } catch (err) {
      logError(`Failed to ${mode} expense`, err);
      showErrorToast(
        mode === 'add' 
          ? t('expenses.messages.addError')
          : t('expenses.messages.updateError')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form when closing
    if (mode === 'add') {
      resetForm();
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === 'add' ? t('expenses.modals.add.title') : t('expenses.modals.edit.title')}
      footer={
        <ModalFooter 
          onCancel={handleClose}
          onConfirm={handleSubmit}
          confirmText={mode === 'add' ? t('expenses.modals.add.confirm') : t('expenses.modals.edit.confirm')}
          isLoading={isSubmitting}
        />
      }
    >
      <div className="space-y-4">
        <Input
          label={t('expenses.form.description')}
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          required
        />
        
        <PriceInput
          label={t('expenses.form.amount')}
          name="amount"
          value={formData.amount}
          onChange={(e: { target: { name: string; value: string } }) => {
            setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
          }}
          required
        />
        
        <Input
          label={t('expenses.form.date') || 'Date'}
          name="date"
          type="date"
          value={formData.date}
          onChange={handleInputChange}
          required
          max={new Date().toISOString().split('T')[0]}
        />
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('expenses.form.category')}
          </label>
          <CreatableSelect
            value={selectedType}
            onChange={(opt: any) => setSelectedType(opt)}
            options={expenseTypes}
            onCreate={async (name: string) => {
              if (!user || !company) return { label: name, value: name };
              const created = await createCategory(name);
              const option = { label: created.name, value: created.name };
              await loadExpenseTypes();
              return option;
            }}
            placeholder={t('expenses.form.category')}
          />
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Expense Image
          </label>
          
          {formData.image ? (
            <div className="space-y-3">
              <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-100">
                <ImageWithSkeleton
                  src={formData.image}
                  alt="Expense preview"
                  className="w-full h-full object-cover"
                  placeholder="Loading image..."
                />
              </div>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="flex items-center space-x-1 text-red-600 hover:text-red-700 text-sm"
              >
                <X size={16} />
                <span>Remove image</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
              <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                <Upload className="w-8 h-8 mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}
          
          {isUploadingImage && (
            <div className="flex items-center space-x-2 text-sm text-gray-600 mt-2">
              <div className="animate-pulse bg-gray-200 h-4 w-4 rounded-full"></div>
              <span>Uploading image...</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ExpenseFormModal;



