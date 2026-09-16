---
phase: 4
title: "List View, Table & Reusable Pagination"
status: pending
priority: P1
effort: "6h"
dependencies: ["phase-03-admin-client-and-actions"]
---

# Phase 4: List View, Table & Reusable Pagination

## Overview
Develop the primary administrative list view for user pantry items at `/pantry-items`. This phase introduces a versatile, reusable `Pagination` component supporting dynamic items-per-page selection, a comprehensive multi-criteria `FilterBar`, and an interactive, sortable `DataTable` displaying item metadata, owner profiles, storage locations, expiry indicators, and quick action triggers.

---

## Requirements

### Functional Requirements
- **Reusable Pagination Component (`apps/admin/src/components/pagination.tsx`)**:
  - Props: `currentPage` (number), `totalPages` (number), `totalItems` (number), `pageSize` (number), `pageSizeOptions` (e.g. `[10, 25, 50, 100]`), `basePath` (string), `queryParams` (Record<string, string | undefined>).
  - Summary label: "Showing `<from>` to `<to>` of `<total>` items" (e.g. "Showing 1 to 25 of 142 items").
  - Page size dropdown: `<select>` allowing administrators to select 10, 25, 50, or 100 items per page. Selecting a new size immediately updates the `limit` query param and resets `page=1` while preserving all active search and filter parameters.
  - Page navigation controls:
    - Previous button (`ChevronLeft`), disabled on page 1.
    - Numeric page buttons with active state styling (`bg-primary text-white`).
    - Smart ellipsis (`...`) for large page counts (e.g. `1 ... 4 5 6 ... 20`).
    - Next button (`ChevronRight`), disabled on the last page.
- **Pantry Items Filter Bar (`apps/admin/src/app/(admin)/pantry-items/pantry-items-filter.tsx`)**:
  - Keyword search input (`q`): searches across custom name, product name, brand, category, notes, user email, barcode.
  - Location select filter (`location`): populated dynamically from `filterOptions.locations` ("All Locations", "Fridge", "Freezer", "Pantry", etc.).
  - Category select filter (`category`): populated from `filterOptions.categories`.
  - Brand select filter (`brand`): populated from `filterOptions.brands`.
  - Product type filter (`productType`): "All Items", "Catalog Product", "Custom Item".
  - Status filter (`status`): "All Statuses", "Active", "Consumed", "Discarded", "Expired".
  - Reset / Clear Filters button: clears active filters and search term back to default.
- **Sortable Pantry Items Table (`apps/admin/src/app/(admin)/pantry-items/pantry-items-table.tsx`)**:
  - Columns:
    - **Item / Product**: Thumbnail image (or fallback icon), item name, custom vs catalog badge, barcode tag.
    - **Brand & Category**: Secondary metadata tags.
    - **Owner**: User initials avatar, full name, email address, link to `/users/[userId]`.
    - **Location**: Storage location pill (e.g., "Fridge", "Pantry").
    - **Quantity**: Numerical quantity + unit (e.g., "2 pcs", "500 g").
    - **Expiry & Status**: Status badge (Active in Fresh Sage `#4BAE8A`, Consumed in Pebble `#8C8C85`, Discarded in Alert Red `#E0442A`, Expired in Honey `#F5A623`), Expiry date with days-remaining countdown chip.
    - **Added**: Relative / ISO date of `createdAt`.
    - **Actions**: "View Details", "Edit" (deep link to `/pantry-items/[id]` to load full detail context before editing), "Mark as Discarded" (soft discard modal), and "Permanently Delete" (destructive modal).
  - Sortable column headers:
    - Interactive sort toggles on `Expiry Date` (default: `asc`), `Quantity`, `Added Date`, and `Item Name`.
    - Column header renders ascending/descending arrow indicators reflecting active `sortBy` and `sortOrder`.
- **List Page Server Component (`apps/admin/src/app/(admin)/pantry-items/page.tsx`)**:
  - Reads search params from the URL.
  - Concurrently queries `serverAdminApi.pantryItems.list(query)` and `serverAdminApi.pantryItems.filterOptions()`.
  - Renders the KPI metrics banner (Total Items, Active Items, Expired/Expiring Soon), FilterBar, Sortable Table, and Pagination.

### Non-functional Requirements
- Strict adherence to the Expyrico Colour Palette:
  - Fresh Sage (`#4BAE8A`) for primary actions and active status.
  - Deep Sage (`#3A8F6F`) for hover/pressed states and table headers.
  - Alert Red (`#E0442A`) for expired/discarded items and destructive actions.
  - Warm White (`#FAFAF8`) and Stone (`#F0F0ED`) for card backgrounds and borders.
  - Almost Black (`#2C2C28`) for primary typography.
- Mobile-responsive layout: filter bar collapses smoothly on small viewports; table scrolls horizontally with sticky action column if necessary.

---

## Architecture

```
  URL State (?q=milk&location=Fridge&sortBy=expiryDate&sortOrder=asc&page=2&limit=25)
                                    │
                                    ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │       apps/admin/src/app/(admin)/pantry-items/page.tsx (Server)        │
  │                                                                        │
  │  1. Parse SearchParams                                                 │
  │  2. Promise.all([ list(query), filterOptions() ])                      │
  │                                                                        │
  │  ┌──────────────────────────────────────────────────────────────────┐  │
  │  │ Header & Summary KPI Cards (Total, Active, Expiring Soon)        │  │
  │  └──────────────────────────────────────────────────────────────────┘  │
  │  ┌──────────────────────────────────────────────────────────────────┐  │
  │  │ PantryItemsFilter (Search input, Location, Category, Brand,      │  │
  │  │                    ProductType, Status dropdowns)                │  │
  │  └──────────────────────────────────────────────────────────────────┘  │
  │  ┌──────────────────────────────────────────────────────────────────┐  │
  │  │ PantryItemsTable (Sortable headers, user links, status badges,   │  │
  │  │                   row action menus)                              │  │
  │  └──────────────────────────────────────────────────────────────────┘  │
  │  ┌──────────────────────────────────────────────────────────────────┐  │
  │  │ Pagination (Range summary, Prev/Next, Page numbers, Limit select)│  │
  │  └──────────────────────────────────────────────────────────────────┘  │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## Related Code Files
- Create: `apps/admin/src/components/pagination.tsx`
- Create: `apps/admin/src/app/(admin)/pantry-items/page.tsx`
- Create: `apps/admin/src/app/(admin)/pantry-items/pantry-items-filter.tsx`
- Create: `apps/admin/src/app/(admin)/pantry-items/pantry-items-table.tsx`
- Modify: `apps/admin/src/components/sidebar.tsx`

---

## Implementation Steps
1. Create `apps/admin/src/components/pagination.tsx`:
   - Implement item range calculation: `from = (page - 1) * limit + 1`, `to = Math.min(page * limit, total)`.
   - Implement page range algorithm (showing first, last, current ± 2 pages with ellipses).
   - Implement `<select>` for page sizes (`[10, 25, 50, 100]`), triggering URL navigation with updated `limit` and `page=1`.
   - Implement Next.js `<Link>` buttons for previous, next, and specific page numbers, merging existing query parameters.
2. Create `apps/admin/src/app/(admin)/pantry-items/pantry-items-filter.tsx`:
   - Use `<form method="get">` to submit filters naturally via standard URL search params.
   - Include `<input name="q" />` for search keyword.
   - Include dropdown selects for `location`, `category`, `brand`, `productType`, and `status`.
   - Preserve existing `limit`, `sortBy`, and `sortOrder` via hidden inputs.
   - Add "Clear Filters" link when active query parameters exist.
3. Create `apps/admin/src/app/(admin)/pantry-items/pantry-items-table.tsx`:
   - Implement table structure using Tailwind CSS and Expyrico palette tokens.
   - For sortable headers (`Expiry Date`, `Quantity`, `Added`, `Name`), render interactive links toggling between `asc` and `desc`.
   - Render owner column with link to `/users/${userId}` and email display.
   - Render location badge with distinct pastel styling (`#D6F0E6` Mint Mist background).
   - Render status pill using `StatusBadge` or custom status token (`active` -> Fresh Sage, `consumed` -> Pebble, `discarded` -> Alert Red).
   - Render action buttons: "View" link, "Edit" button, and "Delete" trigger.
4. Create `apps/admin/src/app/(admin)/pantry-items/page.tsx`:
   - Resolve search params promise in Next.js App Router.
   - Fetch data via `serverAdminApi.pantryItems.list(query)` and `filterOptions()`.
   - Render header with total item counter, filter bar, data table, and pagination controls.
5. Add unit tests for `Pagination` in `apps/admin/src/components/__tests__/pagination.test.tsx` checking:
   - Page range bounds and ellipsis rendering.
   - Page size change URL construction.
   - Disable state for prev/next buttons on edges.

---

## Success Criteria
- [x] Admin can search by keyword and immediately see filtered results in the table.
- [x] Filtering by location, category, brand, product type, and status operates accurately.
- [x] Clicking sortable column headers toggles sort field and order, reloading the sorted data.
- [x] Selecting a different page size (e.g. 50 or 100) updates the table page size and returns to page 1.
- [x] Navigating between pages (Next, Previous, direct page click) displays the appropriate slice of items.
- [x] Expyrico palette colors and typographic tokens are strictly honored across all new components.

---

## Risk Assessment
- **Risk:** User selects page 10 on limit 10 (item 91-100), then switches limit to 100. If page remained 10, offset would be 900 which is out of range.
  - *Mitigation:* The `Pagination` component's page size selector explicitly resets `page=1` whenever `limit` changes.
  - *Breakage Signal:* Blank table rendered after switching page size on higher page numbers.
  - *Response:* Enforce `page=1` in the page size change URL builder.

<!-- Updated: Validation Session 1 - Default sort expiryDate asc, limit 25, and dual discard/delete row actions -->

<!-- Updated: Red Team Review - Added expired status badge, cached filter options, and row-edit navigation link -->
