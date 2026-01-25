import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Delete, RotateCcw } from 'lucide-react';

interface POSCalculatorProps {
  onApplyValue?: (value: number) => void;
  initialValue?: number;
}

export const POSCalculator: React.FC<POSCalculatorProps> = ({
  onApplyValue,
  initialValue = 0,
}) => {
  const { t } = useTranslation();
  const { company } = useAuth();
  const [display, setDisplay] = useState<string>('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  // Get company colors
  const colors = company?.dashboardColors || {
    primary: '#10B981',
    secondary: '#059669',
  };

  useEffect(() => {
    if (initialValue && initialValue > 0) {
      setDisplay(initialValue.toString());
    }
  }, [initialValue]);

  const handleNumber = (num: string) => {
    if (display === '0' || display === 'Error') {
      setDisplay(num);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOperation = (op: string) => {
    if (display === 'Error') return;

    const currentValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(currentValue);
      setDisplay('0');
      setOperation(op);
    } else {
      const result = calculate(previousValue, currentValue, operation);
      if (result !== null) {
        setPreviousValue(result);
        setDisplay('0');
        setOperation(op);
        setHistory(prev => [...prev, `${previousValue} ${operation} ${currentValue} = ${result}`]);
      }
    }
  };

  const calculate = (prev: number, current: number, op: string | null): number | null => {
    if (!op) return current;

    switch (op) {
      case '+':
        return prev + current;
      case '-':
        return prev - current;
      case '*':
        return prev * current;
      case '/':
        if (current === 0) {
          setDisplay('Error');
          return null;
        }
        return prev / current;
      default:
        return current;
    }
  };

  const handleEquals = () => {
    if (display === 'Error' || previousValue === null || !operation) return;

    const currentValue = parseFloat(display);
    const result = calculate(previousValue, currentValue, operation);

    if (result !== null) {
      setDisplay(result.toString());
      setHistory(prev => [...prev, `${previousValue} ${operation} ${currentValue} = ${result}`]);
      setPreviousValue(null);
      setOperation(null);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
  };

  const handleClearAll = () => {
    handleClear();
    setHistory([]);
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const handleApply = () => {
    const value = parseFloat(display);
    if (!isNaN(value) && value >= 0 && onApplyValue) {
      onApplyValue(value);
    }
  };

  const handleDecimal = () => {
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Display */}
      <div className="bg-gray-900 text-white p-4 rounded-t-lg mb-2">
        <div className="text-right">
          <div className="text-2xl font-bold font-mono min-h-[2rem] break-all">
            {display}
          </div>
          {previousValue !== null && operation && (
            <div className="text-sm text-gray-400 mt-1">
              {previousValue} {operation}
            </div>
          )}
        </div>
      </div>

      {/* Calculator Buttons */}
      <div className="grid grid-cols-4 gap-2 flex-1">
        {/* Row 1 */}
        <button
          onClick={handleClearAll}
          className="col-span-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-4 rounded-lg transition-colors text-lg flex items-center justify-center space-x-2"
        >
          <RotateCcw size={20} />
          <span>{t('pos.calculator.clearAll')}</span>
        </button>
        <button
          onClick={handleBackspace}
          className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-4 rounded-lg transition-colors text-lg flex items-center justify-center"
        >
          <Delete size={20} />
        </button>
        <button
          onClick={() => handleOperation('/')}
          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-4 rounded-lg transition-colors text-xl"
          style={{ backgroundColor: colors.secondary }}
        >
          ÷
        </button>

        {/* Row 2 */}
        <button
          onClick={() => handleNumber('7')}
          className="bg-gray-200 hover:bg-gray-300 font-semibold py-4 rounded-lg transition-colors text-xl"
        >
          7
        </button>
        <button
          onClick={() => handleNumber('8')}
          className="bg-gray-200 hover:bg-gray-300 font-semibold py-4 rounded-lg transition-colors text-xl"
        >
          8
        </button>
        <button
          onClick={() => handleNumber('9')}
          className="bg-gray-200 hover:bg-gray-300 font-semibold py-4 rounded-lg transition-colors text-xl"
        >
          9
        </button>
        <button
          onClick={() => handleOperation('*')}
          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-4 rounded-lg transition-colors text-xl"
          style={{ backgroundColor: colors.secondary }}
        >
          ×
        </button>

        {/* Row 3 */}
        <button
          onClick={() => handleNumber('4')}
          className="bg-gray-200 hover:bg-gray-300 font-semibold py-4 rounded-lg transition-colors text-xl"
        >
          4
        </button>
        <button
          onClick={() => handleNumber('5')}
          className="bg-gray-200 hover:bg-gray-300 font-semibold py-4 rounded-lg transition-colors text-xl"
        >
          5
        </button>
        <button
          onClick={() => handleNumber('6')}
          className="bg-gray-200 hover:bg-gray-300 font-semibold py-4 rounded-lg transition-colors text-xl"
        >
          6
        </button>
        <button
          onClick={() => handleOperation('-')}
          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-4 rounded-lg transition-colors text-xl"
          style={{ backgroundColor: colors.secondary }}
        >
          −
        </button>

        {/* Row 4 */}
        <button
          onClick={() => handleNumber('1')}
          className="bg-gray-200 hover:bg-gray-300 font-semibold py-4 rounded-lg transition-colors text-xl"
        >
          1
        </button>
        <button
          onClick={() => handleNumber('2')}
          className="bg-gray-200 hover:bg-gray-300 font-semibold py-4 rounded-lg transition-colors text-xl"
        >
          2
        </button>
        <button
          onClick={() => handleNumber('3')}
          className="bg-gray-200 hover:bg-gray-300 font-semibold py-4 rounded-lg transition-colors text-xl"
        >
          3
        </button>
        <button
          onClick={() => handleOperation('+')}
          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-4 rounded-lg transition-colors text-xl"
          style={{ backgroundColor: colors.secondary }}
        >
          +
        </button>

        {/* Row 5 */}
        <button
          onClick={() => handleNumber('0')}
          className="col-span-2 bg-gray-200 hover:bg-gray-300 font-semibold py-4 rounded-lg transition-colors text-xl"
        >
          0
        </button>
        <button
          onClick={handleDecimal}
          className="bg-gray-200 hover:bg-gray-300 font-semibold py-4 rounded-lg transition-colors text-xl"
        >
          .
        </button>
        <button
          onClick={handleEquals}
          className="text-white font-semibold py-4 rounded-lg transition-colors text-xl"
          style={{ backgroundColor: colors.primary }}
        >
          =
        </button>
      </div>

      {/* Apply Button */}
      {onApplyValue && (
        <button
          onClick={handleApply}
          className="mt-2 w-full py-3 text-white font-semibold rounded-lg transition-colors"
          style={{ backgroundColor: colors.primary }}
        >
          {t('pos.calculator.apply')} ({display} XAF)
        </button>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-4 border-t border-gray-200 pt-2">
          <div className="text-xs font-semibold text-gray-600 mb-2">
            {t('pos.calculator.history')}
          </div>
          <div className="max-h-24 overflow-y-auto space-y-1">
            {history.slice(-5).reverse().map((item, index) => (
              <div key={index} className="text-xs text-gray-500 font-mono">
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

