export type InventoryIndicator = 'RED' | 'YELLOW' | 'GREEN';

/**
 * Calculates the inventory health state indicator based on actual and minimum stock levels.
 * 
 * - RED: actualStock is exactly 0.
 * - YELLOW: actualStock is greater than 0 but less than the minimumStock.
 * - GREEN: actualStock is equal to or greater than the minimumStock.
 */
export function getInventoryIndicator(
  actualStock: number,
  minimumStock: number
): InventoryIndicator {
  if (actualStock === 0) return 'RED';
  if (actualStock < minimumStock) return 'YELLOW';
  return 'GREEN';
}

/**
 * Returns CSS classes and user-facing text labels for each indicator status.
 */
export function getIndicatorUiConfig(indicator: InventoryIndicator) {
  switch (indicator) {
    case 'RED':
      return {
        badgeClass: 'bg-red-500 text-white animate-pulse',
        text: 'Critical (Stok 0)',
        dotClass: 'bg-red-500 animate-pulse',
      };
    case 'YELLOW':
      return {
        badgeClass: 'bg-yellow-400 text-gray-900',
        text: 'Warning (Low Stock)',
        dotClass: 'bg-yellow-400',
      };
    case 'GREEN':
    default:
      return {
        badgeClass: 'bg-green-500 text-white',
        text: 'Aman (Optimal)',
        dotClass: 'bg-green-500',
      };
  }
}
