---
phase: 1
title: "AddRecordForm Custom Item Support & Category Chips"
status: pending
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: AddRecordForm Custom Item Support & Category Chips

## Overview
Enhance `AddRecordForm` so it natively supports creating custom pantry records without a catalog product ID (`productId == null`), providing an inline editable item name field, validation, and standard category quick-selection chips.

## Requirements
- Functional:
  - When `productId == null` (custom manual item), render an editable `Item Name` field (`TextInput`) at the top of the form with autofocus, clear button, and label `"Item name *"`.
  - Validate that `customName.trim().length > 0` before saving. If blank, show an inline error: `"Item name is required"`.
  - Pre-populate the Item Name input with `customName` prop (or empty string if entering from scratch).
  - Integrate `STANDARD_CATEGORIES` chips row below the Category input (`Produce`, `Dairy`, `Bakery`, `Meat & Seafood`, `Pantry`, `Frozen`, `Beverages`, `Snacks`, `Other`) for 1-tap categorization, while preserving free-text input for custom categories.
  - Ensure all existing fields (WheelDatePicker, OCR scan button, UnitSelector, quantity, photo picker, price, store, notes, household scope) continue to work smoothly with custom items.
  - On save, invoke `createLocalRecord` with `{ productId: null, customName: trimmedName, category, ... }` and pass the new `localId` to `onSaved(localId)`.
- Non-functional:
  - Match Expyrico design system tokens (`theme.colors.bgElevated`, `theme.colors.border`, `theme.colors.primaryLight`, `theme.colors.primaryDark`, `theme.colors.text`, `theme.colors.textMuted`).
  - Touch targets $\ge 44 \times 44\text{ pt}$ for all buttons and chips.
  - Zero regression for existing catalog product additions (`productId != null`).

## Architecture
```
AddRecordForm Component
├── [If productId == null]: Editable Item Name Field (<TextInput testID="add-record-custom-name" />)
├── [If productId != null]: Fixed Header (<Text>PANTRY ITEM</Text> <Text>{productName}</Text>)
├── Photo Picker Section (Take photo / Gallery)
├── Expiry Date Section (WheelDatePickerModal trigger + OCR Scan Date button)
├── Quantity & Unit (Quantity TextInput + UnitSelector pills)
├── Category Section:
│   ├── Category TextInput
│   └── Horizontal Scrollable Chips (<STANDARD_CATEGORIES>)
├── Notes (multiline TextInput)
├── Accordion (+ More details: Price, Store)
├── Household Scope Selector (if member of households)
└── Save Button -> createLocalRecord() -> onSaved(localId)
```

## Related Code Files
- Modify: `apps/mobile/src/features/records/AddRecordForm.tsx`
- Modify: `apps/mobile/src/features/records/PantryFilterModal.tsx` (import `STANDARD_CATEGORIES`)
- Test: `apps/mobile/src/features/records/__tests__/AddRecordForm.test.tsx` (or new test file)

## Implementation Steps
1. In `apps/mobile/src/features/records/AddRecordForm.tsx`:
   - Add state `const [itemName, setItemName] = useState(() => customName ?? productName ?? '');`
   - In the render tree, if `!productId`:
     - Render an `Item Name` field with `testID="add-record-custom-name"`, `accessibilityLabel="Item Name"`, placeholder `"e.g. Fresh salmon, Apples, Sourdough"`, autofocus, and clear affordance.
   - In `save()`:
     - If `!finalProductId && !itemName.trim()`:
       - Set `setError('Item name is required')` and return early.
     - Pass `customName: finalProductId ? null : itemName.trim()` to `createLocalRecord`.
2. Integrate Category quick-selection chips:
   - Import `STANDARD_CATEGORIES` from `PantryFilterModal.tsx`.
   - Render horizontal scrollable chips below the Category input.
   - Tapping an active chip toggles it off; tapping an inactive chip populates the input and marks it active.
3. Verify backward compatibility:
   - When opened with `productId` (catalog product), the editable item name field is hidden and the catalog `productName` is shown as before.

## Success Criteria
- [ ] `AddRecordForm` renders an editable `Item Name` input when `productId` is null or undefined.
- [ ] Blank item names produce an immediate user-friendly error without saving.
- [ ] Category chips allow 1-tap category selection.
- [ ] Successfully calls `createLocalRecord` with custom name, category, and expiry date.
- [ ] Catalog product additions (`productId != null`) continue to render catalog product titles without regression.

## Risk Assessment
- Risk: Users editing an existing catalog item might accidentally alter catalog product name.
  - Mitigation: Editable item name field is conditionally rendered ONLY when `productId == null` (custom pantry records). Catalog products keep the static verified catalog header.
- Risk: Re-rendering on category selection might cause text input blur.
  - Mitigation: Manage category state as controlled string state, updating `category` without remounting the input.
