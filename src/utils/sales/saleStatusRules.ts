/**
 * Sale status business rules
 * Defines when stock should be debited and when finance entries should be created
 * based on sale status and payment status
 */

import type { Sale } from '../../types/models';

/**
 * Determines if stock should be debited based on sale status
 * @param status - Sale status
 * @returns true if stock should be debited, false otherwise
 */
export const shouldDebitStock = (status: Sale['status']): boolean => {
  switch (status) {
    case 'paid':
      return true;
    case 'credit':
      return true;
    case 'under_delivery':
      return true;
    case 'commande':
      return false;
    case 'draft':
      return false;
    default:
      return false;
  }
};

/**
 * Determines if finance entry should be created based on sale status and payment status
 * @param status - Sale status
 * @param paymentStatus - Payment status
 * @returns true if finance entry should be created, false otherwise
 */
export const shouldCreateFinanceEntry = (
  status: Sale['status'],
  paymentStatus: Sale['paymentStatus']
): boolean => {
  // Only create finance entry for paid sales with paymentStatus === 'paid'
  if (status === 'paid' && paymentStatus === 'paid') {
    return true;
  }
  
  // All other statuses don't create finance entries
  return false;
};

