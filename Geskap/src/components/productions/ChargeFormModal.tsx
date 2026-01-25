// Charge Form Modal - Unified for both fixed and custom charges
import React, { useState, useEffect } from 'react';
import { Modal, ModalFooter, PriceInput } from '@components/common';
import { useAuth } from '@contexts/AuthContext';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { useCharges } from '@hooks/data/useFirestore';
import type { Charge } from '../../types/models';
import { Timestamp } from 'firebase/firestore';

interface ChargeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  charge?: Charge | null;
  type?: 'fixed' | 'custom'; // Charge type (for new charges)
  onSuccess?: () => void;
  onChargeCreated?: (charge: Charge) => void; // Callback when a new charge is created
}

const CHARGE_CATEGORIES = [
  'main_oeuvre', // Main d'œuvre
  'overhead', // Frais généraux
  'transport', // Transport
  'packaging', // Emballage
  'utilities', // Services publics
  'equipment', // Équipement
  'other' // Autre
];

const CHARGE_CATEGORY_LABELS: Record<string, string> = {
  main_oeuvre: 'Main d\'œuvre',
  overhead: 'Frais généraux',
  transport: 'Transport',
  packaging: 'Emballage',
  utilities: 'Services publics',
  equipment: 'Équipement',
  other: 'Autre'
};

const ChargeFormModal: React.FC<ChargeFormModalProps> = ({
  isOpen,
  onClose,
  charge,
  type = 'custom', // Default to custom if not specified
  onSuccess,
  onChargeCreated
}) => {
  const { user, company } = useAuth();
  const { addCharge, updateCharge } = useCharges();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: type || 'custom', // Allow type selection for new charges
    name: '',
    description: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    isActive: true
  });

  // Determine charge type (from existing charge or form selection)
  const chargeType = charge?.type || formData.type;

  useEffect(() => {
    if (isOpen) {
      if (charge) {
        // Edit mode
        const chargeDate = charge.date
          ? (charge.date instanceof Date
              ? charge.date
              : charge.date.seconds
              ? new Date(charge.date.seconds * 1000)
              : new Date())
          : new Date();
        
        setFormData({
          type: charge.type || 'custom',
          name: charge.name || charge.description || '',
          description: charge.description || '',
          amount: charge.amount?.toString() || '',
          category: charge.category || '',
          date: chargeDate.toISOString().split('T')[0],
          isActive: charge.isActive !== false
        });
      } else {
        // Create mode - reset to default
        setFormData({
          type: type || 'custom',
          name: '',
          description: '',
          amount: '',
          category: '',
          date: new Date().toISOString().split('T')[0],
          isActive: true
        });
      }
    }
  }, [isOpen, charge]);

  const handleSubmit = async () => {
    if (!user || !company) return;

    if (!formData.name.trim() && !formData.description.trim()) {
      showWarningToast('Le nom ou la description est requis');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      showWarningToast('Le montant doit être supérieur à 0');
      return;
    }

    setIsSubmitting(true);

    try {
      const chargeDate = Timestamp.fromDate(new Date(formData.date));
      const amount = parseFloat(formData.amount);
      const name = formData.name.trim() || formData.description.trim() || '';
      const description = formData.description.trim() || undefined;
      const category = formData.category.trim() || undefined; // Optional - service will default to 'other' if empty

      if (charge) {
        // Update existing charge
        const updateData: any = {
          name,
          amount,
          date: chargeDate,
          isActive: chargeType === 'fixed' ? formData.isActive : undefined
        };
        
        // Only include description if provided
        if (description) {
          updateData.description = description;
        }
        
        // Only include category if provided
        if (category) {
          updateData.category = category;
        }
        
        await updateCharge(charge.id, updateData);
        showSuccessToast('Charge mise à jour avec succès');
      } else {
        // Create new charge - build object without undefined values
        const chargeData: any = {
          type: formData.type,
          name,
          amount,
          date: chargeDate,
          isActive: formData.type === 'fixed' ? formData.isActive : undefined,
          userId: user.uid
        };

        // Only include description if it has a value
        if (description) {
          chargeData.description = description;
        }

        // Only include category if it has a value
        if (category) {
          chargeData.category = category;
        }

        const newCharge = await addCharge(chargeData);
        showSuccessToast(`Charge ${formData.type === 'fixed' ? 'fixe' : 'personnalisée'} créée avec succès`);
        
        // Call onChargeCreated callback if provided
        if (onChargeCreated) {
          onChargeCreated(newCharge);
        }
      }

      onClose();
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Error saving charge:', error);
      showErrorToast(error.message || 'Erreur lors de la sauvegarde de la charge');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={charge ? 'Modifier la charge' : 'Nouvelle charge'}
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleSubmit}
          cancelText="Annuler"
          confirmText={charge ? 'Mettre à jour' : 'Créer'}
          isLoading={isSubmitting}
          disabled={isSubmitting || (!formData.name.trim() && !formData.description.trim()) || !formData.amount || parseFloat(formData.amount) <= 0}
        />
      }
    >
      <div className="space-y-4">
        {!charge && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type de charge <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'fixed' | 'custom' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="fixed">Charge fixe (réutilisable)</option>
              <option value="custom">Charge personnalisée</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {formData.type === 'fixed' 
                ? 'Les charges fixes peuvent être réutilisées dans plusieurs productions'
                : 'Les charges personnalisées sont spécifiques à une production'}
            </p>
          </div>
        )}

        {chargeType === 'fixed' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Électricité mensuelle"
            />
            <p className="text-xs text-gray-500 mt-1">Nom de la charge fixe (réutilisable)</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder={chargeType === 'fixed' ? "Ex: Coût d'électricité mensuel (optionnel)" : "Ex: Main d'œuvre pour assemblage (optionnel)"}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <PriceInput
              label="Montant (XAF) *"
              name="amount"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              allowDecimals={false}
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catégorie
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Aucune catégorie</option>
              {CHARGE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {CHARGE_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {chargeType === 'fixed' && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
              Actif (visible pour sélection dans les productions)
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ChargeFormModal;
