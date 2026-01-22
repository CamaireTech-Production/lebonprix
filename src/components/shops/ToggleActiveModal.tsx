import React from 'react';
import { Modal, ModalFooter } from '@components/common';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import type { Shop, Warehouse } from '../../types/models';

interface ToggleActiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  location: Shop | Warehouse;
  locationType: 'shop' | 'warehouse';
  isActivating: boolean; // true if activating, false if deactivating
  isLoading?: boolean;
}

const ToggleActiveModal: React.FC<ToggleActiveModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  location,
  locationType,
  isActivating,
  isLoading = false
}) => {
  const { t } = useTranslation();

  const locationName = locationType === 'shop' ? t('common.shop') : t('common.warehouse');
  const locationNameLower = locationType === 'shop' ? t('common.shop').toLowerCase() : t('common.warehouse').toLowerCase();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isActivating
          ? t('shops.toggleActiveModal.activateTitle', { name: location.name })
          : t('shops.toggleActiveModal.deactivateTitle', { name: location.name })
      }
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={onConfirm}
          cancelText={t('common.cancel')}
          confirmText={
            isActivating
              ? t('shops.toggleActiveModal.activateConfirm', 'Activer')
              : t('shops.toggleActiveModal.deactivateConfirm', 'Désactiver')
          }
          isLoading={isLoading}
          variant={isActivating ? 'default' : 'danger'}
        />
      }
    >
      <div className="space-y-4">
        {isActivating ? (
          <>
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-green-900 mb-1">
                  {t('shops.toggleActiveModal.activateMessage', {
                    locationName: locationNameLower,
                    name: location.name
                  })}
                </h4>
                <p className="text-sm text-green-700">
                  {t('shops.toggleActiveModal.activateDescription', {
                    locationName: locationNameLower
                  })}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-yellow-900 mb-2">
                  {t('shops.toggleActiveModal.deactivateMessage', {
                    locationName: locationNameLower,
                    name: location.name
                  })}
                </h4>
                <p className="text-sm text-yellow-700 mb-3">
                  {t('shops.toggleActiveModal.deactivateDescription', {
                    locationName: locationNameLower
                  })}
                </p>
                <div className="space-y-2 text-sm text-yellow-800">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      {locationType === 'shop'
                        ? t('shops.toggleActiveModal.impactNoSales', 'Aucune nouvelle vente ne pourra être effectuée depuis ce magasin')
                        : t('shops.toggleActiveModal.impactNoTransfers', 'Aucun nouveau transfert ne pourra être effectué depuis cet entrepôt')}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      {t('shops.toggleActiveModal.impactNoTransfersTo', {
                        locationName: locationNameLower
                      })}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      {t('shops.toggleActiveModal.impactHiddenFromEmployees', {
                        locationName: locationNameLower
                      })}
                    </span>
                  </div>
                  {locationType === 'shop' && (
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>
                        {t('shops.toggleActiveModal.impactNoReplenishment', 'Aucune demande de réapprovisionnement ne pourra être créée depuis ce magasin')}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 mt-2 pt-2 border-t border-yellow-300">
                    <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
                    <span className="text-green-700">
                      {t('shops.toggleActiveModal.stockPreserved', 'Le stock reste associé à cette localisation et sera toujours visible pour les propriétaires')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ToggleActiveModal;

