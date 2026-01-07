type BadgeVariantType = 'success' | 'warning' | 'error' | 'info' | 'default';

/**
 * Determines the badge variant color based on stock quantity and threshold
 * 
 * @param stock - Current stock quantity
 * @param threshold - Low stock threshold (optional)
 * @returns Badge variant to use for display
 */
export const getStockBadgeVariant = (
  stock: number,
  threshold?: number
): BadgeVariantType => {
  // If stock is 0, always show default (gray)
  if (stock === 0) {
    return 'default';
  }

  // If threshold is not configured, show info (blue) or default (gray)
  if (threshold === undefined || threshold === null) {
    return 'info';
  }

  // Calculate warning threshold (1.5x the low stock threshold)
  const warningThreshold = threshold * 1.5;

  // Stock is below low threshold -> error (red)
  if (stock < threshold) {
    return 'error';
  }

  // Stock is between threshold and warning threshold -> warning (orange/yellow)
  if (stock < warningThreshold) {
    return 'warning';
  }

  // Stock is above warning threshold -> success (green)
  return 'success';
};

