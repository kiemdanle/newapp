import React, { useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { ProductDraftRow, ProductDraftStatus } from '@expyrico/shared';
import { useProductDrafts, useCreateOrResumeDraft } from '../../../src/api/products';
import { PrivateProductImage } from '../../../src/api/product-private-image';
import { EmptyState } from '../../../src/components/EmptyState';
import { Button } from '../../../src/components/Button';
import { ManualCodeEntryModal } from '../../../src/components/ManualCodeEntryModal';
import { useTheme } from '../../../src/theme/useTheme';
import { formatDate } from '../../../src/utils/country-format';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';

const STATUS_LABEL: Record<ProductDraftStatus, string> = {
  draft: 'Draft',
  pending: 'Awaiting review',
  changes_required: 'Changes requested',
};

function formatUpdatedAt(iso: string): string {
  return formatDate(iso, null, { style: 'medium' });
}

interface DraftRowProps {
  item: ProductDraftRow;
  onPress: (item: ProductDraftRow) => void;
}

function DraftRow({ item, onPress }: DraftRowProps) {
  const theme = useTheme();
  const statusColor =
    item.status === 'changes_required'
      ? theme.colors.danger
      : item.status === 'pending'
        ? theme.colors.accent
        : theme.colors.primary;

  return (
    <Pressable
      testID={`draft-row-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${STATUS_LABEL[item.status]}`}
      onPress={() => onPress(item)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
        marginBottom: theme.spacing.sm,
      })}
    >
      {item.cover ? (
        <PrivateProductImage
          testID="draft-row-cover"
          target={{ kind: 'draft', productId: item.id }}
          photoId={item.cover.photoId}
          variant="thumb"
          style={{ width: 48, height: 48, borderRadius: theme.radii.sm }}
        />
      ) : (
        <View style={{ width: 48, height: 48, borderRadius: theme.radii.sm, backgroundColor: theme.colors.bgGlass }} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: theme.colors.text, fontWeight: '600' }} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
          Updated {formatUpdatedAt(item.updatedAt)}
        </Text>
        {item.status === 'changes_required' && item.moderationFeedback ? (
          <Text style={{ color: theme.colors.danger, fontSize: 12 }} numberOfLines={2}>
            {item.moderationFeedback}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: statusColor, fontSize: 12, fontWeight: '700' }}>{STATUS_LABEL[item.status]}</Text>
    </Pressable>
  );
}

export default function ProductDraftsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const q = useProductDrafts();
  const createOrResumeDraft = useCreateOrResumeDraft();

  const [isManualModalVisible, setIsManualModalVisible] = useState(false);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  const openDraft = (item: ProductDraftRow) => {
    const identifier = item.identifier;
    navigation.push('ProductNew', {
      barcode: identifier.kind === 'barcode' ? identifier.value : '',
      qr: identifier.kind === 'qr' ? identifier.value : '',
      productId: item.id,
      resume: item.status === 'pending' ? 'pending' : 'edit',
      feedback: item.status === 'changes_required' ? (item.moderationFeedback ?? undefined) : undefined,
    });
  };

  const handleOpenAddOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Scan Barcode / QR Code', 'Enter Code Manually', 'Cancel'],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            navigation.push('Scan');
          } else if (buttonIndex === 1) {
            setIsManualModalVisible(true);
          }
        },
      );
    } else {
      Alert.alert('Add Product Draft', 'How would you like to add the product?', [
        {
          text: 'Scan Code',
          onPress: () => navigation.push('Scan'),
        },
        {
          text: 'Enter Manually',
          onPress: () => setIsManualModalVisible(true),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleManualCodeSubmit = async (code: string, kind: 'barcode' | 'qr') => {
    const { product, resumed } = await createOrResumeDraft.mutateAsync({
      barcode: kind === 'barcode' ? code : null,
      qrPayload: kind === 'qr' ? code : null,
    });

    navigation.push('ProductNew', {
      barcode: kind === 'barcode' ? code : '',
      qr: kind === 'qr' ? code : '',
      productId: product.id,
      resume: resumed ? 'pending' : 'edit',
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: '700' }}>My product drafts</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 4 }}>
            Products you've scanned or added, before community approval.
          </Text>
        </View>

        <Pressable
          testID="drafts-add-header-btn"
          accessibilityRole="button"
          accessibilityLabel="Add new product draft"
          onPress={handleOpenAddOptions}
          style={({ pressed }) => [
            styles.headerAddBtn,
            {
              backgroundColor: theme.colors.primaryLight,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Ionicons name="add" size={18} color={theme.colors.primaryDark} />
          <Text style={[styles.headerAddBtnText, { color: theme.colors.primaryDark }]}>+ Add draft</Text>
        </Pressable>
      </View>

      {q.isError ? (
        <View style={{ padding: 20 }}>
          <Text style={{ color: theme.colors.danger }}>Couldn't load your drafts. Pull down or reopen to retry.</Text>
        </View>
      ) : (
        <FlatList
          testID="drafts-list"
          data={items}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
          renderItem={({ item }) => <DraftRow item={item} onPress={openDraft} />}
          onEndReached={() => {
            if (q.hasNextPage) q.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            q.isLoading ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <View style={styles.emptyContainer}>
                <EmptyState
                  icon="document-text-outline"
                  title="No drafts yet"
                  body="Scan a barcode or type code manually to add products to the catalog."
                />
                <View style={styles.emptyActionButtons}>
                  <Button
                    testID="drafts-empty-scan-btn"
                    label="Scan product barcode"
                    onPress={() => navigation.push('Scan')}
                    variant="primary"
                  />
                  <Button
                    testID="drafts-empty-manual-btn"
                    label="Enter code manually"
                    onPress={() => setIsManualModalVisible(true)}
                    variant="outline"
                  />
                </View>
              </View>
            )
          }
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={theme.colors.primary} /> : null}
        />
      )}

      {/* Floating Action Button (FAB) when drafts list is populated */}
      {items.length > 0 && (
        <Pressable
          testID="drafts-fab-btn"
          accessibilityRole="button"
          accessibilityLabel="Add new product draft"
          onPress={handleOpenAddOptions}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: pressed ? theme.colors.primaryDark : theme.colors.primary,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 3 },
            },
          ]}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.fabText}>New Draft</Text>
        </Pressable>
      )}

      <ManualCodeEntryModal
        visible={isManualModalVisible}
        onClose={() => setIsManualModalVisible(false)}
        onSubmit={handleManualCodeSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 12,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingTop: 20,
    gap: 20,
    alignItems: 'center',
  },
  emptyActionButtons: {
    width: '100%',
    gap: 10,
    marginTop: 10,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 4,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
