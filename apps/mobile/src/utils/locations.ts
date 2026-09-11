// apps/mobile/src/utils/locations.ts
import type Ionicons from 'react-native-vector-icons/Ionicons';

export const DEFAULT_TOP_LOCATIONS = [
  'Fridge',
  'Freezer',
] as const;

export type DefaultTopLocation = (typeof DEFAULT_TOP_LOCATIONS)[number];

export const COMMON_OTHER_LOCATIONS = [
  'Pantry',
  'Counter',
  'Spice Rack',
  'Cupboard',
  'Cabinet',
  'Basement',
  'Cellar',
  'Wine Cooler',
  'Drawer',
  'Office',
  'Garage',
  'Bar',
] as const;

/**
 * Trims and lowercases location string for case-insensitive comparisons.
 */
export function normalizeLocation(val?: string | null): string {
  if (!val) return '';
  return val.trim().toLowerCase();
}

/**
 * Normalizes input string to Title Case, trimmed and clamped to max 50 characters.
 * e.g. "spice rack" -> "Spice Rack"
 */
export function normalizeLocationTitleCase(val: string): string {
  const trimmed = val.trim().slice(0, 50);
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Maps location string (case-insensitively) to a contextual Ionicons glyph name.
 */
export function getLocationIcon(
  location?: string | null,
): keyof typeof Ionicons.glyphMap {
  const norm = normalizeLocation(location);
  switch (norm) {
    case 'fridge':
      return 'thermometer-outline';
    case 'freezer':
      return 'snow-outline';
    case 'pantry':
      return 'basket-outline';
    case 'counter':
      return 'tablet-landscape-outline';
    default:
      return 'cube-outline';
  }
}
