/**
 * Order alert service
 * Handles delivery date alerts for orders
 */

import { collection, query, where, getDocs, getDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { logError } from '@utils/core/logger';
import type { Order } from '../../../types/order';

const COLLECTION_NAME = 'orders';

/**
 * Get orders with upcoming delivery dates
 * @param companyId - Company ID
 * @param daysAhead - Number of days ahead to check (default: 2)
 * @returns Array of orders with delivery dates in the specified range
 */
export const getUpcomingDeliveryOrders = async (
  companyId: string,
  daysAhead: number = 2
): Promise<Order[]> => {
  try {
    // Get all orders for the company (we'll filter by date client-side since Firestore doesn't support nested field queries easily)
    const q = query(
      collection(db, COLLECTION_NAME),
      where('companyId', '==', companyId)
    );
    
    const snapshot = await getDocs(q);
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + daysAhead);
    
    const upcomingOrders: Order[] = [];
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const order = {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as Order;
      
      // Check if order has scheduledDate and it's within the range
      if (order.deliveryInfo?.scheduledDate) {
        let scheduledDate: Date;
        
        // Convert scheduledDate to Date if it's a Timestamp
        if (order.deliveryInfo.scheduledDate instanceof Date) {
          scheduledDate = order.deliveryInfo.scheduledDate;
        } else if (order.deliveryInfo.scheduledDate && typeof order.deliveryInfo.scheduledDate === 'object' && 'seconds' in order.deliveryInfo.scheduledDate) {
          scheduledDate = new Date((order.deliveryInfo.scheduledDate as Timestamp).seconds * 1000);
        } else {
          return; // Skip if date format is invalid
        }
        
        // Check if scheduledDate is between now and futureDate
        if (scheduledDate >= now && scheduledDate <= futureDate) {
          // Only include orders that are not delivered, cancelled, or converted
          if (order.status !== 'delivered' && order.status !== 'cancelled' && order.status !== 'converted') {
            // Only include if alert hasn't been sent yet (or if alertSent is false/undefined)
            if (!order.deliveryInfo.alertSent) {
              upcomingOrders.push(order);
            }
          }
        }
      }
    });
    
    // Sort by scheduledDate (earliest first)
    return upcomingOrders.sort((a, b) => {
      const dateA = a.deliveryInfo?.scheduledDate instanceof Date 
        ? a.deliveryInfo.scheduledDate.getTime()
        : a.deliveryInfo?.scheduledDate && typeof a.deliveryInfo.scheduledDate === 'object' && 'seconds' in a.deliveryInfo.scheduledDate
        ? (a.deliveryInfo.scheduledDate as Timestamp).seconds * 1000
        : 0;
      
      const dateB = b.deliveryInfo?.scheduledDate instanceof Date 
        ? b.deliveryInfo.scheduledDate.getTime()
        : b.deliveryInfo?.scheduledDate && typeof b.deliveryInfo.scheduledDate === 'object' && 'seconds' in b.deliveryInfo.scheduledDate
        ? (b.deliveryInfo.scheduledDate as Timestamp).seconds * 1000
        : 0;
      
      return dateA - dateB;
    });
  } catch (error) {
    logError('Error getting upcoming delivery orders', error);
    throw error;
  }
};

/**
 * Mark alert as sent for an order
 * @param orderId - Order ID
 * @param companyId - Company ID
 */
export const markAlertAsSent = async (
  orderId: string,
  companyId: string
): Promise<void> => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (!orderSnap.exists()) {
      throw new Error('Order not found');
    }
    
    const orderData = orderSnap.data();
    if (orderData.companyId !== companyId) {
      throw new Error('Unauthorized to update this order');
    }
    
    // Update deliveryInfo with alertSent flag
    const currentDeliveryInfo = orderData.deliveryInfo || { method: 'delivery' };
    await updateDoc(orderRef, {
      deliveryInfo: {
        ...currentDeliveryInfo,
        alertSent: true
      },
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    logError('Error marking alert as sent', error);
    throw error;
  }
};

/**
 * Get count of upcoming delivery orders (for badge display)
 * @param companyId - Company ID
 * @param daysAhead - Number of days ahead to check (default: 2)
 * @returns Count of orders with upcoming delivery dates
 */
export const getUpcomingDeliveryCount = async (
  companyId: string,
  daysAhead: number = 2
): Promise<number> => {
  try {
    const orders = await getUpcomingDeliveryOrders(companyId, daysAhead);
    return orders.length;
  } catch (error) {
    logError('Error getting upcoming delivery count', error);
    return 0;
  }
};

