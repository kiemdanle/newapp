import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export const DEFAULT_TOP_4_UNITS = ['pcs', 'pack', 'can', 'bottle'] as const;
export const TOP_UNITS_STORAGE_KEY = '@expyrico_pantry_top_units';

export interface UnitCategory {
  title: string;
  units: Array<{
    key: string;
    label: string;
    sublabel?: string;
  }>;
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    title: 'Packaged & Containers',
    units: [
      { key: 'box', label: 'Box', sublabel: 'Boxes / Cartons' },
      { key: 'bag', label: 'Bag', sublabel: 'Bags / Sacks' },
      { key: 'jar', label: 'Jar', sublabel: 'Glass / Plastic jars' },
      { key: 'carton', label: 'Carton', sublabel: 'Milk / Egg cartons' },
      { key: 'tub', label: 'Tub', sublabel: 'Butter / Ice cream tubs' },
      { key: 'bunch', label: 'Bunch', sublabel: 'Herbs / Bananas' },
      { key: 'bar', label: 'Bar', sublabel: 'Chocolate / Soap bars' },
      { key: 'roll', label: 'Roll', sublabel: 'Paper / Foil rolls' },
    ],
  },
  {
    title: 'Metric System',
    units: [
      { key: 'kg', label: 'Kilogram', sublabel: 'kg · Mass' },
      { key: 'g', label: 'Gram', sublabel: 'g · Small mass' },
      { key: 'l', label: 'Liter', sublabel: 'l · Liquid volume' },
      { key: 'ml', label: 'Milliliter', sublabel: 'ml · Liquid volume' },
    ],
  },
  {
    title: 'American Imports (US Customary)',
    units: [
      { key: 'oz', label: 'Ounce', sublabel: 'oz · Weight (16 oz = 1 lb)' },
      { key: 'lb', label: 'Pound', sublabel: 'lb · Weight' },
      { key: 'fl oz', label: 'Fluid Ounce', sublabel: 'fl oz · Liquid volume' },
      { key: 'gal', label: 'Gallon', sublabel: 'gal · Liquid volume' },
      { key: 'pt', label: 'Pint', sublabel: 'pt · Liquid volume' },
      { key: 'qt', label: 'Quart', sublabel: 'qt · Liquid volume' },
    ],
  },
];

export function normalizeUnit(unit: string | null | undefined): string {
  if (!unit) return 'pcs';
  return unit.trim().toLowerCase();
}

export function usePantryTopUnits(): string[] {
  const { data } = useQuery({
    queryKey: ['settings', 'pantry-units'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ topUnits: string[] }>('/settings/pantry-units');
        if (res?.topUnits && Array.isArray(res.topUnits) && res.topUnits.length === 4) {
          void AsyncStorage.setItem(TOP_UNITS_STORAGE_KEY, JSON.stringify(res.topUnits));
          return res.topUnits;
        }
      } catch {
        // Fall back to AsyncStorage cache
      }
      try {
        const cached = await AsyncStorage.getItem(TOP_UNITS_STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as string[];
          if (Array.isArray(parsed) && parsed.length === 4) return parsed;
        }
      } catch {}
      return [...DEFAULT_TOP_4_UNITS];
    },
    staleTime: 5 * 60 * 1000,
  });

  return data ?? [...DEFAULT_TOP_4_UNITS];
}
