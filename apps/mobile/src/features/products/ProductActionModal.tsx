import React from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { ProductDraftRow, ProductDraftStatus } from '@expyrico/shared';
import { useTheme } from '../../theme/useTheme';
import { PrivateProductImage } from '../../api/product-private-image';
import { formatDate } from '../../utils/country-format';

export interface ProductActionModalProps {
  visible: boolean;
  product: ProductDraftRow | null;
  onClose: () => void;
  onAddToPantry: (product: ProductDraftRow) => void;
  onViewDetails: (product: ProductDraftRow) => void;
}

const STATUS_CONFIG: Record<ProductDraftStatus, { label: string; text: string; bg: string; icon: string }> = {
  active: { label: 'Catalog Active', text: '#3A8F6F', bg: '#D6F0E6', icon: 'checkmark-circle' },
  pending: { label: 'Awaiting Review', text: '#B45309', bg: '#FEEFC3', icon: 'time-outline' },
  draft: { label: 'Draft', text: '#8C8C85', bg: '#F0F0ED', icon: 'create-outline' },
  changes_required: { label: 'Changes Requested', text: '#E0442A', bg: '#FDE8E8', icon: 'alert-circle-outline' },
};

export function ProductActionModal({
  visible,
  product,
  onClose,
  onAddToPantry,
  onViewDetails,
}: ProductActionModalProps) {
  const theme = useTheme();

  if (!product) return null;

  const statusCfg = STATUS_CONFIG[product.status] ?? STATUS_CONFIG.draft;
  const identifierValue = product.identifier.value;
  const isBarcode = product.identifier.kind === 'barcode';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Tap outside to dismiss */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss product actions"
          style={styles.dismissOverlay}
          onPress={onClose}
        />

        {/* Bottom Action Sheet Card */}
        <View
          style={[
            styles.sheetCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {/* Top Drag Handle */}
          <View style={styles.handleBar}>
            <View style={styles.handlePill} />
          </View>

          {/* Product Header Hero Card */}
          <View
            style={[
              styles.productHeroCard,
              {
                backgroundColor: theme.scheme === 'dark' ? theme.colors.bgGlass : '#F7F7F4',
                borderColor: theme.colors.border,
              },
            ]}
          >
            {/* Thumbnail */}
            {product.cover ? (
              product.cover.thumbnailUrl.startsWith('http') ? (
                <Image
                  testID="action-modal-cover"
                  source={{ uri: product.cover.thumbnailUrl }}
                  style={[styles.productThumb, { borderColor: theme.colors.border }]}
                />
              ) : (
                <PrivateProductImage
                  testID="action-modal-cover"
                  target={{ kind: 'draft', productId: product.id }}
                  photoId={product.cover.photoId}
                  variant="thumb"
                  style={[styles.productThumb, { borderColor: theme.colors.border }]}
                />
              )
            ) : (
              <View
                testID="action-modal-cover-placeholder"
                style={[
                  styles.productThumb,
                  styles.productThumbPlaceholder,
                  { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border },
                ]}
              >
                <Ionicons name="cube-outline" size={24} color={theme.colors.textMuted} />
              </View>
            )}

            {/* Product Meta */}
            <View style={styles.productMeta}>
              <Text
                style={[styles.productTitle, { color: theme.colors.text }]}
                numberOfLines={2}
              >
                {product.name}
              </Text>

              <View style={styles.badgeRow}>
                {/* Status Badge */}
                <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                  <Ionicons name={statusCfg.icon} size={12} color={statusCfg.text} style={{ marginRight: 3 }} />
                  <Text style={[styles.statusBadgeText, { color: statusCfg.text }]}>
                    {statusCfg.label}
                  </Text>
                </View>

                {/* Barcode/QR Pill */}
                {identifierValue ? (
                  <View style={[styles.identifierBadge, { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border }]}>
                    <Ionicons name={isBarcode ? 'barcode-outline' : 'qr-code-outline'} size={12} color={theme.colors.textMuted} style={{ marginRight: 3 }} />
                    <Text style={[styles.identifierText, { color: theme.colors.textMuted }]}>
                      {identifierValue}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Action List Section */}
          <View style={styles.actionsContainer}>
            {/* Primary Action: Add to Pantry */}
            <Pressable
              testID="action-modal-add-btn"
              accessibilityRole="button"
              accessibilityLabel="Add to pantry"
              onPress={() => onAddToPantry(product)}
              style={({ pressed }) => [
                styles.actionCard,
                styles.primaryActionCard,
                {
                  backgroundColor: pressed ? '#C7EADB' : '#D6F0E6',
                  borderColor: '#4BAE8A',
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#4BAE8A' }]}>
                <Ionicons name="basket" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.actionTextCol}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.actionTitle, { color: '#2A6F54' }]}>Add to Pantry</Text>
                  <View style={styles.quickPill}>
                    <Text style={styles.quickPillText}>FAST ADD</Text>
                  </View>
                </View>
                <Text style={[styles.actionSubtitle, { color: '#3A8F6F' }]}>
                  Set expiration date, quantity and stock your shelf
                </Text>
              </View>
              <View style={[styles.actionChevronCircle, { backgroundColor: 'rgba(75, 174, 138, 0.2)' }]}>
                <Ionicons name="chevron-forward" size={16} color="#2A6F54" />
              </View>
            </Pressable>

            {/* Secondary Action: View Product Details */}
            <Pressable
              testID="action-modal-details-btn"
              accessibilityRole="button"
              accessibilityLabel="View product details"
              onPress={() => onViewDetails(product)}
              style={({ pressed }) => [
                styles.actionCard,
                styles.secondaryActionCard,
                {
                  backgroundColor: pressed ? theme.colors.bgGlass : (theme.scheme === 'dark' ? theme.colors.bgElevated : '#FFFFFF'),
                  borderColor: theme.colors.border,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.scheme === 'dark' ? '#333330' : '#F0F0ED' }]}>
                <Ionicons name="document-text-outline" size={20} color={theme.colors.text} />
              </View>
              <View style={styles.actionTextCol}>
                <Text style={[styles.actionTitle, { color: theme.colors.text }]}>View Details & Photos</Text>
                <Text style={[styles.actionSubtitle, { color: theme.colors.textMuted }]}>
                  Inspect catalog photos, barcode, brand, and metadata
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {/* Cancel / Dismiss Button */}
          <Pressable
            testID="action-modal-cancel-btn"
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelButton,
              {
                backgroundColor: pressed ? theme.colors.border : (theme.scheme === 'dark' ? theme.colors.bgGlass : '#F0F0ED'),
              },
            ]}
          >
            <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(44, 44, 40, 0.45)',
    justifyContent: 'flex-end',
  },
  dismissOverlay: {
    flex: 1,
  },
  sheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#2C2C28',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handlePill: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D0CC',
  },
  productHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  productThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
  },
  productThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productMeta: {
    flex: 1,
    gap: 6,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  identifierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  identifierText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 14,
  },
  primaryActionCard: {
    shadowColor: '#4BAE8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  secondaryActionCard: {
    borderWidth: 1,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextCol: {
    flex: 1,
    gap: 3,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  actionSubtitle: {
    fontSize: 12.5,
    lineHeight: 16,
  },
  quickPill: {
    backgroundColor: '#4BAE8A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  quickPillText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionChevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
