// apps/mobile/src/features/records/filterAndSortRecords.ts
import type { LocalRecord } from '../../api/records';
import { expiryStatus } from './expiryStatus';
import type { PantryFilterState, PantrySortOption } from './pantryFilterTypes';

function resolveDisplayName(record: LocalRecord, productNameLookup?: Record<string, string>): string {
  if (record.customName && record.customName.trim()) {
    return record.customName.trim();
  }
  if (record.productId && productNameLookup) {
    const lookedUp = productNameLookup[record.productId];
    if (lookedUp) {
      return lookedUp.trim();
    }
  }
  return 'Item';
}

export function matchesPantryQuery(
  record: LocalRecord,
  query: string,
  productNameLookup?: Record<string, string>,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (record.customName && record.customName.toLowerCase().includes(q)) {
    return true;
  }
  if (record.productId && productNameLookup) {
    const productName = productNameLookup[record.productId];
    if (productName && productName.toLowerCase().includes(q)) {
      return true;
    }
  }
  if (record.category && record.category.toLowerCase().includes(q)) {
    return true;
  }
  if (record.notes && record.notes.toLowerCase().includes(q)) {
    return true;
  }
  if (record.store && record.store.toLowerCase().includes(q)) {
    return true;
  }
  return false;
}

export function filterAndSortRecords(
  records: LocalRecord[],
  filters: PantryFilterState = {},
  sort: PantrySortOption = 'expiry_asc',
  productNameLookup?: Record<string, string>,
): LocalRecord[] {
  // 1. Filter Phase
  const filtered = records.filter((record) => {
    // Search query filter
    if (filters.query && !matchesPantryQuery(record, filters.query, productNameLookup)) {
      return false;
    }

    // Category filter
    if (filters.category) {
      if (!record.category || record.category.trim().toLowerCase() !== filters.category.trim().toLowerCase()) {
        return false;
      }
    }

    // Expiry status filter
    if (filters.expiryStatus && filters.expiryStatus !== 'all') {
      const status = expiryStatus(record.expiryDate);
      if (filters.expiryStatus === 'expired' && status !== 'red') {
        return false;
      }
      if (filters.expiryStatus === 'expiring_soon' && status !== 'amber') {
        return false;
      }
      if (filters.expiryStatus === 'good' && status !== 'green') {
        return false;
      }
    }

    // In-stock only filter
    if (filters.inStockOnly) {
      if (record.quantity <= 0) {
        return false;
      }
    }

    // Household scope filter
    if (filters.householdScope && filters.householdScope !== 'all') {
      if (filters.householdScope === 'personal' && record.householdId !== null) {
        return false;
      }
      if (filters.householdScope === 'household' && record.householdId === null) {
        return false;
      }
    }

    // Store filter
    if (filters.store) {
      if (!record.store || record.store.trim().toLowerCase() !== filters.store.trim().toLowerCase()) {
        return false;
      }
    }

    return true;
  });

  // 2. Sort Phase
  return filtered.slice().sort((a, b) => {
    switch (sort) {
      case 'expiry_asc': {
        const cmp = a.expiryDate.localeCompare(b.expiryDate);
        return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
      }
      case 'expiry_desc': {
        const cmp = b.expiryDate.localeCompare(a.expiryDate);
        return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
      }
      case 'name_asc': {
        const nameA = resolveDisplayName(a, productNameLookup);
        const nameB = resolveDisplayName(b, productNameLookup);
        const cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        const expCmp = a.expiryDate.localeCompare(b.expiryDate);
        return expCmp !== 0 ? expCmp : a.id.localeCompare(b.id);
      }
      case 'name_desc': {
        const nameA = resolveDisplayName(a, productNameLookup);
        const nameB = resolveDisplayName(b, productNameLookup);
        const cmp = nameB.localeCompare(nameA, undefined, { sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        const expCmp = a.expiryDate.localeCompare(b.expiryDate);
        return expCmp !== 0 ? expCmp : a.id.localeCompare(b.id);
      }
      case 'quantity_desc': {
        const diff = b.quantity - a.quantity;
        if (diff !== 0) return diff;
        const expCmp = a.expiryDate.localeCompare(b.expiryDate);
        return expCmp !== 0 ? expCmp : a.id.localeCompare(b.id);
      }
      case 'quantity_asc': {
        const diff = a.quantity - b.quantity;
        if (diff !== 0) return diff;
        const expCmp = a.expiryDate.localeCompare(b.expiryDate);
        return expCmp !== 0 ? expCmp : a.id.localeCompare(b.id);
      }
      case 'recently_added': {
        // IDs are UUIDv4 or timestamps; stable descending sort with secondary id tie-breaker
        const cmp = b.id.localeCompare(a.id);
        return cmp !== 0 ? cmp : a.expiryDate.localeCompare(b.expiryDate);
      }
      default: {
        return a.expiryDate.localeCompare(b.expiryDate) || a.id.localeCompare(b.id);
      }
    }
  });
}
