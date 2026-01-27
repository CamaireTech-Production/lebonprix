// Unified Stock Alert Service
// Handles all stock alert logic and notification creation
import { getDoc, doc, collection, query, where, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@services/core/firebase';
import { logError } from '@utils/core/logger';
import { getCompanyManagers } from '@utils/notifications/notificationHelpers';
import { createNotificationsForUsers } from '@services/firestore/notifications/notificationService';
import { getProductStockInfo, getMatiereStockInfo } from '@services/firestore/stock/stockService';
import type { Product, Matiere, Company } from '../../types/models';

export type StockAlertType = 'rupture' | 'low';

export interface StockAlertResult {
  shouldAlert: boolean;
  alertType: StockAlertType | null;
  currentStock: number;
  threshold: number;
}

/**
 * Check if a product needs a stock alert
 */
export const checkProductStockAlert = async (
  productId: string,
  companyId: string,
  threshold: number
): Promise<StockAlertResult> => {
  try {
    const stockInfo = await getProductStockInfo(productId, companyId);
    const currentStock = stockInfo.totalStock;

    // Rupture: stock is 0
    if (currentStock === 0) {
      return {
        shouldAlert: true,
        alertType: 'rupture',
        currentStock: 0,
        threshold
      };
    }

    // Low stock: stock is below or equal to threshold
    if (currentStock <= threshold) {
      return {
        shouldAlert: true,
        alertType: 'low',
        currentStock,
        threshold
      };
    }

    return {
      shouldAlert: false,
      alertType: null,
      currentStock,
      threshold
    };
  } catch (error) {
    logError('Error checking product stock alert', error);
    return {
      shouldAlert: false,
      alertType: null,
      currentStock: 0,
      threshold
    };
  }
};

/**
 * Check if a matiere needs a stock alert
 */
export const checkMatiereStockAlert = async (
  matiereId: string,
  threshold: number
): Promise<StockAlertResult> => {
  try {
    const stockInfo = await getMatiereStockInfo(matiereId);
    const currentStock = stockInfo.totalStock;

    // Rupture: stock is 0
    if (currentStock === 0) {
      return {
        shouldAlert: true,
        alertType: 'rupture',
        currentStock: 0,
        threshold
      };
    }

    // Low stock: stock is below or equal to threshold
    if (currentStock <= threshold) {
      return {
        shouldAlert: true,
        alertType: 'low',
        currentStock,
        threshold
      };
    }

    return {
      shouldAlert: false,
      alertType: null,
      currentStock,
      threshold
    };
  } catch (error) {
    logError('Error checking matiere stock alert', error);
    return {
      shouldAlert: false,
      alertType: null,
      currentStock: 0,
      threshold
    };
  }
};

/**
 * Check if we should send an alert (prevent duplicates)
 * Only send alert if:
 * 1. Last alert was more than 24 hours ago, OR
 * 2. Stock status changed (e.g., from above threshold to below)
 */
export const shouldSendStockAlert = async (
  companyId: string,
  itemId: string,
  itemType: 'product' | 'matiere',
  currentAlertType: StockAlertType | null
): Promise<boolean> => {
  try {
    const alertHistoryRef = doc(
      db,
      'companies',
      companyId,
      'stockAlertHistory',
      `${itemType}_${itemId}`
    );
    const alertHistorySnap = await getDoc(alertHistoryRef);

    if (!alertHistorySnap.exists()) {
      // No previous alert, send it
      return true;
    }

    const history = alertHistorySnap.data();
    const lastAlertTime = history.lastAlertAt?.toMillis?.() || history.lastAlertAt || 0;
    const lastAlertType = history.lastAlertType || null;
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    // Send if:
    // 1. More than 24 hours since last alert, OR
    // 2. Alert type changed (e.g., from low to rupture, or from no alert to alert)
    if (now - lastAlertTime > twentyFourHours) {
      return true;
    }

    if (lastAlertType !== currentAlertType) {
      return true;
    }

    return false;
  } catch (error) {
    logError('Error checking should send stock alert', error);
    // On error, allow alert (fail open)
    return true;
  }
};

/**
 * Record that an alert was sent
 */
export const recordStockAlertSent = async (
  companyId: string,
  itemId: string,
  itemType: 'product' | 'matiere',
  alertType: StockAlertType
): Promise<void> => {
  try {
    const alertHistoryRef = doc(
      db,
      'companies',
      companyId,
      'stockAlertHistory',
      `${itemType}_${itemId}`
    );
    await setDoc(alertHistoryRef, {
      lastAlertAt: serverTimestamp(),
      lastAlertType: alertType,
      itemId,
      itemType,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    logError('Error recording stock alert sent', error);
  }
};

/**
 * Create stock alert notification for a product
 */
export const createProductStockAlert = async (
  productId: string,
  companyId: string,
  alertType: StockAlertType,
  currentStock: number,
  threshold: number
): Promise<void> => {
  try {
    // Get product info
    const productRef = doc(db, 'products', productId);
    const productSnap = await getDoc(productRef);
    
    if (!productSnap.exists()) {
      logError('Product not found for stock alert', { productId });
      return;
    }

    const product = productSnap.data() as Product;
    const productName = product.name;

    // Get company managers to notify
    const managerIds = await getCompanyManagers(companyId);
    if (managerIds.length === 0) {
      logError('No managers found to notify for stock alert', { companyId });
      return;
    }

    // Create notification message
    const title = alertType === 'rupture'
      ? 'Rupture de stock'
      : 'Stock faible';
    
    const message = alertType === 'rupture'
      ? `${productName} est en rupture de stock (0 unité disponible)`
      : `${productName} a un stock faible (${currentStock} unité${currentStock > 1 ? 's' : ''} disponible${currentStock > 1 ? 's' : ''}, seuil: ${threshold})`;

    // Create notifications
    await createNotificationsForUsers(
      managerIds,
      companyId,
      'stock_low',
      title,
      message,
      {
        productId,
        alertType,
        currentStock,
        threshold
      }
    );

    // Record that alert was sent
    await recordStockAlertSent(companyId, productId, 'product', alertType);

  } catch (error) {
    logError('Error creating product stock alert', error);
  }
};

/**
 * Create stock alert notification for a matiere
 */
export const createMatiereStockAlert = async (
  matiereId: string,
  companyId: string,
  alertType: StockAlertType,
  currentStock: number,
  threshold: number
): Promise<void> => {
  try {
    // Get matiere info
    const matiereRef = doc(db, 'matieres', matiereId);
    const matiereSnap = await getDoc(matiereRef);
    
    if (!matiereSnap.exists()) {
      logError('Matiere not found for stock alert', { matiereId });
      return;
    }

    const matiere = matiereSnap.data() as Matiere;
    const matiereName = matiere.name;

    // Get company managers to notify
    const managerIds = await getCompanyManagers(companyId);
    if (managerIds.length === 0) {
      logError('No managers found to notify for stock alert', { companyId });
      return;
    }

    // Create notification message
    const title = alertType === 'rupture'
      ? 'Rupture de stock (Matière)'
      : 'Stock faible (Matière)';
    
    const message = alertType === 'rupture'
      ? `${matiereName} est en rupture de stock (0 unité disponible)`
      : `${matiereName} a un stock faible (${currentStock} unité${currentStock > 1 ? 's' : ''} disponible${currentStock > 1 ? 's' : ''}, seuil: ${threshold})`;

    // Create notifications
    await createNotificationsForUsers(
      managerIds,
      companyId,
      'stock_low',
      title,
      message,
      {
        matiereId,
        alertType,
        currentStock,
        threshold
      }
    );

    // Record that alert was sent
    await recordStockAlertSent(companyId, matiereId, 'matiere', alertType);

  } catch (error) {
    logError('Error creating matiere stock alert', error);
  }
};

/**
 * Main function to check and alert on product stock
 */
export const checkAndAlertProductStock = async (
  productId: string,
  companyId: string,
  threshold: number
): Promise<void> => {
  try {
    // Check stock level
    const alertResult = await checkProductStockAlert(productId, companyId, threshold);
    
    if (!alertResult.shouldAlert || !alertResult.alertType) {
      return; // No alert needed
    }

    // Check if we should send alert (prevent duplicates)
    const shouldSend = await shouldSendStockAlert(
      companyId,
      productId,
      'product',
      alertResult.alertType
    );

    if (!shouldSend) {
      return; // Already sent recently
    }

    // Create and send alert
    await createProductStockAlert(
      productId,
      companyId,
      alertResult.alertType,
      alertResult.currentStock,
      threshold
    );

  } catch (error) {
    logError('Error in checkAndAlertProductStock', error);
  }
};

/**
 * Main function to check and alert on matiere stock
 */
export const checkAndAlertMatiereStock = async (
  matiereId: string,
  companyId: string,
  threshold: number
): Promise<void> => {
  try {
    // Check stock level
    const alertResult = await checkMatiereStockAlert(matiereId, threshold);
    
    if (!alertResult.shouldAlert || !alertResult.alertType) {
      return; // No alert needed
    }

    // Check if we should send alert (prevent duplicates)
    const shouldSend = await shouldSendStockAlert(
      companyId,
      matiereId,
      'matiere',
      alertResult.alertType
    );

    if (!shouldSend) {
      return; // Already sent recently
    }

    // Create and send alert
    await createMatiereStockAlert(
      matiereId,
      companyId,
      alertResult.alertType,
      alertResult.currentStock,
      threshold
    );

  } catch (error) {
    logError('Error in checkAndAlertMatiereStock', error);
  }
};

