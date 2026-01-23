// Notification Helpers
// Utility functions for creating notifications for various events
import { createNotificationsForUsers } from '@services/firestore/notifications/notificationService';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@services/core/firebase';
import { logError } from '@utils/core/logger';
import type { Notification } from '../../types/models';
import { getShopById } from '@services/firestore/shops/shopService';

/**
 * Get company owners and admins user IDs to notify
 */
export const getCompanyManagers = async (companyId: string): Promise<string[]> => {
  try {
    const companyRef = doc(db, 'companies', companyId);
    const companySnap = await getDoc(companyRef);

    if (!companySnap.exists()) {
      return [];
    }

    const companyData = companySnap.data();
    const employees = companyData.employees || {};
    const managerIds: string[] = [];

    // Get all employee IDs with owner or admin role
    for (const employeeId in employees) {
      const employee = employees[employeeId];
      if (employee && (employee.role === 'owner' || employee.role === 'admin')) {
        // Get user ID from employee reference
        if (employee.userId) {
          managerIds.push(employee.userId);
        } else if (employeeId) {
          // Fallback: use employeeId if userId not available
          managerIds.push(employeeId);
        }
      }
    }

    // Also get the company owner (userId field on company)
    if (companyData.userId && !managerIds.includes(companyData.userId)) {
      managerIds.push(companyData.userId);
    }

    return managerIds;

  } catch (error) {
    logError('Error getting company managers', error);
    return [];
  }
};

/**
 * Notify managers when a replenishment request is created
 */
export const notifyReplenishmentRequestCreated = async (
  companyId: string,
  requestId: string,
  shopId: string,
  productId: string,
  quantity: number
): Promise<void> => {
  try {
    const managerIds = await getCompanyManagers(companyId);
    if (managerIds.length === 0) return;

    // Try to get shop and product names
    let shopName: string | undefined;
    let productName: string | undefined;

    try {
      const shop = await getShopById(shopId);
      shopName = shop?.name;
    } catch (err) {
      // Ignore errors, use ID if name not available
    }

    try {
      const productRef = doc(db, 'products', productId);
      const productSnap = await getDoc(productRef);
      if (productSnap.exists()) {
        productName = productSnap.data().name;
      }
    } catch (err) {
      // Ignore errors, use ID if name not available
    }

    const title = 'Nouvelle demande de réapprovisionnement';
    const message = shopName && productName
      ? `Demande de ${quantity} ${productName} pour ${shopName}`
      : `Nouvelle demande de réapprovisionnement de ${quantity} unités`;

    await createNotificationsForUsers(
      managerIds,
      companyId,
      'replenishment_request_created',
      title,
      message,
      {
        requestId,
        shopId,
        productId
      }
    );

  } catch (error) {
    logError('Error notifying replenishment request created', error);
    // Don't throw - notification failure shouldn't break the main flow
  }
};

/**
 * Notify user when their replenishment request is fulfilled
 */
export const notifyReplenishmentRequestFulfilled = async (
  companyId: string,
  requestId: string,
  userId: string,
  transferId: string
): Promise<void> => {
  try {
    // Get request data to fetch shop and product names
    const requestRef = doc(db, 'stockReplenishmentRequests', requestId);
    const requestSnap = await getDoc(requestRef);
    
    let shopName: string | undefined;
    let productName: string | undefined;

    if (requestSnap.exists()) {
      const requestData = requestSnap.data();
      try {
        const shop = await getShopById(requestData.shopId);
        shopName = shop?.name;
      } catch (err) {
        // Ignore
      }
      try {
        const productRef = doc(db, 'products', requestData.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          productName = productSnap.data().name;
        }
      } catch (err) {
        // Ignore
      }
    }

    const title = 'Demande de réapprovisionnement remplie';
    const message = shopName && productName
      ? `Votre demande pour ${productName} dans ${shopName} a été remplie`
      : 'Votre demande de réapprovisionnement a été remplie';

    await createNotificationsForUsers(
      [userId],
      companyId,
      'replenishment_request_fulfilled',
      title,
      message,
      {
        requestId,
        transferId
      }
    );

  } catch (error) {
    logError('Error notifying replenishment request fulfilled', error);
  }
};

/**
 * Notify user when their replenishment request is rejected
 */
export const notifyReplenishmentRequestRejected = async (
  companyId: string,
  requestId: string,
  userId: string,
  reason?: string
): Promise<void> => {
  try {
    // Get request data to fetch shop and product names
    const requestRef = doc(db, 'stockReplenishmentRequests', requestId);
    const requestSnap = await getDoc(requestRef);
    
    let shopName: string | undefined;
    let productName: string | undefined;

    if (requestSnap.exists()) {
      const requestData = requestSnap.data();
      try {
        const shop = await getShopById(requestData.shopId);
        shopName = shop?.name;
      } catch (err) {
        // Ignore
      }
      try {
        const productRef = doc(db, 'products', requestData.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          productName = productSnap.data().name;
        }
      } catch (err) {
        // Ignore
      }
    }

    const title = 'Demande de réapprovisionnement rejetée';
    const message = reason
      ? `Votre demande pour ${productName || 'produit'} dans ${shopName || 'boutique'} a été rejetée: ${reason}`
      : `Votre demande pour ${productName || 'produit'} dans ${shopName || 'boutique'} a été rejetée`;

    await createNotificationsForUsers(
      [userId],
      companyId,
      'replenishment_request_rejected',
      title,
      message,
      {
        requestId
      }
    );

  } catch (error) {
    logError('Error notifying replenishment request rejected', error);
  }
};

/**
 * Notify users when a transfer is created
 */
export const notifyTransferCreated = async (
  companyId: string,
  transferId: string,
  transferType: string,
  productId: string,
  quantity: number,
  fromShopId?: string,
  fromWarehouseId?: string,
  toShopId?: string,
  toWarehouseId?: string
): Promise<void> => {
  try {
    const userIds: string[] = [];

    // Notify users assigned to source location
    if (fromShopId) {
      const shopRef = doc(db, 'shops', fromShopId);
      const shopSnap = await getDoc(shopRef);
      if (shopSnap.exists()) {
        const shopData = shopSnap.data();
        if (shopData.assignedUsers) {
          userIds.push(...shopData.assignedUsers);
        }
      }
    }

    if (fromWarehouseId) {
      const warehouseRef = doc(db, 'warehouses', fromWarehouseId);
      const warehouseSnap = await getDoc(warehouseRef);
      if (warehouseSnap.exists()) {
        const warehouseData = warehouseSnap.data();
        if (warehouseData.assignedUsers) {
          userIds.push(...warehouseData.assignedUsers);
        }
      }
    }

    // Notify users assigned to destination location
    if (toShopId) {
      const shopRef = doc(db, 'shops', toShopId);
      const shopSnap = await getDoc(shopRef);
      if (shopSnap.exists()) {
        const shopData = shopSnap.data();
        if (shopData.assignedUsers) {
          userIds.push(...shopData.assignedUsers);
        }
      }
    }

    if (toWarehouseId) {
      const warehouseRef = doc(db, 'warehouses', toWarehouseId);
      const warehouseSnap = await getDoc(warehouseRef);
      if (warehouseSnap.exists()) {
        const warehouseData = warehouseSnap.data();
        if (warehouseData.assignedUsers) {
          userIds.push(...warehouseData.assignedUsers);
        }
      }
    }

    // Remove duplicates
    const uniqueUserIds = Array.from(new Set(userIds));
    if (uniqueUserIds.length === 0) return;

    // Try to get product name
    let productName: string | undefined;
    try {
      const productRef = doc(db, 'products', productId);
      const productSnap = await getDoc(productRef);
      if (productSnap.exists()) {
        productName = productSnap.data().name;
      }
    } catch (err) {
      // Ignore
    }

    const title = 'Nouveau transfert de stock';
    const message = productName
      ? `Transfert de ${quantity} ${productName}`
      : `Nouveau transfert de ${quantity} unités`;

    await createNotificationsForUsers(
      uniqueUserIds,
      companyId,
      'transfer_created',
      title,
      message,
      {
        transferId,
        shopId: toShopId,
        warehouseId: toWarehouseId,
        productId
      }
    );

  } catch (error) {
    logError('Error notifying transfer created', error);
  }
};

