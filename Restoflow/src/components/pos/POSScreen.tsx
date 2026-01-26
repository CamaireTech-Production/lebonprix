// POSScreen - Main POS layout orchestrator
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GripVertical } from 'lucide-react';
import POSHeader from './POSHeader';
import POSDishGrid from './POSDishGrid';
import POSCart from './POSCart';
import POSOrdersSidebar from './POSOrdersSidebar';
import POSTableSelector from './POSTableSelector';
import POSPaymentModal from './POSPaymentModal';
import { useRestaurantPOS } from '../../hooks/pos/useRestaurantPOS';
import { LoadingSpinner } from '../ui';
import type { POSPaymentData } from '../../types/pos';

// Storage key for persisting panel width
const POS_PANEL_WIDTH_KEY = 'pos_cart_width_percent';

const POSScreen: React.FC = () => {
  const {
    // State
    state,
    isSubmitting,
    isLoading,

    // Data
    dishes,
    categories,
    tables,
    filteredDishes,
    cartTotals,
    activeOrders,
    drafts,

    // Cart operations
    addToCart,
    updateCartItem,
    updateCartQuantity,
    removeFromCart,
    clearCart,

    // Customer operations
    setCustomer,

    // Table operations
    selectTable,

    // Order type & delivery
    setOrderType,
    setDeliveryFee,

    // Tip
    setTip,

    // Notes
    setNotes,

    // Search & Filter
    setSearchQuery,
    setSelectedCategory,

    // Order completion
    completeOrder,

    // Draft management
    saveDraft,
    resumeDraft,
    deleteDraft,

    // Printing
    printKitchenTicket,
    printReceipt,
  } = useRestaurantPOS();

  // Modal states
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Resizable panel state
  const [cartWidthPercent, setCartWidthPercent] = useState(() => {
    const saved = localStorage.getItem(POS_PANEL_WIDTH_KEY);
    return saved ? parseFloat(saved) : 40; // Default 40%
  });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Min/max constraints for cart width (percentage of available space after sidebar)
  const MIN_CART_WIDTH = 25;
  const MAX_CART_WIDTH = 70;

  // Save width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(POS_PANEL_WIDTH_KEY, cartWidthPercent.toString());
  }, [cartWidthPercent]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (clientX: number) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      // Calculate position relative to the container (after sidebar)
      const relativeX = clientX - containerRect.left;
      const containerWidth = containerRect.width;

      // Calculate percentage
      let newPercent = (relativeX / containerWidth) * 100;

      // Clamp to min/max
      newPercent = Math.max(MIN_CART_WIDTH, Math.min(MAX_CART_WIDTH, newPercent));

      setCartWidthPercent(newPercent);
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX);
    };

    const handleEnd = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);

    // Add cursor style to body during drag
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchend', handleEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  // Handle table selection
  const handleTableSelect = (table: typeof state.selectedTable) => {
    selectTable(table);
    setIsTableSelectorOpen(false);
  };

  // Handle payment confirmation
  const handlePaymentConfirm = async (paymentData: POSPaymentData) => {
    try {
      const result = await completeOrder(paymentData);

      // Print if requested
      if (paymentData.printKitchenTicket && result.order) {
        printKitchenTicket(result.order);
      }
      if (paymentData.printReceipt && result.order && result.sale) {
        printReceipt(result.order, result.sale);
      }

      setIsPaymentModalOpen(false);
    } catch (error) {
      // Error is handled in the hook
      console.error('Payment failed:', error);
    }
  };

  // Show loading while data is being fetched
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Header */}
      <POSHeader
        selectedTable={state.selectedTable}
        orderType={state.orderType}
        onTableClick={() => setIsTableSelectorOpen(true)}
        onOrderTypeChange={setOrderType}
      />

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Orders & Drafts (hidden on mobile) */}
        <div className="hidden lg:block w-56 flex-shrink-0">
          <POSOrdersSidebar
            activeOrders={activeOrders}
            drafts={drafts}
            onResumeDraft={resumeDraft}
            onDeleteDraft={deleteDraft}
          />
        </div>

        {/* Resizable Container for Cart and Dish Grid (desktop only) */}
        <div
          ref={containerRef}
          className="hidden md:flex flex-1 overflow-hidden"
        >
          {/* Center - Cart */}
          <div
            className="flex-shrink-0 border-x border-gray-200 overflow-hidden"
            style={{ width: `${cartWidthPercent}%` }}
          >
            <POSCart
              cart={state.cart}
              cartTotals={cartTotals}
              orderType={state.orderType}
              tip={state.tip}
              deliveryFee={state.deliveryFee}
              tableNumber={state.selectedTable?.number}
              onUpdateQuantity={updateCartQuantity}
              onRemoveItem={removeFromCart}
              onUpdateItem={updateCartItem}
              onTipChange={setTip}
              onDeliveryFeeChange={setDeliveryFee}
              onClearCart={clearCart}
              onSaveDraft={saveDraft}
              onCompleteOrder={() => setIsPaymentModalOpen(true)}
              isSubmitting={isSubmitting}
            />
          </div>

          {/* Draggable Divider */}
          <div
            className={`
              w-2 flex-shrink-0 cursor-col-resize
              flex items-center justify-center
              bg-gray-200 hover:bg-blue-400
              transition-colors duration-150
              ${isDragging ? 'bg-blue-500' : ''}
            `}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
            <GripVertical
              size={16}
              className={`text-gray-500 ${isDragging ? 'text-white' : ''}`}
            />
          </div>

          {/* Right - Dish Grid */}
          <div className="flex-1 overflow-hidden">
            <POSDishGrid
              dishes={filteredDishes}
              categories={categories}
              searchQuery={state.searchQuery}
              selectedCategory={state.selectedCategory}
              onSearchChange={setSearchQuery}
              onCategoryChange={setSelectedCategory}
              onAddToCart={addToCart}
            />
          </div>
        </div>

        {/* Mobile Cart (full width) */}
        <div className="md:hidden w-full border-x border-gray-200">
          <POSCart
            cart={state.cart}
            cartTotals={cartTotals}
            orderType={state.orderType}
            tip={state.tip}
            deliveryFee={state.deliveryFee}
            tableNumber={state.selectedTable?.number}
            onUpdateQuantity={updateCartQuantity}
            onRemoveItem={removeFromCart}
            onUpdateItem={updateCartItem}
            onTipChange={setTip}
            onDeliveryFeeChange={setDeliveryFee}
            onClearCart={clearCart}
            onSaveDraft={saveDraft}
            onCompleteOrder={() => setIsPaymentModalOpen(true)}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>

      {/* Mobile Dish Grid Toggle (show at bottom on mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="h-64 overflow-hidden">
          <POSDishGrid
            dishes={filteredDishes}
            categories={categories}
            searchQuery={state.searchQuery}
            selectedCategory={state.selectedCategory}
            onSearchChange={setSearchQuery}
            onCategoryChange={setSelectedCategory}
            onAddToCart={addToCart}
          />
        </div>
      </div>

      {/* Table Selector Modal */}
      <POSTableSelector
        isOpen={isTableSelectorOpen}
        tables={tables}
        selectedTable={state.selectedTable}
        onSelect={handleTableSelect}
        onClose={() => setIsTableSelectorOpen(false)}
      />

      {/* Payment Modal */}
      <POSPaymentModal
        isOpen={isPaymentModalOpen}
        cartTotals={cartTotals}
        orderType={state.orderType}
        tableNumber={state.selectedTable?.number}
        initialCustomer={state.customer}
        initialTip={state.tip}
        onConfirm={handlePaymentConfirm}
        onClose={() => setIsPaymentModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default POSScreen;
