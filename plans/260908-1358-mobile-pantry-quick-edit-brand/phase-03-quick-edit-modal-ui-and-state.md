---
phase: 3
title: "QuickEditModal UI & State Wiring"
status: pending
priority: P1
effort: "45m"
dependencies: ["2"]
---

# Phase 3: QuickEditModal UI & State Wiring

## Overview
Update `QuickEditModal` to introduce a dedicated **Brand** input field positioned directly below **Item Name**, wire up reactive state with asynchronous product catalog fallbacks, and pass edited brand data through the `onSave` callback.

## Requirements
- Functional:
  - Render a `TextField` labeled `"Brand (optional)"` placed immediately below the `"Item Name"` field.
  - Pre-populate brand from `record.brand`, falling back to `product?.brand` if `record.brand` is unset.
  - If catalog product details load asynchronously after modal mount, automatically populate the brand input unless the user has already typed in it.
  - If the user clears the brand input to empty, `handleSave` saves `brand: null`, falling back to displaying the catalog `product.brand` on pantry cards.
  - Include `testID="quick-edit-brand-input"` and `autoCapitalize="words"`.
  - On submit, pass `brand: brand.trim() || null` in the `onSave` payload.
  <!-- Updated: Validation Session 1 - Brand (optional) label and catalog fallback when cleared -->
- Non-functional:
  - Visual hierarchy: matches Expyrico spacing, typography, colors, and border styling from `TextField`.
  - Touch target compliance: input minHeight $\ge 44\text{ pt}$.
  - User edit tracking: `userEditedBrandRef` prevents background network fetches from overwriting user-typed text.

## UI Placement & Layout
```
┌────────────────────────────────────────────────────────┐
│ Quick Edit                                         [X] │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Item Name                                              │
│ [ Fresh Milk                                         ] │
│                                                        │
│ Brand (optional)                                         │ ◄── DIRECTLY BELOW ITEM NAME
│ [ TH True Milk                                       ] │
│                                                        │
│ Category                                               │
│ [ Dairy                                              ] │
│ [Produce] [Dairy] [Bakery] [Meat & Seafood] [Pantry]   │
│                                                        │
│ Quantity                                               │
│ [-] [ 1 ] [+]                                          │
│                                                        │
│ Unit                                                   │
│ [pcs ⌵]                                                │
│                                                        │
│ Location (optional)                                    │
│ [Fridge ⌵]                                             │
│                                                        │
│ Expiry Date                                            │
│ [ 23/09/2026 ⌵ ]                                       │
│                                                        │
│ [  Cancel  ]                      [  Save  ]           │
└────────────────────────────────────────────────────────┘
```

## Related Code Files
- Modify: `apps/mobile/src/features/records/QuickEditModal.tsx`
- Modify: `apps/mobile/src/features/records/QuickEditModal.test.tsx`

## Implementation Steps
1. **Update Props & Interface**:
   - In `apps/mobile/src/features/records/QuickEditModal.tsx`:
     - Update `onSave` prop signature:
       ```typescript
       onSave: (patch: {
         customName?: string | null;
         brand?: string | null;
         category?: string | null;
         quantity: number;
         unit: string;
         expiryDate: string;
         location?: string | null;
       }) => Promise<void>;
       ```
2. **State & Ref Management**:
   - Add state: `const [brand, setBrand] = useState('');`
   - Add ref: `const userEditedBrandRef = useRef(false);`
   - In `useEffect`:
     - On record initialization:
       ```typescript
       const initialBrand = record.brand || product?.brand || '';
       setBrand(initialBrand);
       userEditedBrandRef.current = false;
       ```
     - In asynchronous product fetch branch:
       ```typescript
       if (!userEditedBrandRef.current && !record.brand && !brand && product?.brand) {
         setBrand(product.brand);
       }
       ```
     - Reset refs when closing or switching records: `userEditedBrandRef.current = false;`.
3. **UI Input Placement**:
   - In the form scroll content, insert the Brand `TextField` immediately following `Item Name`:
     ```tsx
     {/* Brand */}
     <TextField
       testID="quick-edit-brand-input"
       label="Brand (optional)"
       value={brand}
       onChangeText={(val) => {
         userEditedBrandRef.current = true;
         setBrand(val);
       }}
       placeholder={product?.brand || 'e.g. Chobani, Heinz, Vinamilk'}
       autoCapitalize="words"
     />
     ```
4. **Save Handler**:
   - In `handleSave`:
     ```typescript
     await onSave({
       customName: customName.trim() || null,
       brand: brand.trim() || null,
       category: category.trim() || null,
       quantity: validQty,
       unit: unit.trim() || 'pcs',
       expiryDate: trimmedExpiry,
       location: location ? location.trim().slice(0, 50) : null,
     });
     ```
5. **Unit Tests in `QuickEditModal.test.tsx`**:
   - Add test: "renders brand input pre-populated from record.brand".
   - Add test: "falls back to product.brand when record.brand is null".
   - Add test: "saves updated brand to onSave callback".
   - Add test: "allows clearing brand to null".

## Success Criteria
- [ ] `Brand` input is visibly rendered right below `Item Name`.
- [ ] Pre-populates with `record.brand` or fallback `product.brand`.
- [ ] User can edit, clear, and submit brand.
- [ ] All unit tests in `QuickEditModal.test.tsx` pass.

## Risk Assessment
- **Risk**: Asynchronous catalog product fetch overwriting user input while modal is open.
  - **Mitigation**: Guard with `userEditedBrandRef.current`, exactly matching the battle-tested `userEditedNameRef` and `userEditedCategoryRef` guards.
  - **Observable Signal**: User types a brand, but it resets to catalog brand when the network query settles.
  - **Response**: Assert `userEditedBrandRef.current === true` on every `onChangeText` event.
