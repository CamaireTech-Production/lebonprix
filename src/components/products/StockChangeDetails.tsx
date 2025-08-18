import React from 'react';
import { Badge } from '../common/Badge';
import { format } from 'date-fns';
import type { StockChange } from '../../types/models';

interface StockChangeDetailsProps {
  stockChange: StockChange;
  className?: string;
}

const StockChangeDetails: React.FC<StockChangeDetailsProps> = ({ stockChange, className = '' }) => {
  const getReasonColor = (reason: StockChange['reason']) => {
    switch (reason) {
      case 'sale': return 'error';
      case 'restock': return 'success';
      case 'adjustment': return 'warning';
      case 'damage': return 'error';
      case 'manual_adjustment': return 'warning';
      case 'cost_correction': return 'info';
      case 'creation': return 'success';
      default: return 'default';
    }
  };

  const getReasonLabel = (reason: StockChange['reason']) => {
    switch (reason) {
      case 'sale': return 'Sale';
      case 'restock': return 'Restock';
      case 'adjustment': return 'Adjustment';
      case 'damage': return 'Damage';
      case 'manual_adjustment': return 'Manual Adjustment';
      case 'cost_correction': return 'Cost Correction';
      case 'creation': return 'Creation';
      default: return reason;
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.seconds) return 'N/A';
    return format(new Date(timestamp.seconds * 1000), 'dd/MM/yyyy HH:mm');
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant={getReasonColor(stockChange.reason)}>
            {getReasonLabel(stockChange.reason)}
          </Badge>
          <span className={`font-semibold ${stockChange.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stockChange.change > 0 ? '+' : ''}{stockChange.change} units
          </span>
        </div>
        <span className="text-sm text-gray-500">
          {formatDate(stockChange.createdAt)}
        </span>
      </div>

      {/* Legacy cost price display (for backward compatibility) */}
      {stockChange.costPrice && (
        <div className="mb-3 p-2 bg-gray-50 rounded">
          <span className="text-sm text-gray-600">Legacy Cost Price: </span>
          <span className="font-semibold">{stockChange.costPrice.toLocaleString()} XAF</span>
        </div>
      )}

      {/* Detailed batch consumption information */}
      {stockChange.batchConsumptions && stockChange.batchConsumptions.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-gray-700 mb-2">Batch Consumption Details:</h4>
          {stockChange.batchConsumptions.map((consumption, index) => (
            <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Batch ID: </span>
                  <span className="font-mono text-xs">{consumption.batchId}</span>
                </div>
                <div>
                  <span className="text-gray-600">Cost Price: </span>
                  <span className="font-semibold">{consumption.costPrice.toLocaleString()} XAF</span>
                </div>
                <div>
                  <span className="text-gray-600">Consumed: </span>
                  <span className="font-semibold">{consumption.consumedQuantity} units</span>
                </div>
                <div>
                  <span className="text-gray-600">Remaining: </span>
                  <span className="font-semibold">{consumption.remainingQuantity} units</span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-blue-200">
                <span className="text-gray-600 text-xs">Total Value: </span>
                <span className="font-semibold text-sm">
                  {(consumption.costPrice * consumption.consumedQuantity).toLocaleString()} XAF
                </span>
              </div>
            </div>
          ))}
          
          {/* Summary */}
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
            <div className="text-sm">
              <span className="text-gray-600">Total Consumed: </span>
              <span className="font-semibold">
                {stockChange.batchConsumptions.reduce((sum, c) => sum + c.consumedQuantity, 0)} units
              </span>
              <span className="text-gray-600 ml-4">Total Value: </span>
              <span className="font-semibold">
                {stockChange.batchConsumptions.reduce((sum, c) => sum + (c.costPrice * c.consumedQuantity), 0).toLocaleString()} XAF
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Additional information */}
      {(stockChange.supplierId || stockChange.isOwnPurchase !== undefined || stockChange.isCredit !== undefined) && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {stockChange.supplierId && (
              <div>Supplier ID: {stockChange.supplierId}</div>
            )}
            {stockChange.isOwnPurchase !== undefined && (
              <div>Purchase Type: {stockChange.isOwnPurchase ? 'Own Purchase' : 'From Supplier'}</div>
            )}
            {stockChange.isCredit !== undefined && (
              <div>Payment: {stockChange.isCredit ? 'Credit' : 'Paid'}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StockChangeDetails;
