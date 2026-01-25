export const paymentFees: Record<string, { mtn: number; orange: number }> = {
  XAF: {
    // mtn: 0.015, // 1.5%
    // orange: 0.015, // 1.5%
    mtn: 0, // 1.5%
    orange: 0, // 1.5%
  },
  USD: {
    mtn: 0.02,
    orange: 0.02,
  },
  EUR: {
    mtn: 0.02,
    orange: 0.02,
  },
  NGN: {
    mtn: 0.02,
    orange: 0.02,
  },
  // Add more currencies as needed
};

export function getPaymentFee(currency: string, method: 'mtn' | 'orange'): number {
  const fees = paymentFees[currency] || paymentFees['XAF'];
  return fees[method] ?? 0.02;
} 