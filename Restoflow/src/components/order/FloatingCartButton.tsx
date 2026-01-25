import React from 'react';
import { ShoppingCart, ArrowUp } from 'lucide-react';

interface FloatingCartButtonProps {
  totalCartItems: number;
  showScrollTop: boolean;
  templateId: string;
  styles: {
    buttonBg: string;
    scrollTopStyle: string;
  };
  onCartClick: () => void;
  onScrollToTop: () => void;
}

const FloatingCartButton: React.FC<FloatingCartButtonProps> = ({
  totalCartItems,
  showScrollTop,
  templateId,
  styles,
  onCartClick,
  onScrollToTop
}) => {
  if (totalCartItems === 0 && !showScrollTop) {
    return null;
  }

  return (
    <>
      {/* Floating Cart Button */}
      {totalCartItems > 0 && (
        <button
          onClick={onCartClick}
          className={`floating-cart-button ${styles.buttonBg} ${
            templateId === 'lea' ? 'text-black' : 'text-white'
          }`}
        >
          <ShoppingCart size={24} />
          <span className={`cart-badge ${
            templateId === 'lea' 
              ? 'bg-black text-yellow-500' 
              : 'bg-red-500 text-white'
          }`}>
            {totalCartItems}
          </span>
        </button>
      )}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={onScrollToTop}
          className={`scroll-to-top-button ${
            totalCartItems > 0 ? 'right-20' : 'right-6'
          } ${styles.scrollTopStyle} ${
            templateId === 'lea' ? 'text-black' : 'text-white'
          }`}
        >
          <ArrowUp size={20} />
        </button>
      )}
    </>
  );
};

export default FloatingCartButton;

