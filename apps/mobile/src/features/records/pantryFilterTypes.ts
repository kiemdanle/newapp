// apps/mobile/src/features/records/pantryFilterTypes.ts
import type Ionicons from 'react-native-vector-icons/Ionicons';

export type PantrySortOption =
  | 'expiry_asc'
  | 'expiry_desc'
  | 'name_asc'
  | 'name_desc'
  | 'quantity_desc'
  | 'quantity_asc'
  | 'recently_added';

export interface PantryFilterState {
  query?: string;
  category?: string;
  expiryStatus?: 'all' | 'expired' | 'expiring_soon' | 'good';
  inStockOnly?: boolean;
  householdScope?: 'all' | 'personal' | 'household';
  store?: string;
}

export interface PantrySortOptionMeta {
  id: PantrySortOption;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
}

export const PANTRY_SORT_OPTIONS: PantrySortOptionMeta[] = [
  {
    id: 'expiry_asc',
    label: 'Expiring Soon',
    icon: 'hourglass-outline',
    accessibilityLabel: 'Sort by expiring soonest',
  },
  {
    id: 'expiry_desc',
    label: 'Latest Expiry',
    icon: 'calendar-outline',
    accessibilityLabel: 'Sort by latest expiration date',
  },
  {
    id: 'name_asc',
    label: 'Name A–Z',
    icon: 'text-outline',
    accessibilityLabel: 'Sort alphabetically A to Z',
  },
  {
    id: 'name_desc',
    label: 'Name Z–A',
    icon: 'text-outline',
    accessibilityLabel: 'Sort alphabetically Z to A',
  },
  {
    id: 'quantity_desc',
    label: 'Highest Stock',
    icon: 'cube-outline',
    accessibilityLabel: 'Sort by highest quantity',
  },
  {
    id: 'quantity_asc',
    label: 'Lowest Stock',
    icon: 'cube-outline',
    accessibilityLabel: 'Sort by lowest quantity',
  },
  {
    id: 'recently_added',
    label: 'Recently Added',
    icon: 'time-outline',
    accessibilityLabel: 'Sort by recently added',
  },
];
