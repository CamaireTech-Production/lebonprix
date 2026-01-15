import { Save, RotateCcw, Calculator, ShoppingCart, Settings } from 'lucide-react';
import type { CheckoutSettings, CheckoutSettingsUpdate } from '../../types/checkoutSettings';

interface SalesAndPOSTabProps {
  settings: CheckoutSettings | null;
  onUpdateSettings: (updates: CheckoutSettingsUpdate) => void;
  onSaveSettings: () => Promise<void>;
  onResetSettings: () => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
}

export const SalesAndPOSTab: React.FC<SalesAndPOSTabProps> = ({
  settings,
  onUpdateSettings,
  onSaveSettings,
  onResetSettings,
  isLoading,
  isSaving,
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

      {/* Additional POS Settings (Future Expansion) */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Settings className="h-5 w-5 text-emerald-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-800">Additional POS Settings</h3>
        </div>
        
        <div className="text-center py-8 text-gray-500">
          <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">
            Additional POS settings will be available in future updates.
          </p>
          <p className="text-xs mt-2">
            Features like inventory management, receipt customization, and more coming soon.
          </p>
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
