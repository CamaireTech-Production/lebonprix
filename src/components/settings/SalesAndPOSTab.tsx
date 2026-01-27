import { Save, RotateCcw, Calculator, ShoppingCart, Settings, AlertTriangle } from 'lucide-react';
import type { CheckoutSettings, CheckoutSettingsUpdate } from '../../types/checkoutSettings';
import type { Company } from '../../types/models';

interface SalesAndPOSTabProps {
  settings: CheckoutSettings | null;
  onUpdateSettings: (updates: CheckoutSettingsUpdate) => void;
  onSaveSettings: () => Promise<void>;
  onResetSettings: () => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
  company: Company | null;
  onUpdateCompany: (updates: Partial<Company>) => Promise<void>;
}

export const SalesAndPOSTab: React.FC<SalesAndPOSTabProps> = ({
  settings,
  onUpdateSettings,
  onSaveSettings,
  onResetSettings,
  isLoading,
  isSaving,
  company,
  onUpdateCompany,
}) => {

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const handleTogglePOSCalculator = (enabled: boolean) => {
    onUpdateSettings({ posCalculatorEnabled: enabled });
  };

  const handleInventoryMethodChange = (method: 'FIFO' | 'LIFO' | 'CMUP') => {
    onUpdateSettings({ defaultInventoryMethod: method });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-emerald-100 p-3 rounded-full">
            <ShoppingCart className="h-8 w-8 text-emerald-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sales & POS Settings</h2>
        <p className="text-gray-600">
          Configure your Point of Sale system and sales preferences
        </p>
      </div>

      {/* POS Configuration Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center mb-6">
          <Calculator className="h-5 w-5 text-emerald-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-800">POS Configuration</h3>
        </div>

        <div className="space-y-6">
          {/* POS Calculator Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center">
                <Calculator className="h-5 w-5 text-gray-600 mr-3" />
                <div>
                  <label className="font-medium text-gray-900">
                    Enable POS Calculator
                  </label>
                  <p className="text-sm text-gray-600 mt-1">
                    Allow users to use a calculator in the POS payment modal for quick calculations
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => handleTogglePOSCalculator(!settings.posCalculatorEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                settings.posCalculatorEnabled ? 'bg-emerald-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.posCalculatorEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Calculator Description */}
          {settings.posCalculatorEnabled && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Calculator className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-emerald-800">
                    Calculator Enabled
                  </h4>
                  <p className="mt-1 text-sm text-emerald-700">
                    Users will see a calculator tab in the POS payment modal, allowing them to perform calculations 
                    for change, discounts, or total amounts before completing the sale.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!settings.posCalculatorEnabled && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Settings className="h-5 w-5 text-amber-600" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-amber-800">
                    Calculator Disabled
                  </h4>
                  <p className="mt-1 text-sm text-amber-700">
                    The calculator will be hidden from the POS payment modal. Users will need to perform 
                    calculations manually or use external tools.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sales Settings Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center mb-6">
          <ShoppingCart className="h-5 w-5 text-emerald-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-800">Sales Settings</h3>
        </div>

        <div className="space-y-6">
          {/* Default Inventory Method Selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Default Inventory Valuation Method
              </label>
              <p className="text-sm text-gray-600 mb-4">
                Choose the default method for calculating cost of goods sold when creating sales. 
                You can override this for individual sales if needed.
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="inventoryMethod"
                  value="FIFO"
                  checked={settings.defaultInventoryMethod === 'FIFO'}
                  onChange={() => handleInventoryMethodChange('FIFO')}
                  className="mt-1 h-4 w-4 text-emerald-600 border-gray-300 focus:ring-emerald-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-900">FIFO</span>
                    <span className="ml-2 text-xs text-gray-500">(First In, First Out)</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Consumes stock from the oldest batches first. Best for products with expiration dates or when you want to use older inventory first.
                  </p>
                </div>
              </label>

              <label className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="inventoryMethod"
                  value="LIFO"
                  checked={settings.defaultInventoryMethod === 'LIFO'}
                  onChange={() => handleInventoryMethodChange('LIFO')}
                  className="mt-1 h-4 w-4 text-emerald-600 border-gray-300 focus:ring-emerald-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-900">LIFO</span>
                    <span className="ml-2 text-xs text-gray-500">(Last In, First Out)</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Consumes stock from the newest batches first. Useful when newer inventory is preferred or for tax purposes in some jurisdictions.
                  </p>
                </div>
              </label>

              <label className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="inventoryMethod"
                  value="CMUP"
                  checked={settings.defaultInventoryMethod === 'CMUP'}
                  onChange={() => handleInventoryMethodChange('CMUP')}
                  className="mt-1 h-4 w-4 text-emerald-600 border-gray-300 focus:ring-emerald-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-900">CMUP</span>
                    <span className="ml-2 text-xs text-gray-500">(Coût Moyen Unitaire Pondéré / Weighted Average Cost)</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Uses the weighted average cost of all available stock batches. Provides a stable cost basis and smooths out price fluctuations.
                  </p>
                </div>
              </label>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Settings className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">
                    Note
                  </h4>
                  <p className="mt-1 text-sm text-blue-700">
                    This setting only affects new sales. Existing sales will keep their original valuation method. 
                    You can change the method for individual sales when creating them.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Management Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center mb-6">
          <AlertTriangle className="h-5 w-5 text-emerald-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-800">Stock Management</h3>
        </div>

        <div className="space-y-6">
          {/* Low Stock Threshold */}
          <div className="space-y-4">
            <div>
              <label htmlFor="lowStockThreshold" className="block text-sm font-medium text-gray-900 mb-2">
                Low Stock Alert Threshold
              </label>
              <p className="text-sm text-gray-600 mb-4">
                Set the minimum stock level that triggers low stock alerts. Products with stock at or below this threshold will generate notifications for managers.
              </p>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <input
                  id="lowStockThreshold"
                  type="number"
                  min="0"
                  step="1"
                  value={company?.lowStockThreshold ?? 10}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10) || 0;
                    onUpdateCompany({ lowStockThreshold: value }).catch(console.error);
                  }}
                  className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  placeholder="10"
                />
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">units</span>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">
                    How it works
                  </h4>
                  <p className="mt-1 text-sm text-blue-700">
                    When a product's stock falls to or below this threshold, managers will receive automatic notifications. 
                    Stock at 0 will trigger a "Rupture de stock" (Out of Stock) alert, while stock above 0 but at or below the threshold will trigger a "Stock faible" (Low Stock) alert.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
        <button
          onClick={onResetSettings}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          <RotateCcw size={16} />
          <span>Reset to Default</span>
        </button>
        
        <button
          onClick={onSaveSettings}
          disabled={isSaving}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <Save size={16} />
          <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>
    </div>
  );
};
