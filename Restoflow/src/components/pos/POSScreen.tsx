// POSScreen - Main POS layout orchestrator
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GripVertical } from 'lucide-react';
import POSHeader from './POSHeader';
import POSDishGrid from './POSDishGrid';
import POSCart from './POSCart';
import POSOrdersSidebar from './POSOrdersSidebar';
import POSTableSelector from './POSTableSelector';
import POSPaymentModal from './POSPaymentModal';
import POSOrderReviewModal from './POSOrderReviewModal';
import { useRestaurantPOS } from '../../hooks/pos/useRestaurantPOS';
import { FirestoreService } from '../../services/firestoreService';
import { LoadingSpinner } from '../ui';
import type { POSPaymentData, POSOrder, POSOrderReviewMode, PartialKitchenTicket } from '../../types/pos';
import type { Order } from '../../types/index';

// Storage key for persisting panel width
const POS_PANEL_WIDTH_KEY = 'pos_cart_width_percent';

const POSScreen: React.FC = () => {
  const {
    // State
    state,
    isSubmitting,
    isLoading,
    editingOrderId,
    originalOrderItems,

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

    // Order editing
    loadOrderForEditing,
    addItemsToExistingOrder,

    // Draft management
    saveDraft,
    resumeDraft,
    deleteDraft,

    // Printing
    printKitchenTicket,
    printReceipt,
    printPartialKitchenTicket,
  } = useRestaurantPOS();

  // Modal states
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isOrderReviewOpen, setIsOrderReviewOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState<POSOrderReviewMode>('new');
  const [orderToPay, setOrderToPay] = useState<POSOrder | Order | null>(null);

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

  // Handle complete order - opens review modal
  const handleCompleteOrder = () => {
    if (editingOrderId) {
      setReviewMode('edit');
    } else {
      setReviewMode('new');
    }
    setIsOrderReviewOpen(true);
  };

  // Handle edit order - load order back to cart for editing
  const handleEditOrder = async (order: POSOrder | Order) => {
    try {
      await loadOrderForEditing(order.id);
      setReviewMode('edit');
      setIsOrderReviewOpen(true);
    } catch (error) {
      console.error('Failed to edit order:', error);
    }
  };

  // Handle print bon from review modal
  const handlePrintBon = async (kitchenTickets: number) => {
    // Close modal immediately to avoid loading state
    setIsOrderReviewOpen(false);

    try {
      if (reviewMode === 'edit' && editingOrderId) {
        // Partial print - only new items
        const newItems = state.cart.filter(
          item => !originalOrderItems.some(orig => orig.dish.id === item.dish.id)
        );
        
        if (newItems.length === 0) {
          return; // No new items to print
        }

        // Get existing order for ticket data
        const orders = await FirestoreService.getOrders(restaurantId);
        const existingOrder = orders.find(o => o.id === editingOrderId);
        
        if (existingOrder) {
          // Print partial tickets immediately (before updating order)
          for (let i = 0; i < kitchenTickets; i++) {
            const partialTicket: PartialKitchenTicket = {
              orderId: editingOrderId,
              orderNumber: `#${editingOrderId.slice(-6)}`,
              isPartial: true,
              newItemsOnly: newItems.map(item => ({
                name: item.dish.title,
                quantity: item.quantity,
                specialInstructions: item.specialInstructions,
              })),
              tableNumber: existingOrder.tableNumber,
              orderType: state.orderType,
              createdAt: new Date(),
              note: `Additional items for Order #${editingOrderId.slice(-6)}`,
            };
            // Add small delay between prints to avoid popup blocker issues
            setTimeout(() => {
              printPartialKitchenTicket(partialTicket);
            }, i * 500);
          }

          // Update order in database after printing starts
          addItemsToExistingOrder(editingOrderId, newItems, 0).catch(err => {
            console.error('Failed to update order:', err);
          });
        }
      } else {
        // Full print - all items
        // Create order first, then print
        const result = await completeOrder({
          paymentMethod: 'cash',
          tip: 0,
          customerName: state.customer?.name || '',
          customerPhone: state.customer?.phone || '',
          orderType: state.orderType,
          tableId: state.selectedTable?.id,
          tableNumber: state.selectedTable?.number,
          printKitchenTicket: true,
          skipPayment: true,
        });

        // Print kitchen tickets after order is created
        if (result.order) {
          for (let i = 0; i < kitchenTickets; i++) {
            // Add small delay between prints to avoid popup blocker issues
            setTimeout(() => {
              printKitchenTicket(result.order!);
            }, i * 500);
          }
        }
      }
    } catch (error) {
      console.error('Failed to print bon:', error);
    }
  };

  // Handle save draft from review modal
  const handleSaveDraftFromReview = () => {
    saveDraft();
    setIsOrderReviewOpen(false);
  };

  // Handle complete payment from review modal
  const handleCompletePaymentFromReview = () => {
    setIsOrderReviewOpen(false);
    setIsPaymentModalOpen(true);
  };

  // Handle pay order - open payment modal for specific order
  const handlePayOrder = (order: POSOrder | Order) => {
    setOrderToPay(order);
    setIsPaymentModalOpen(true);
  };

  // Handle payment confirmation
  const handlePaymentConfirm = async (paymentData: POSPaymentData) => {
    try {
      const result = await completeOrder(paymentData);

      // Print receipt if requested
      if (paymentData.printReceipt && result.order && result.sale) {
        printReceipt(result.order, result.sale);
      }

      setIsPaymentModalOpen(false);
      setOrderToPay(null);
    } catch (error) {
      // Error is handled in the hook
      console.error('Payment failed:', error);
    }
  };

  // Calculate new items for review modal in edit mode
  const getNewItems = () => {
    if (reviewMode === 'edit') {
      return state.cart.filter(
        item => !originalOrderItems.some(orig => orig.dish.id === item.dish.id)
      );
    }
    return state.cart;
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
            onEditOrder={handleEditOrder}
            onPayOrder={handlePayOrder}
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
              deliveryFee={state.deliveryFee}
              tableNumber={state.selectedTable?.number}
              onUpdateQuantity={updateCartQuantity}
              onRemoveItem={removeFromCart}
              onUpdateItem={updateCartItem}
              onDeliveryFeeChange={setDeliveryFee}
              onClearCart={clearCart}
              onSaveDraft={saveDraft}
              onCompleteOrder={handleCompleteOrder}
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
            deliveryFee={state.deliveryFee}
            tableNumber={state.selectedTable?.number}
            onUpdateQuantity={updateCartQuantity}
            onRemoveItem={removeFromCart}
            onUpdateItem={updateCartItem}
            onDeliveryFeeChange={setDeliveryFee}
            onClearCart={clearCart}
            onSaveDraft={saveDraft}
            onCompleteOrder={handleCompleteOrder}
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

      {/* Order Review Modal */}
      <POSOrderReviewModal
        isOpen={isOrderReviewOpen}
        mode={reviewMode}
        existingOrderId={editingOrderId || undefined}
        existingItems={reviewMode === 'edit' ? originalOrderItems : []}
        newItems={getNewItems()}
        cartTotals={cartTotals}
        orderType={state.orderType}
        table={state.selectedTable}
        onClose={() => setIsOrderReviewOpen(false)}
        onPrintBon={handlePrintBon}
        onSaveDraft={handleSaveDraftFromReview}
        onCompletePayment={handleCompletePaymentFromReview}
        onUpdateItem={updateCartItem}
        onRemoveItem={removeFromCart}
        onAddMoreItems={() => setIsOrderReviewOpen(false)}
      />

      {/* Payment Modal */}
      <POSPaymentModal
        isOpen={isPaymentModalOpen}
        cartTotals={orderToPay ? {
          subtotal: orderToPay.totalAmount || 0,
          tip: 0,
          deliveryFee: 0,
          total: orderToPay.totalAmount || 0,
          itemCount: orderToPay.items?.length || 0,
        } : cartTotals}
        orderType={orderToPay ? ((orderToPay as POSOrder).orderType || 'dine-in') : state.orderType}
        tableNumber={orderToPay?.tableNumber || state.selectedTable?.number}
        initialCustomer={state.customer}
        initialTip={0}
        onConfirm={handlePaymentConfirm}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setOrderToPay(null);
        }}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default POSScreen;
