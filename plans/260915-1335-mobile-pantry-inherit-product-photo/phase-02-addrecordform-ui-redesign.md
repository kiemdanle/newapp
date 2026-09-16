---
phase: 2
title: "AddRecordForm UI Redesign & Product Photo Preview"
status: pending
priority: P1
effort: "1.5h"
dependencies: ["1"]
---

# Phase 2: AddRecordForm UI Redesign & Product Photo Preview

<!-- Updated: Red Team Review Session 1 - ProductThumbnail delegation, concrete effectiveProduct contract, and multi-photo strip append -->

## Overview

Redesign the "Item photos (optional)" section in `AddRecordForm` so that when an item has an inherited product photo from newly created product submission (`isNewlyCreatedProduct && hasProductPhoto`), it displays a clean, reassuring photo preview card with a `Product photo` badge instead of demanding that the user take a photo again. If the user chooses to add an extra photo, it appends into a multi-photo strip alongside the pinned product photo.

## Requirements

### Functional
- **Contract & Gating**:
  - Derive `effectiveProduct = initialProduct ?? product`.
  - Derive `hasProductPhoto = Boolean(effectiveProduct?.imageUrl || (effectiveProduct?.photos && effectiveProduct.photos.length > 0))`.
  - Gate on `isNewlyCreatedProduct && hasProductPhoto`:
- **State A (`photos.length === 0`)**:
  - Hide the large empty `[Take photo] [Choose photo]` button block.
  - Render `InheritedProductPhotoCard`:
    - Renders `<ProductThumbnail product={effectiveProduct} size={68} style={styles.inheritedPhotoImage} fallbackIcon="cube-outline" />`.
    - Features a semantic pill badge: `<Ionicons name="cube-outline" size={12} color={theme.colors.primaryDark} />` with text `Product photo`.
    - Displays reassuring subtext: *"Photo from product creation will be used for this item. You don't need to take another photo."*
    - Provides an optional secondary action: `+ Add extra photo` (`testID="add-record-add-custom-photo-btn"`).
- **State B (`photos.length > 0`)**:
  - Render horizontal multi-photo strip:
    - Slot 0: Pinned product photo rendered via `<ProductThumbnail product={effectiveProduct} size={68} />` with an overlay tag `Product` (non-removable).
    - Slot 1+: User's custom photo thumbnail(s) with red remove (`close`) button.
    - Trailing `+ Add` dashed card if `photos.length < maxPantryItemPhotos`.
    - Subtext below strip: *"Product photo is preserved alongside your custom item photos."*
- **Fallback (`!isNewlyCreatedProduct || !hasProductPhoto`)**:
  - When `photos.length === 0`: render standard `[Take photo] [Choose photo]` buttons for uncataloged manual items.
  - When `photos.length > 0`: render standard custom photo strip.

### Non-Functional & Craft Discipline (ak:frontend-design)
- **Palette**: Expyrico Warm White (`#FAFAF8`), Fresh Sage (`#4BAE8A`), Mint Mist (`#D6F0E6`), Stone (`#F0F0ED`), and Pebble (`#8C8C85`).
- **Touch Targets**: All interactive buttons meet $\ge 44\times 44\text{px}$ minimum clickable area.
- **Scale**: Spacing sits strictly on the 4pt scale (4, 8, 12, 16, 20px).
- **Press Feedback**: Buttons use `transform: [{ scale: pressed ? 0.985 : 1 }]` and opacity shift.

## UI Design Specification

### State A: Newly Created Product (No extra photos added yet)
```
+-------------------------------------------------------------+
| Item Photo                                                  |
+-------------------------------------------------------------+
| +-------+  [cube-outline] Product photo                     |
| |       |                                                   |
| | Thumb |  Photo from product creation will be used for     |
| | (68)  |  this item. You don't need to take another photo. |
| |       |                                                   |
| +-------+  [ + Add extra photo (optional) ]                 |
+-------------------------------------------------------------+
```

### State B: User Appended Extra Custom Photo (Multi-Photo Strip)
```
+-------------------------------------------------------------+
| Item Photos (2)                                             |
+-------------------------------------------------------------+
| [ +-------+ ]  [ +-------+ [x] ]  [ +-------+ ]             |
| [ | Prod  | ]  [ | User  |     ]  [ |   +   | ]             |
| [ | Thumb | ]  [ | Custom|     ]  [ |  Add  | ]             |
| [ +-------+ ]  [ +-------+     ]  [ +-------+ ]             |
| [ PRODUCT   ]  [ PHOTO 1       ]                            |
| Product photo is preserved alongside your custom photos.    |
+-------------------------------------------------------------+
```

## Related Code Files

- Modify: `apps/mobile/src/features/records/AddRecordForm.tsx` (Photo section render logic and styling)

## Implementation Steps

1. **Derive Effective Product and HasPhoto in `AddRecordForm.tsx`**:
   ```tsx
   const effectiveProduct = initialProduct ?? product;
   const hasProductPhoto = Boolean(
     effectiveProduct?.imageUrl ||
     (effectiveProduct?.photos && effectiveProduct.photos.length > 0)
   );
   ```

2. **Render Photo Section**:
   ```tsx
   {isNewlyCreatedProduct && hasProductPhoto ? (
     photos.length === 0 ? (
       // State A: Single Inherited Product Photo Preview Card
       <View
         testID="add-record-inherited-product-photo"
         style={[
           styles.inheritedPhotoCard,
           {
             backgroundColor: isDark ? theme.colors.bgGlass : '#FFFFFF',
             borderColor: theme.colors.border,
           },
         ]}
       >
         <View style={styles.inheritedPhotoThumbWrap}>
          <ProductThumbnail
            product={effectiveProduct}
            firstPhoto={effectiveProduct?.photos?.[0]}
            size={68}
            style={styles.inheritedPhotoImage}
            fallbackIcon="cube-outline"
          />
         </View>
         <View style={styles.inheritedPhotoInfoCol}>
           <View style={[styles.inheritedPhotoBadge, { backgroundColor: theme.colors.primaryLight }]}>
             <Ionicons name="cube-outline" size={12} color={theme.colors.primaryDark} />
             <Text style={[styles.inheritedPhotoBadgeText, { color: theme.colors.primaryDark }]}>
               Product photo
             </Text>
           </View>
           <Text style={[styles.inheritedPhotoHint, { color: theme.colors.textMuted }]}>
             Photo from product creation will be used for this item. You don't need to take another photo.
           </Text>
           <Pressable
             testID="add-record-add-custom-photo-btn"
             accessibilityRole="button"
             accessibilityLabel="Add an extra custom photo for this item"
             onPress={onChoosePhotos}
             style={({ pressed }) => [
               styles.addCustomPhotoBtn,
               {
                 borderColor: theme.colors.border,
                 backgroundColor: pressed ? theme.colors.neutralLight : 'transparent',
                 opacity: pressed ? 0.85 : 1,
                 transform: [{ scale: pressed ? 0.985 : 1 }],
               },
             ]}
           >
             <Ionicons name="camera-outline" size={14} color={theme.colors.text} />
             <Text style={[styles.addCustomPhotoBtnText, { color: theme.colors.text }]}>
               Add extra photo
             </Text>
           </Pressable>
         </View>
       </View>
     ) : (
       // State B: Multi-Photo Strip (Slot 0: Pinned Product Photo + Slot 1+: Custom Photos)
       <View style={{ gap: 10 }}>
         <ScrollView
           horizontal
           showsHorizontalScrollIndicator={false}
           contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
           keyboardShouldPersistTaps="handled"
         >
           {/* Pinned Slot 0: Product photo */}
           <View style={{ position: 'relative', width: 68, height: 68 }}>
            <ProductThumbnail
              product={effectiveProduct}
              firstPhoto={effectiveProduct?.photos?.[0]}
              size={68}
              style={{ width: 68, height: 68, borderRadius: theme.radii.md }}
              fallbackIcon="cube-outline"
            />
               <Text style={[styles.pinnedProductTagText, { color: theme.colors.textMuted }]}>Product</Text>
             </View>
           </View>

           {/* Slot 1+: User custom photos with remove buttons */}
           {photos.map((p, index) => (
             <View key={`${p.path}-${index}`} style={{ position: 'relative', width: 68, height: 68 }}>
               <Image
                 testID={`add-record-photo-preview-${index}`}
                 source={{ uri: p.path.startsWith('/') ? `file://${p.path}` : p.path }}
                 style={{ width: 68, height: 68, borderRadius: theme.radii.md, backgroundColor: theme.colors.neutralLight }}
                 accessibilityIgnoresInvertColors
               />
               <Pressable
                 testID={`add-record-photo-remove-${index}`}
                 accessibilityRole="button"
                 accessibilityLabel={`Remove custom photo ${index + 1}`}
                 onPress={() => handleRemovePhoto(index)}
                 style={styles.removePhotoBadge}
               >
                 <Ionicons name="close" size={14} color="#FFFFFF" />
               </Pressable>
             </View>
           ))}

           {/* Trailing Add Button if capacity remains */}
           {photos.length < maxPantryItemPhotos ? (
             <Pressable
               testID="add-record-add-more-photos"
               accessibilityRole="button"
               accessibilityLabel="Add more photos"
               onPress={onChoosePhotos}
               style={[
                 styles.addMoreCard,
                 {
                   borderColor: isDark ? theme.colors.border : theme.colors.primary,
                   backgroundColor: isDark ? theme.colors.bgGlass : theme.colors.primaryLight,
                 },
               ]}
             >
               <Ionicons name="add" size={20} color={isDark ? theme.colors.primary : theme.colors.primaryDark} />
               <Text style={[styles.addMoreText, { color: isDark ? theme.colors.primary : theme.colors.primaryDark }]}>Add</Text>
             </Pressable>
           ) : null}
         </ScrollView>
         <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>
           Product photo is preserved alongside your custom item photos.
         </Text>
       </View>
     )
   ) : (
     // Fallback for manual entry without newly created product photo
     photos.length > 0 ? (
       <View style={{ gap: 10 }}>{/* existing standard custom photo strip */}</View>
     ) : (
       <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
         <Button testID="add-record-take-photo" label="Take photo" icon="camera" variant="outline" onPress={onTakePhoto} />
         <Button testID="add-record-choose-photo" label="Choose photo" icon="images" variant="outline" onPress={onChoosePhotos} />
       </View>
     )
   )}
   ```

3. **Style Definitions**:
   - `inheritedPhotoCard`: `flexDirection: 'row'`, `padding: 12`, `borderRadius: 14`, `borderWidth: 1`, `gap: 12`.
   - `inheritedPhotoThumbWrap`: `width: 72`, `height: 72`, `borderRadius: 12`, `overflow: 'hidden'`.
   - `inheritedPhotoImage`: `width: '100%'`, `height: '100%'`.
   - `inheritedPhotoInfoCol`: `flex: 1`, `gap: 6`.
   - `inheritedPhotoBadge`: `flexDirection: 'row'`, `alignItems: 'center'`, `gap: 4`, `paddingHorizontal: 8`, `paddingVertical: 3`, `borderRadius: 8`, `alignSelf: 'flex-start'`.
   - `inheritedPhotoBadgeText`: `fontSize: 11`, `fontWeight: '700'`.
   - `inheritedPhotoHint`: `fontSize: 12`, `lineHeight: 16`.
   - `addCustomPhotoBtn`: `flexDirection: 'row'`, `alignItems: 'center'`, `gap: 6`, `paddingVertical: 6`, `paddingHorizontal: 10`, `borderRadius: 8`, `borderWidth: 1`, `alignSelf: 'flex-start'`.
   - `addCustomPhotoBtnText`: `fontSize: 12`, `fontWeight: '600'`.
   - `pinnedProductTag`: `position: 'absolute'`, `bottom: 0`, `left: 0`, `right: 0`, `paddingVertical: 1`, `alignItems: 'center'`, `borderBottomLeftRadius: 12`, `borderBottomRightRadius: 12`.
   - `pinnedProductTagText`: `fontSize: 9`, `fontWeight: '800'`, `textTransform: 'uppercase'`.
   - `removePhotoBadge`: `position: 'absolute'`, `top: -6`, `right: -6`, `backgroundColor: '#E0442A'`, `borderRadius: 11`, `width: 22`, `height: 22`, `alignItems: 'center'`, `justifyContent: 'center'`.
   - `addMoreCard`: `width: 68`, `height: 68`, `borderRadius: 12`, `borderWidth: 1.5`, `borderStyle: 'dashed'`, `alignItems: 'center'`, `justifyContent: 'center'`, `gap: 2`.
   - `addMoreText`: `fontSize: 10`, `fontWeight: '700'`.

## Success Criteria

- [x] `ProductThumbnail` is reused for rendering both the single inherited card and the pinned strip slot.
- [x] No raw relative API routes are passed to bare `<Image>`.
- [x] No undefined variables (`effectiveProductMock` eliminated).
- [x] When `isNewlyCreatedProduct` is true and a photo exists, empty take/choose buttons are omitted.
- [x] When custom photos are appended, both the pinned product photo and custom photos remain visible.

## Risk Assessment

| Risk | Signal | Mitigation |
|---|---|---|
| Image URL is a local or relative API route | Bare `<Image>` throws error | Delegating to `ProductThumbnail` automatically invokes `normalizePhotoUri` and `PrivateProductImage`. |
| Memory leak or scale thrash on press | UI stutter | `transform: [{ scale: pressed ? 0.985 : 1 }]` uses native compositor. |
