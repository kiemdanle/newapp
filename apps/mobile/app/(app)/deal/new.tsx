// apps/mobile/app/(app)/deal/new.tsx
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { Product } from '@expyrico/shared';
import { useDeal } from '@/api/deals';
import { useProduct, useProductSearch } from '@/api/products';
import type { LocalRecord } from '@/api/records';
import { DealForm } from '@/features/deals/DealForm';
import { PantrySelectModal } from '@/features/giveaways/PantrySelectModal';
import { useTheme } from '@/theme/useTheme';
import type { AppNavigationProp } from '@/navigation/AppNavigator';

export default function NewDealScreen() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute();
  const routeParams = route.params as { editId?: string; productId?: string } | undefined;
  const editId = routeParams?.editId;

  // Edit deal mode
  const { data: existingDeal, isLoading: loadingExisting } = useDeal(editId ?? '');

  // New deal mode state
  const [q, setQ] = useState('');
  const [showPantryModal, setShowPantryModal] = useState(false);
  const initialProductId = routeParams?.productId;
  const { data: initialProduct, isLoading: loadingInitialProduct } = useProduct(
    initialProductId ?? undefined,
  );
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    name: string;
    brand?: string | null;
  } | null>(null);

  React.useEffect(() => {
    if (initialProduct) {
      setSelectedProduct({
        id: initialProduct.id,
        name: initialProduct.name,
        brand: initialProduct.brand,
      });
    }
  }, [initialProduct]);

  const handleSelectPantryRecord = (record: LocalRecord, product?: Product | null) => {
    if (record.productId) {
      setSelectedProduct({
        id: record.productId,
        name: record.customName || product?.name || 'Product',
        brand: product?.brand,
      });
    } else {
      const name = record.customName || 'Item';
      setQ(name);
    }
  };
  const { data: searchResults, isLoading: searching } = useProductSearch(
    q,
    q.trim().length > 0,
  );

  // If in edit mode, wait for deal to load
  if (editId) {
    if (loadingExisting || !existingDeal) {
      return (
        <View style={[styles.center, { backgroundColor: theme.colors.bg }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>
            Loading deal details…
          </Text>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <DealForm
          product={{
            id: existingDeal.productId,
            name: existingDeal.product?.name ?? 'Product',
            brand: existingDeal.product?.brand,
          }}
          existing={existingDeal}
          onDone={() => navigation.goBack()}
        />
      </View>
    );
  }

  // If product is chosen in new deal mode
  if (selectedProduct) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <View
          style={[
            styles.changeProductBanner,
            { backgroundColor: theme.colors.bgElevated, borderBottomColor: theme.colors.border },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textMuted }}>
              SELECTED PRODUCT
            </Text>
            <Text
              style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}
              numberOfLines={1}
            >
              {selectedProduct.name}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelectedProduct(null)}
            style={[
              styles.changeBtn,
              { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radii.pill },
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primaryDark }}>
              Change
            </Text>
          </Pressable>
        </View>
        <DealForm product={selectedProduct} onDone={() => navigation.goBack()} />
      </View>
    );
  }

  // Product Picker screen
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={styles.topHeader}>
        <Text style={[styles.mainTitle, { color: theme.colors.text }]}>
          What item has a price drop?
        </Text>
        <Text style={[styles.subTitle, { color: theme.colors.textMuted }]}>
          Search the community catalog or scan the barcode to attach a deal.
        </Text>
      </View>

      {/* Top Action Buttons: Pantry Select & Barcode Scanner */}
      <View style={styles.topActionsGroup}>
        <Pressable
          testID="deal-select-from-pantry-btn"
          accessibilityRole="button"
          accessibilityLabel="Select from pantry"
          onPress={() => setShowPantryModal(true)}
          style={[
            styles.actionCardBtn,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.primary,
              borderRadius: theme.radii.lg,
            },
          ]}
        >
          <Text style={{ fontSize: 22, marginRight: 10 }}>📦</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>
              Select from Pantry
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
              Choose item from your pantry
            </Text>
          </View>
          <Text style={{ color: theme.colors.primaryDark, fontWeight: '700' }}>Pick →</Text>
        </Pressable>

        <Pressable
          testID="deal-scan-barcode-btn"
          accessibilityRole="button"
          accessibilityLabel="Scan barcode to find product"
          onPress={() => navigation.push('Scan', { target: 'deal' })}
          style={[
            styles.actionCardBtn,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.primary,
              borderRadius: theme.radii.lg,
            },
          ]}
        >
          <Text style={{ fontSize: 22, marginRight: 10 }}>📷</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>
              Scan barcode on package
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
              Instant product lookup with camera
            </Text>
          </View>
          <Text style={{ color: theme.colors.primaryDark, fontWeight: '700' }}>Scan →</Text>
        </Pressable>
      </View>

      <PantrySelectModal
        visible={showPantryModal}
        onClose={() => setShowPantryModal(false)}
        onSelectRecord={handleSelectPantryRecord}
      />

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
        <Text style={[styles.dividerText, { color: theme.colors.textMuted }]}>OR SEARCH</Text>
        <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
      </View>

      {/* Search Bar */}
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
          },
        ]}
      >
        <Text style={{ marginRight: 8, fontSize: 16 }}>🔍</Text>
        <TextInput
          accessibilityLabel="Search for a product"
          placeholder="Type product name or brand…"
          placeholderTextColor={theme.colors.textMuted}
          value={q}
          onChangeText={setQ}
          autoFocus={!editId}
          style={[styles.searchInput, { color: theme.colors.text }]}
        />
        {q.length > 0 && (
          <Pressable onPress={() => setQ('')} hitSlop={8}>
            <Text style={{ color: theme.colors.textMuted, fontWeight: '700' }}>✕</Text>
          </Pressable>
        )}
      </View>

      {searching && (
        <View style={{ paddingVertical: 16 }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}

      {/* Search results */}
      <FlatList
        data={searchResults ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setSelectedProduct({ id: item.id, name: item.name, brand: item.brand })
            }
            style={[
              styles.productResultItem,
              { borderBottomColor: theme.colors.border },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontWeight: '600', fontSize: 15 }}>
                {item.name}
              </Text>
              {item.brand ? (
                <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 2 }}>
                  {item.brand}
                </Text>
              ) : null}
            </View>
            <Text style={{ color: theme.colors.primaryDark, fontWeight: '700', fontSize: 14 }}>
              Select →
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          q.trim().length > 0 && !searching ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
                No products found matching "{q}".
              </Text>
            </View>
          ) : null
        }
      />

      {/* Create New Product CTA */}
      <View style={[styles.createProductFooter, { borderTopColor: theme.colors.border }]}>
        <Text style={[styles.createProductPrompt, { color: theme.colors.textMuted }]}>
          Can't find what you're looking for?
        </Text>
        <Pressable
          testID="deal-create-new-product-btn"
          accessibilityRole="button"
          accessibilityLabel="Add a new product for this deal"
          onPress={() => navigation.push('ProductNew', { target: 'deal' })}
          style={[
            styles.createProductBtn,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.primary,
              borderRadius: theme.radii.pill,
            },
          ]}
        >
          <Text style={{ fontSize: 14, marginRight: 6 }}>✨</Text>
          <Text style={[styles.createProductBtnText, { color: theme.colors.primaryDark }]}>
            Create New Product for Deal
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  topHeader: {
    marginBottom: 16,
    gap: 4,
  },
  topActionsGroup: {
    gap: 10,
    marginBottom: 16,
  },
  actionCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1.5,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  subTitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 48,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  productResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  changeProductBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  changeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  createProductFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  createProductPrompt: {
    fontSize: 12,
  },
  createProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  createProductBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
