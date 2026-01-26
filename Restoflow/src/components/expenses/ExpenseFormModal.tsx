import React, { useState, useEffect } from 'react';
import { Upload, X } from 'lucide-react';
import { Modal, Input, Textarea, Button, LoadingSpinner } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useExpenseCategories } from '../../hooks/business/useExpenseCategories';
import { t } from '../../utils/i18n';
import { uploadImage } from '../../services/storage/imageUpload';
import { formatDateForInput, toFirestoreDate, isDateInPast } from '../../utils/dateUtils';
import type { Expense } from '../../types/geskap';
import toast from 'react-hot-toast';

interface ExpenseFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  expense?: Expense | null;
  onClose: () => void;
  onSuccess: () => void;
  restaurantId: string;
  userId: string;
  addExpense: (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Expense>;
  updateExpense: (expenseId: string, data: Partial<Expense>) => Promise<void>;
}

const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  mode,
  expense,
  onClose,
  onSuccess,
  restaurantId,
  userId,
  addExpense,
  updateExpense
}) => {
  const { language } = useLanguage();
  const { categories, addCategory } = useExpenseCategories({ restaurantId });

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    image: '',
    imagePath: ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Load expense data when editing or reset when opening in add mode
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && expense) {
        setFormData({
          description: expense.description || '',
          amount: expense.amount?.toString() || '',
          category: expense.category || '',
          date: formatDateForInput(expense.date || expense.createdAt),
          image: expense.image || '',
          imagePath: expense.imagePath || ''
        });
        setImageFile(null);
      } else {
        // Reset form for add mode
        setFormData({
          description: '',
          amount: '',
          category: categories[0]?.name || '',
          date: new Date().toISOString().split('T')[0],
          image: '',
          imagePath: ''
        });
        setImageFile(null);
      }
    }
  }, [isOpen, mode, expense, categories]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      toast.error(t('invalid_image_file', language) || 'Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error(t('image_too_large', language) || 'Image is too large. Please select an image smaller than 5MB');
      return;
    }

    setImageFile(file);
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setFormData(prev => ({ ...prev, image: previewUrl }));
  };

  const handleRemoveImage = () => {
    if (formData.image && formData.image.startsWith('blob:')) {
      URL.revokeObjectURL(formData.image);
    }
    setFormData(prev => ({ ...prev, image: '', imagePath: '' }));
    setImageFile(null);
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.description?.trim()) {
      toast.error(t('fill_required_fields', language));
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('invalid_amount', language) || 'Amount must be a positive number');
      return;
    }

    if (!formData.category) {
      toast.error(t('category_required', language) || 'Please select a category');
      return;
    }

    if (!formData.date) {
      toast.error(t('date_required', language) || 'Please select a date');
      return;
    }

    const expenseDate = new Date(formData.date + 'T00:00:00');
    if (isDateInPast(expenseDate)) {
      toast.error(t('date_cannot_be_future', language) || 'Date cannot be in the future');
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = formData.image;
      let imagePath = formData.imagePath;

      // Upload new image if one was selected
      if (imageFile) {
        setIsUploadingImage(true);
        try {
          const uploadResult = await uploadImage(
            imageFile,
            `restaurants/${restaurantId}/expenses`,
            {
              restaurantId,
              type: 'dish', // Using dish type for now, can add 'expense' type later
              originalName: imageFile.name,
              description: formData.description
            }
          );
          imageUrl = uploadResult.url;
          imagePath = uploadResult.path;
        } catch (error) {
          console.error('Error uploading image:', error);
          toast.error(t('image_upload_error', language) || 'Failed to upload image. Expense will be saved without image.');
          // Continue without image
        } finally {
          setIsUploadingImage(false);
        }
      }

      const expenseDateObj = toFirestoreDate(expenseDate);

      if (mode === 'add') {
        await addExpense({
          description: formData.description.trim(),
          amount: amount,
          category: formData.category,
          date: expenseDateObj || undefined,
          userId,
          restaurantId,
          isAvailable: true,
          image: imageUrl || undefined,
          imagePath: imagePath || undefined
        });
        toast.success(t('expenses_added', language));
      } else {
        if (!expense?.id) return;
        await updateExpense(expense.id, {
          description: formData.description.trim(),
          amount: amount,
          category: formData.category,
          date: expenseDateObj || undefined,
          image: imageUrl || undefined,
          imagePath: imagePath || undefined
        });
        toast.success(t('expenses_updated', language));
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Error saving expense:', err);
      toast.error(err.message || t('expenses_error', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Clean up preview URL if exists
    if (formData.image && formData.image.startsWith('blob:')) {
      URL.revokeObjectURL(formData.image);
    }
    setImageFile(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === 'add' ? t('add_expense', language) : t('edit_expense', language)}
    >
      <div className="space-y-4">
        <Textarea
          label={`${t('description', language)} *`}
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          placeholder={t('expense_description_placeholder', language)}
          rows={2}
        />

        <Input
          label={`${t('amount', language)} (XAF) *`}
          type="number"
          name="amount"
          value={formData.amount}
          onChange={handleInputChange}
          placeholder="0"
          min="0"
          step="0.01"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('category', language)} *
          </label>
          <select
            name="category"
            value={formData.category}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">{t('select_category', language) || 'Select a category'}</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>

        <Input
          label={`${t('date', language)} *`}
          type="date"
          name="date"
          value={formData.date}
          onChange={handleInputChange}
          max={new Date().toISOString().split('T')[0]}
        />

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('expense_image', language) || 'Expense Image'}
          </label>
          
          {formData.image ? (
            <div className="space-y-3">
              <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-100 border border-gray-300">
                <img
                  src={formData.image}
                  alt="Expense preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="flex items-center space-x-1 text-red-600 hover:text-red-700 text-sm"
              >
                <X size={16} />
                <span>{t('remove_image', language) || 'Remove image'}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
              <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                <Upload className="w-8 h-8 mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">
                  <span className="font-semibold">{t('click_to_upload', language) || 'Click to upload'}</span> {t('or_drag_drop', language) || 'or drag and drop'}
                </p>
                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
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
              <LoadingSpinner />
              <span>{t('uploading_image', language) || 'Uploading image...'}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {t('cancel', language)}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isUploadingImage || !formData.description || !formData.amount || !formData.category}
            loading={isSubmitting}
          >
            {mode === 'add' ? t('add_expense', language) : t('save_changes', language)}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ExpenseFormModal;
