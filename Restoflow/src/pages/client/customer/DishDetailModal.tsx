import Modal from '../../../components/ui/Modal';
import designSystem from '../../../designSystem';
import { Dish as MenuItem } from '../../../types/index';
import { t } from '../../../utils/i18n';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getCurrencySymbol } from '../../../data/currencies';

interface DishDetailModalProps {
  isOpen: boolean;
  dish: MenuItem | null;
  onClose: () => void;
  addToCart?: (dish: MenuItem) => void;
  inCart?: { id: string; quantity: number } | null;
  incrementItem?: (itemId: string) => void;
  decrementItem?: (itemId: string) => void;
  categoryName?: string;
  currencyCode?: string;
  theme?: 'light' | 'dark';
}

export default function DishDetailModal({ isOpen, dish, onClose, addToCart, inCart, incrementItem, decrementItem, categoryName, currencyCode, theme = 'light' }: DishDetailModalProps) {
  const { language } = useLanguage();
  const currencySymbol = getCurrencySymbol(currencyCode || 'XAF') || 'FCFA';
  if (!dish) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      className="w-[90vw] h-[70vh] max-w-6xl max-h-[90vh] p-0 overflow-hidden"
      theme={theme}
    >
      <div className={`flex flex-col h-full ${theme === 'dark' ? 'bg-[#0f0f0f]' : 'bg-white'}`}>
        {/* Header with close button */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <div className="flex-1">
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {dish.title}
            </h2>
            {categoryName && (
              <span
                className="inline-block px-3 py-1 rounded-full text-sm font-medium mt-2"
                style={{
                  background: theme === 'dark' ? '#d4af37' : designSystem.colors.highlightYellow,
                  color: theme === 'dark' ? '#0b0b0b' : designSystem.colors.primary,
                  fontFamily: 'Poppins, sans-serif'
                }}
              >
                {categoryName}
              </span>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Image section - takes 50% on desktop, full width on mobile */}
          <div className="lg:w-1/2 w-full h-64 lg:h-full relative overflow-hidden">
            {dish.image ? (
              <img
                src={dish.image}
                alt={dish.title}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <div className="text-center">
                  <div className={`text-6xl mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>🍽️</div>
                  <p className={`text-lg ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('no_image_available', language) || 'No image available'}
                  </p>
                </div>
              </div>
            )}
            
            {/* Image overlay gradient for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
          </div>

          {/* Content section */}
          <div className="lg:w-1/2 w-full flex flex-col justify-between p-6 overflow-y-auto">
            {/* Price - Moved to top */}
            <div className="mb-6">
              <div className={`text-3xl font-bold text-left ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {dish.price.toLocaleString()} {currencySymbol}
              </div>
            </div>

            {/* Description */}
            <div className="flex-1">
              <h3 className={`text-lg font-semibold mb-3 text-left ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {t('description', language) || 'Description'}
              </h3>
              <p className={`text-base leading-relaxed text-left ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                {dish.description || t('no_description_available', language) || 'No description available for this dish.'}
              </p>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                {/* Action buttons */}
                {addToCart ? (
                  <div className="flex justify-center sm:justify-end">
                    {!inCart ? (
                      <button
                        onClick={() => addToCart(dish)}
                        className={`inline-flex justify-center items-center px-8 py-3 border border-transparent rounded-lg shadow-lg text-base font-semibold transition-all duration-200 transform hover:scale-105 ${theme === 'dark' ? 'text-black' : 'text-white'} ${theme === 'dark' ? 'bg-[#d4af37] hover:bg-[#c39c2f]' : 'bg-primary hover:bg-primary-dark'} focus:outline-none focus:ring-2 focus:ring-offset-2 ${theme === 'dark' ? 'focus:ring-[#d4af37]' : 'focus:ring-primary'}`}
                      >
                        <span className="mr-2">🛒</span>
                        {t('order_now', language) || 'Order Now'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-4 bg-gray-100 rounded-lg px-4 py-2">
                        <button 
                          onClick={() => decrementItem && decrementItem(inCart.id)} 
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition-colors ${theme === 'dark' ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                        >
                          -
                        </button>
                        <span className={`text-xl font-bold min-w-[2rem] text-center ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                          {inCart.quantity}
                        </span>
                        <button 
                          onClick={() => incrementItem && incrementItem(inCart.id)} 
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition-colors ${theme === 'dark' ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
