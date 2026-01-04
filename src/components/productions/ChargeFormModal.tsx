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
    name: '',
    description: '',
    amount: '',
    category: 'other',
    date: new Date().toISOString().split('T')[0],
    isActive: true
  });

  // Determine charge type (from prop, existing charge, or default)
  const chargeType = charge?.type || type;

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
          name: charge.name || charge.description || '',
          description: charge.description || '',
          amount: charge.amount?.toString() || '',
          category: charge.category || 'other',
          date: chargeDate.toISOString().split('T')[0],
          isActive: charge.isActive !== false
        });
      } else {
        // Create mode
        setFormData({
          name: '',
          description: '',
          amount: '',
          category: 'other',
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
      const name = formData.name.trim() || formData.description.trim();
      const description = formData.description.trim() || formData.name.trim();

      if (charge) {
        // Update existing charge
        await updateCharge(charge.id, {
          name,
          description,
          amount,
          category: formData.category,
          date: chargeDate,
          isActive: chargeType === 'fixed' ? formData.isActive : undefined
        });
        showSuccessToast('Charge mise à jour avec succès');
      } else {
        // Create new charge
        const newCharge = await addCharge({
          type: chargeType,
          name,
          description,
          amount,
          category: formData.category,
          date: chargeDate,
          isActive: chargeType === 'fixed' ? formData.isActive : undefined,
          userId: user.uid
        });
        showSuccessToast(`Charge ${chargeType === 'fixed' ? 'fixe' : 'personnalisée'} créée avec succès`);
        
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
      title={charge ? 'Modifier la charge' : (chargeType === 'fixed' ? 'Nouvelle charge fixe' : 'Nouvelle charge personnalisée')}
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
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder={chargeType === 'fixed' ? "Ex: Coût d'électricité mensuel" : "Ex: Main d'œuvre pour assemblage"}
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
              Catégorie <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
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
