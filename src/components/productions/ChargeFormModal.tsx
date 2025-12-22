// Charge Form Modal for Productions
import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Modal, ModalFooter, Button } from '@components/common';
import { useAuth } from '@contexts/AuthContext';
import { showSuccessToast, showErrorToast, showWarningToast } from '@utils/core/toast';
import { formatPrice } from '@utils/formatting/formatPrice';
import type { ProductionCharge } from '../../types/models';
import { Timestamp } from 'firebase/firestore';

interface ChargeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productionId: string;
  charge?: ProductionCharge | null;
  onSuccess?: () => void;
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
  productionId,
  charge,
  onSuccess
}) => {
  const { user, company } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'other',
    date: new Date().toISOString().split('T')[0]
  });

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
          description: charge.description || '',
          amount: charge.amount?.toString() || '',
          category: charge.category || 'other',
          date: chargeDate.toISOString().split('T')[0]
        });
      } else {
        // Create mode
        setFormData({
          description: '',
          amount: '',
          category: 'other',
          date: new Date().toISOString().split('T')[0]
        });
      }
    }
  }, [isOpen, charge]);

  const handleSubmit = async () => {
    if (!user || !company) return;

    if (!formData.description.trim()) {
      showWarningToast('La description est requise');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      showWarningToast('Le montant doit être supérieur à 0');
      return;
    }

    setIsSubmitting(true);

    try {
      const { createProductionCharge, updateProductionCharge } = await import('@services/firestore/productions/productionChargeService');
      
      const chargeDate = Timestamp.fromDate(new Date(formData.date));
      const amount = parseFloat(formData.amount);

      if (charge) {
        // Update existing charge
        await updateProductionCharge(charge.id, {
          description: formData.description.trim(),
          amount,
          category: formData.category,
          date: chargeDate
        }, company.id);
        showSuccessToast('Charge mise à jour avec succès');
      } else {
        // Create new charge
        await createProductionCharge({
          productionId,
          description: formData.description.trim(),
          amount,
          category: formData.category,
          date: chargeDate,
          userId: user.uid
        }, company.id);
        showSuccessToast('Charge créée avec succès');
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
      size="medium"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Main d'œuvre pour assemblage"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Montant (XAF) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
              min="0"
              step="0.01"
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
      </div>

      <ModalFooter>
        <div className="flex justify-end space-x-3 w-full">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                {charge ? 'Mise à jour...' : 'Création...'}
              </>
            ) : (
              charge ? 'Mettre à jour' : 'Créer'
            )}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
};

export default ChargeFormModal;

