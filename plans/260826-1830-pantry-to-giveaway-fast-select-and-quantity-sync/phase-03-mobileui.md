---
phase: 3
title: "Mobile UI Pantry Fast-Select & Quantity Flow"
status: complete
priority: P1
dependencies: [1, 2]
---

# Phase 3: Mobile UI Pantry Fast-Select & Quantity Flow

## Overview
Implement a fast pantry product selection bottom sheet (`PantrySelectModal`) in the mobile app, wire instant auto-fill for giveaway creation, add quantity controls, and handle local WatermelonDB record synchronization.
### Functional Requirements
- **Pantry Selection Trigger**:
  - Add a prominent, styled button at the top of the "Share an Item" screen: `📦 Select from Pantry`.
- **Pantry Selection Modal (`PantrySelectModal`)**:
  - Displays the user's active personal and shared household pantry items from the local database (via `useActiveRecords()`).
  - Search bar to filter by name, brand, or category in real time.
  - Shows thumbnail, custom name / product name, brand, available quantity + unit, scope badge (if household item), and color-coded expiration badge.
  - Tapping an item triggers the auto-fill handler and closes the sheet.
- **Auto-Fill Logic**:
  - Automatically populates:
    - **Title**: `record.customName || product?.name || ''`
    - **Notes / Description**: `record.notes || product?.description || ''`
    - **Item Expiration Date**: `record.expiryDate` (localized via `formatDate(record.expiryDate, userCountry)`)
    - **Photos**: If product or record has an image, loads it into the photos list with `uploadedUrl`.
    - **Record Link**: Sets `recordId: record.id` and `productId: record.productId`.
    - **Quantity & Unit**: Sets `quantity` (default 1) and `unit: record.unit`, with maximum allowed quantity equal to `record.quantity`.
- **Quantity Selector on Giveaway Form**:
  - Includes a quantity stepper (+ / -) allowing the user to specify how many units they are giving away (e.g. giving 1 out of 3 packs).
- **Giveaway Cards & Detail Display**:
  - Show quantity and unit on `GiveawayCard` and `giveaway/[id].tsx` (e.g., `2 bottles`, `1 box`).

---

## Component Architecture

### `PantrySelectModal.tsx` Design
```tsx
// apps/mobile/src/features/giveaways/PantrySelectModal.tsx
export interface PantrySelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectRecord: (record: LocalRecord, product?: Product | null) => void;
}
```

### Auto-fill Action in `NewGiveawayScreen`
```tsx
const handleSelectPantryItem = (record: LocalRecord, product?: Product | null) => {
  const name = record.customName || product?.name || '';
  const brand = product?.brand ? `${product.brand} ` : '';
  setTitle(`${brand}${name}`.trim());
  if (record.notes) setDescription(record.notes);
  if (record.expiryDate) setExpiryDate(record.expiryDate);
  setSelectedRecordId(record.id);
  setSelectedProductId(record.productId ?? undefined);
  setMaxAvailableQty(record.quantity);
  setQuantity(1);
  setUnit(record.unit || 'pcs');

  // Auto-populate photo if available
  const existingImg = record.photoUrl || product?.imageUrl;
  if (existingImg && photos.length === 0) {
    setPhotos([{ id: `pantry-${Date.now()}`, path: existingImg, uploadedUrl: existingImg }]);
  }
};
```

---

## Related Code Files
- Create: `apps/mobile/src/features/giveaways/PantrySelectModal.tsx`
- Modify: `apps/mobile/app/(app)/giveaway/new.tsx`
- Modify: `apps/mobile/src/features/giveaways/GiveawayCard.tsx`
- Modify: `apps/mobile/app/(app)/giveaway/[id].tsx`
- Modify: `apps/mobile/src/features/giveaways/GiveawayQuickEditModal.tsx`
- Create: `apps/mobile/__tests__/PantrySelectModal.test.tsx`
- Modify: `apps/mobile/__tests__/NewGiveawayScreen.test.tsx`

---

## Implementation Steps
1. Create `PantrySelectModal.tsx` displaying active pantry items with live search filtering, status indicators, and item metadata.
2. Integrate `PantrySelectModal` into `NewGiveawayScreen` with the `Select from Pantry` button.
3. Wire the auto-fill handler to populate title, description, photos, expiration date, `recordId`, `productId`, quantity, and unit.
4. Add quantity and unit stepper controls to `NewGiveawayScreen` and `GiveawayQuickEditModal`.
5. Display quantity on `GiveawayCard` and `GiveawayDetailScreen`.
6. Write unit tests in `PantrySelectModal.test.tsx` and `NewGiveawayScreen.test.tsx`.

---

## Success Criteria
- [x] Tapping "Select from Pantry" opens the item selection modal.
- [x] Selecting a pantry item instantly populates the giveaway fields without manual typing.
- [x] Giveaway quantity stepper prevents selecting more than available in the pantry.
- [x] Giveaway cards and details show the item quantity.
