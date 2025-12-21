import { useTranslation } from 'react-i18next';
import { Modal } from '@components/common';

interface CalculationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CalculationsModal = ({ isOpen, onClose }: CalculationsModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('dashboard.calculations.title')}
      size="lg"
    >
      <div className="space-y-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.profit.title')}</h3>
          <p className="text-gray-600">
            {t('dashboard.calculations.profit.description')}
            <br /><br />
            {t('dashboard.calculations.profit.formula')}
            <br /><br />
            {t('dashboard.calculations.profit.example')}
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.totalExpenses.title')}</h3>
          <p className="text-gray-600">
            {t('dashboard.calculations.totalExpenses.description')}
            <br /><br />
            {t('dashboard.calculations.totalExpenses.formula')}
            <br /><br />
            {t('dashboard.calculations.totalExpenses.includes')}
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.totalSalesAmount.title')}</h3>
          <p className="text-gray-600">
            {t('dashboard.calculations.totalSalesAmount.description')}
            <br /><br />
            {t('dashboard.calculations.totalSalesAmount.formula')}
            <br /><br />
            {t('dashboard.calculations.totalSalesAmount.note')}
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.totalPurchasePrice.title')}</h3>
          <p className="text-gray-600">
            {t('dashboard.calculations.totalPurchasePrice.description')}
            <br /><br />
            {t('dashboard.calculations.totalPurchasePrice.formula')}
            <br /><br />
            {t('dashboard.calculations.totalPurchasePrice.example')}
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.deliveryFee.title')}</h3>
          <p className="text-gray-600">
            {t('dashboard.calculations.deliveryFee.description')}
            <br /><br />
            {t('dashboard.calculations.deliveryFee.formula')}
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.balance.title')}</h3>
          <p className="text-gray-600">
            {t('dashboard.calculations.balance.description')}
            <br /><br />
            <b>{t('dashboard.calculations.balance.formula')}</b>
            <br /><br />
            {t('dashboard.calculations.balance.note')}
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.totalDebt.title')}</h3>
          <p className="text-gray-600">
            {t('dashboard.calculations.totalDebt.description')}
            <br /><br />
            <b>{t('dashboard.calculations.totalDebt.formula')}</b>
            <br /><br />
            {t('dashboard.calculations.totalDebt.note')}
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.calculations.bestSellingProducts.title')}</h3>
          <p className="text-gray-600">
            {t('dashboard.calculations.bestSellingProducts.description')}
            <br /><br />
            {t('dashboard.calculations.bestSellingProducts.formula')}
            <br /><br />
            {t('dashboard.calculations.bestSellingProducts.note')}
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default CalculationsModal;

