import React from 'react';
import Modal, { ModalFooter } from '../common/Modal';
import Card from '../common/Card';
import type { Sale, Product, SaleProduct } from '../../types/models';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '@hooks/useCurrency';

interface ProfitDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  products: Product[];
}

const ProfitDetailsModal: React.FC<ProfitDetailsModalProps> = ({ isOpen, onClose, sale, products }) => {
  const { t } = useTranslation();
  const { format } = useCurrency();
  if (!sale) return null;

  // Helper to compute profit per product strictly from runtime data
  const computeProductProfit = (sp: SaleProduct): number => {
    const unitSalePrice = sp.negotiatedPrice ?? sp.basePrice;

    // If batch-level details are present, respect them
    if (sp.batchLevelProfits && sp.batchLevelProfits.length > 0) {
      return sp.batchLevelProfits.reduce(
        (sum, batch) => sum + (unitSalePrice - batch.costPrice) * batch.consumedQuantity,
        0,
      );
    }

    // Fallback – use average cost price stored on the product itself
    return (unitSalePrice - sp.costPrice) * sp.quantity;
  };

  const totalProfit = sale.products.reduce((sum, sp) => sum + computeProductProfit(sp), 0);

  const totalCost = sale.products.reduce((sum, sp) => {
    if (sp.batchLevelProfits && sp.batchLevelProfits.length > 0) {
      return (
        sum +
        sp.batchLevelProfits.reduce(
          (bSum, batch) => bSum + batch.costPrice * batch.consumedQuantity,
          0,
        )
      );
    }
    return sum + sp.costPrice * sp.quantity;
  }, 0);

  const profitMargin = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('sales.modals.profitDetails.title', { defaultValue: 'Profit Details' })}
      size="xl"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={onClose}
          confirmText={t('common.close')}
          cancelText={t('common.close')}
        />
      }
    >
      <div className="space-y-6">
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {t('sales.modals.profitDetails.breakdown', { defaultValue: 'Profit Breakdown' })}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm mb-4">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">
                      {t('products.table.columns.name')}
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">
                      {t('sales.modals.view.products.quantity')}
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">
                      {t('sales.modals.profitDetails.unitPrice', { defaultValue: 'Unit Price' })}
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">
                      {t('sales.modals.profitDetails.totalPrice', { defaultValue: 'Total Price' })}
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">
                      {t('products.table.columns.costPrice')}
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">
                      {t('sales.modals.profitDetails.profit')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sale.products.map((sp, idx) => {
                    const product = products.find(p => p.id === sp.productId);
                    const unitSalePrice = sp.negotiatedPrice ?? sp.basePrice;

                    // Derived values
                    const totalSalePrice = unitSalePrice * sp.quantity;
                    const productProfit = computeProductProfit(sp);

                    return (
                      <React.Fragment key={sp.productId + idx}>
                        <tr className="bg-gray-50">
                          <td className="py-2 px-2 text-gray-900">
                            {product ? product.name : t('sales.table.unknownProduct')}
                          </td>
                          <td className="py-2 px-2 text-gray-900 text-right">{sp.quantity}</td>
                          <td className="py-2 px-2 text-gray-900 text-right">
                            {format(unitSalePrice)}
                          </td>
                          <td className="py-2 px-2 text-gray-900 text-right">
                            {format(totalSalePrice)}
                          </td>
                          <td className="py-2 px-2 text-gray-900 text-right">
                            {format(sp.costPrice)}
                          </td>
                          <td className="py-2 px-2 text-gray-900 text-right">
                            {format(productProfit)}
                          </td>
                        </tr>
                        {sp.batchLevelProfits && sp.batchLevelProfits.length > 0 && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <div className="ml-4 my-2">
                                <div className="font-semibold text-xs text-gray-700 mb-1">
                                  {t('sales.modals.profitDetails.batchConsumptionDetails')}
                                </div>
                                <table className="w-full text-xs border mb-2">
                                  <thead>
                                    <tr>
                                      <th className="text-left py-1 px-2 border-b">{t('sales.modals.profitDetails.batchId')}</th>
                                      <th className="text-right py-1 px-2 border-b">{t('sales.modals.profitDetails.qty')}</th>
                                      <th className="text-right py-1 px-2 border-b">{t('sales.modals.profitDetails.batchCostPrice')}</th>
                                      <th className="text-right py-1 px-2 border-b">{t('sales.modals.profitDetails.salePriceUnit')}</th>
                                      <th className="text-right py-1 px-2 border-b">{t('sales.modals.profitDetails.batchProfit')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sp.batchLevelProfits.map((batch, bidx) => {
                                      const batchProfit =
                                        (unitSalePrice - batch.costPrice) * batch.consumedQuantity;
                                      return (
                                        <tr key={batch.batchId + bidx}>
                                          <td className="py-1 px-2">{batch.batchId}</td>
                                          <td className="py-1 px-2 text-right">{batch.consumedQuantity}</td>
                                          <td className="py-1 px-2 text-right">
                                            {format(batch.costPrice)}
                                          </td>
                                          <td className="py-1 px-2 text-right">
                                            {format(unitSalePrice)}
                                          </td>
                                          <td className="py-1 px-2 text-right">
                                            {format(batchProfit)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                                <div className="text-xs text-gray-600 mb-2">
                                  {t('sales.modals.profitDetails.batchProfitFormula', {
                                    defaultValue: 'Batch Profit = (Sale Price - Batch Cost Price) × Qty',
                                  })}
                                </div>
                                <div className="text-xs text-emerald-700 font-semibold">
                                  {t('sales.modals.profitDetails.productSubtotal', {
                                    defaultValue: 'Product Profit Subtotal:',
                                  })}{' '}
                                  {format(productProfit)}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-2 mt-4">
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">
                  {t('sales.modals.profitDetails.totalProfit', { defaultValue: 'Total Profit' })}:
                </span>
                <span className="font-semibold text-emerald-700">
                  {format(totalProfit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">
                  {t('sales.modals.profitDetails.totalCost', { defaultValue: 'Total Cost' })}:
                </span>
                <span className="font-semibold text-gray-700">
                  {format(totalCost)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">
                  {t('sales.modals.profitDetails.profitMargin', { defaultValue: 'Profit Margin' })}:
                </span>
                <span className="font-semibold text-blue-700">
                  {profitMargin.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Modal>
  );
};

export default ProfitDetailsModal;