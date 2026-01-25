/**
 * Combine standard units with custom units
 * Used to provide a unified list of units for selection
 */

import { UNITS, type Unit } from './units';
import type { CustomUnit } from '../../types/models';

export interface UnifiedUnit extends Unit {
  isCustom?: boolean; // Flag to identify custom units
  customUnitId?: string; // ID of custom unit if applicable
}

/**
 * Get all units (standard + custom) combined
 * @param customUnits - Array of custom units from the company
 * @param searchQuery - Optional search query to filter units
 * @returns Combined array of units (standard first, then custom)
 */
export const getAllUnits = (
  customUnits: CustomUnit[] = [],
  searchQuery?: string
): UnifiedUnit[] => {
  // Convert custom units to UnifiedUnit format
  const customUnitsFormatted: UnifiedUnit[] = customUnits.map((cu) => ({
    value: cu.value,
    label: cu.label,
    isCustom: true,
    customUnitId: cu.id
  }));

  // Convert standard units to UnifiedUnit format
  const standardUnitsFormatted: UnifiedUnit[] = UNITS.map((unit) => ({
    value: unit.value,
    label: unit.label,
    isCustom: false
  }));

  // Combine: standard units first, then custom units
  const allUnits = [...standardUnitsFormatted, ...customUnitsFormatted];

  // Apply search filter if provided
  if (searchQuery && searchQuery.trim() !== '') {
    const lowerQuery = searchQuery.toLowerCase().trim();
    return allUnits.filter(
      (unit) =>
        unit.value.toLowerCase().includes(lowerQuery) ||
        unit.label.toLowerCase().includes(lowerQuery)
    );
  }

  return allUnits;
};

/**
 * Search units by query (searches in both value and label, case-insensitive)
 * @param customUnits - Array of custom units
 * @param query - Search query string
 * @returns Array of matching units
 */
export const searchAllUnits = (
  customUnits: CustomUnit[] = [],
  query: string
): UnifiedUnit[] => {
  return getAllUnits(customUnits, query);
};

/**
 * Get unit by value (checks both standard and custom units)
 * @param customUnits - Array of custom units
 * @param value - Unit value to find
 * @returns UnifiedUnit or undefined if not found
 */
export const getUnitByValue = (
  customUnits: CustomUnit[] = [],
  value: string
): UnifiedUnit | undefined => {
  const allUnits = getAllUnits(customUnits);
  return allUnits.find((unit) => unit.value === value);
};

