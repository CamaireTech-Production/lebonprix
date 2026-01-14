import React, { useState, useMemo } from 'react';
import { usePOS } from '@hooks/forms/usePOS';
import { POSHeader } from './POSHeader';
import { POSProductSearch } from './POSProductSearch';
import { POSProductGrid } from './POSProductGrid';
import { POSCart } from './POSCart';
import { POSCustomerQuickAdd } from './POSCustomerQuickAdd';
import { POSPaymentModal } from './POSPaymentModal';
import { POSKeyboardShortcuts } from './POSKeyboardShortcuts';
import { POSTransactionsSidebar } from './POSTransactionsSidebar';
import { useAuth } from '@contexts/AuthContext';
import { useParams } from 'react-router-dom';
import type { Sale } from '../../types/models';
import { getEffectiveProductStock } from '@utils/inventory/stockHelpers';

export const POSScreen: React.FC = () => {
  const { company } = useAuth();
  const { companyId } = useParams<{ companyId: string }>();
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const {
    cart,
    customer,
    searchQuery,
    selectedCategory,
    deliveryFee,
    applyTVA,
    tvaRate,
    filteredProducts,
    cartTotals,
    isSubmitting,
    showCustomerDropdown,
    customerSearch,
    customers,
    searchInputRef,
    customerInputRef,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    updateNegotiatedPrice,
    clearCart,
    selectCustomer,
    setWalkInCustomer,
    clearCustomer,
    handleCustomerSearch,
    updateState,
    toggleTVA,
    completeSale,
    saveDraft,
    resumeDraft,
    getDraftsList,
    deleteDraftById,
    handleBarcodeScan,
    focusSearch,
    stockMap,
    checkoutSettings,
    products,
  } = usePOS();

  // Get unique categories from all available products (not filtered)
  const categories = useMemo(() => {
    if (!products) return [];
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.category && p.isAvailable !== false) {
        const stock = getEffectiveProductStock(p, stockMap);
        if (stock > 0) {
          cats.add(p.category);
        }
      }
    });
    return Array.from(cats).sort();
  }, [products, stockMap]);

  const handleCompleteSaleClick = () => {
    setShowPaymentModal(true);
  };

  const handlePaymentComplete = async (paymentData: import('./POSPaymentModal').POSPaymentData) => {
    // Don't close modal - let it show loading and then preview
    const sale = await completeSale(paymentData);
    return sale; // Return sale for preview
  };

  const handleSaveDraft = async (paymentData: import('./POSPaymentModal').POSPaymentData) => {
    await saveDraft(paymentData);
  };

  const companyName = company?.name || 'POS System';

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <POSKeyboardShortcuts
        onFocusSearch={focusSearch}
        onCompleteSale={handleCompleteSaleClick}
        onCloseModal={() => setShowPaymentModal(false)}
        disabled={showPaymentModal}
      />

      <POSHeader companyName={companyName} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Recent Transactions (15%) */}
        <POSTransactionsSidebar
          drafts={getDraftsList()}
          onTransactionClick={(sale: Sale) => {
            // Optional: Handle transaction click (e.g., show details modal)
            console.log('Transaction clicked:', sale);
          }}
          onResumeDraft={(draft) => {
            const paymentData = resumeDraft(draft);
            // Open payment modal after resuming
            if (paymentData) {
              setShowPaymentModal(true);
            }
          }}
          onDeleteDraft={(draftId) => {
            return deleteDraftById(draftId);
          }}
        />

        {/* Middle - Cart (55%) */}
        <div className="w-full lg:w-[55%] flex flex-col border-r border-gray-200">
          <div className="p-4 border-b bg-white">
            <POSCustomerQuickAdd
              customer={customer}
              customerSearch={customerSearch}
              onCustomerSearch={handleCustomerSearch}
              onSelectCustomer={selectCustomer}
              onSetWalkIn={setWalkInCustomer}
              onClearCustomer={clearCustomer}
              showDropdown={showCustomerDropdown}
              customers={customers || []}
              customerInputRef={customerInputRef}
            />
          </div>

          <div className="flex-1 overflow-hidden">
            <POSCart
              cart={cart}
              onUpdateQuantity={updateCartQuantity}
              onRemoveItem={removeFromCart}
              onUpdateNegotiatedPrice={updateNegotiatedPrice}
              onClearCart={clearCart}
              subtotal={cartTotals.subtotal}
              deliveryFee={deliveryFee}
              total={cartTotals.total}
              onDeliveryFeeChange={(fee) => updateState({ deliveryFee: fee })}
              onCompleteSale={handleCompleteSaleClick}
              isSubmitting={isSubmitting}
              stockMap={stockMap}
            />
          </div>
        </div>

        {/* Right Side - Products (30%) */}
        <div className="hidden lg:flex lg:w-[30%] flex-col bg-white p-4">
          <POSProductSearch
            searchQuery={searchQuery}
            onSearchChange={(query) => updateState({ searchQuery: query })}
            searchInputRef={searchInputRef}
            onBarcodeScan={handleBarcodeScan}
            companyId={companyId || ''}
            companyName={companyName}
          />

          <div className="flex-1 overflow-hidden">
            <POSProductGrid
              products={filteredProducts}
              allProducts={products}
              onAddToCart={addToCart}
              selectedCategory={selectedCategory}
              onCategoryChange={(category) => updateState({ selectedCategory: category })}
              categories={categories}
              stockMap={stockMap}
            />
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <POSPaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          // Clear cart after successful sale (when modal closes from preview)
          // The cart will be cleared by usePOS when sale is completed
        }}
        subtotal={cartTotals.subtotal}
        currentDeliveryFee={deliveryFee}
        cart={cart}
        currentCustomer={customer}
        onComplete={handlePaymentComplete}
        onSaveDraft={handleSaveDraft}
        isSubmitting={isSubmitting}
        checkoutSettings={checkoutSettings}
        customers={customers}
        applyTVA={applyTVA}
        tvaRate={tvaRate}
        onTVAToggle={toggleTVA}
      />
    </div>
  );
};

