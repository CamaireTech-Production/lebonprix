import { FirestoreService } from './firestoreService';
import { Order } from '../types';

// Legacy wrapper for backward compatibility
export const createOrder = async (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> & { customerName?: string, customerPhone?: string, customerLocation?: string, deliveryFee?: number }) => {
  if (!order.restaurantId) {
    throw new Error('Restaurant ID is required');
  }
  
  return FirestoreService.createOrder(order.restaurantId, {
    ...order,
    status: 'pending',
    ...(order.customerName ? { customerName: order.customerName } : {}),
    ...(order.customerPhone ? { customerPhone: order.customerPhone } : {}),
    ...(order.customerLocation ? { customerLocation: order.customerLocation } : {}),
    ...(order.deliveryFee !== undefined ? { deliveryFee: order.deliveryFee } : {}),
  });
};

export const updateOrderStatus = async (_orderId: string, _status: string) => {
  // This function needs restaurantId to work with the new scoped structure
  // For backward compatibility, we'll need to find the order first
  throw new Error('updateOrderStatus requires restaurantId. Use FirestoreService.updateOrderStatus instead.');
};

export const getOrder = async (_orderId: string): Promise<Order | null> => {
  // This function needs restaurantId to work with the new scoped structure
  throw new Error('getOrder requires restaurantId. Use FirestoreService.getOrders and filter by ID instead.');
};

export const subscribeToTableOrders = (_tableNumber: number, _callback: (orders: Order[]) => void) => {
  // This function needs restaurantId to work with the new scoped structure
  throw new Error('subscribeToTableOrders requires restaurantId. Use FirestoreService.subscribeToTableOrders instead.');
};

export const subscribeToAllOrders = (_callback: (orders: Order[]) => void) => {
  // This function needs restaurantId to work with the new scoped structure
  throw new Error('subscribeToAllOrders requires restaurantId. Use FirestoreService.subscribeToAllOrders instead.');
};

export const getFilteredOrders = async (
  _tableNumber?: number,
  _status?: Order['status'],
  _startDate?: Date,
  _endDate?: Date
): Promise<Order[]> => {
  // This function needs restaurantId to work with the new scoped structure
  throw new Error('getFilteredOrders requires restaurantId. Use FirestoreService.getFilteredOrders instead.');
};

export async function updateOrderCustomerStatus(_orderId: string, _customerViewStatus: string) {
  // This function needs restaurantId to work with the new scoped structure
  throw new Error('updateOrderCustomerStatus requires restaurantId. Use FirestoreService.updateOrder instead.');
}
