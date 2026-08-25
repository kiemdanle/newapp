import { Alert, Image, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useRecord, patchLocalRecord, deleteLocalRecord } from '../../../src/api/records';
import { useProduct } from '../../../src/api/products';
import { useTheme } from '../../../src/theme/useTheme';
import { expiryStatus, EXPIRY_STATUS_TOKEN } from '../../../src/features/records/expiryStatus';
import { Button } from '../../../src/components/Button';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';

export default function RecordDetail() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const { id } = useRoute().params as { id: string };
  const record = useRecord(id);
  const { data: product, isLoading: productLoading } = useProduct(record?.productId ?? undefined);

  if (!record) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.bg,
        }}
      >
        <Text style={{ color: theme.colors.textMuted }}>Loading…</Text>
      </View>
    );
  }

  const displayName = record.customName || product?.name || 'Item';
  const brand = product?.brand;
  const category = record.category || product?.category;
  const imageUrl = record.photoUrl || product?.imageUrl || (product?.photos && product.photos[0]?.url) || null;
  const barcode = product?.barcode;
  const description = product?.description;
  const shelfLife = product?.defaultShelfLifeDays;

  const mark = async (status: 'consumed' | 'discarded') => {
    await patchLocalRecord(record.id, { status });
    navigation.goBack();
  };

  const remove = () => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${displayName}"? It will be removed from your pantry.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteLocalRecord(record.id);
            navigation.goBack();
          },
        },
      ],
    );
  };

  const status = expiryStatus(record.expiryDate);
  const statusColor = theme.colors[EXPIRY_STATUS_TOKEN[status]];
  const statusBg = status === 'amber'
    ? theme.colors.accentLight
    : status === 'red'
      ? theme.colors.bgGlass
      : theme.colors.primaryLight;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
        backgroundColor: theme.colors.bg,
      }}
    >
      {/* Product Image Banner */}
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{
            width: '100%',
            height: 220,
            borderRadius: theme.radii.lg,
            backgroundColor: theme.colors.neutralLight,
            marginBottom: theme.spacing.xs,
          }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}

      {/* Header Info */}
      <View style={{ gap: 4 }}>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typeRamp.labelMedium.fontSize,
            fontWeight: theme.typeRamp.labelMedium.fontWeight as TextStyle['fontWeight'],
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          {brand ? `${brand} · PANTRY ITEM` : 'PANTRY ITEM'}
        </Text>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.typeRamp.headlineMedium.fontSize,
            fontWeight: theme.typeRamp.headlineMedium.fontWeight as TextStyle['fontWeight'],
          }}
        >
          {displayName}
        </Text>
      </View>

      {/* Expiry and Quantity Badges */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            backgroundColor: statusBg,
            borderRadius: theme.radii.md,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm + 2,
          }}
        >
          <View
            testID={`record-expiry-status-${status}`}
            accessibilityLabel={`expiry status ${status}`}
            style={{ width: 10, height: 10, borderRadius: theme.radii.sm / 2, backgroundColor: statusColor }}
          />
          <Text style={{ color: statusColor, fontWeight: '600' }}>Expires {record.expiryDate}</Text>
        </View>

        <View
          style={{
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
            borderWidth: 1,
            borderRadius: theme.radii.md,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm + 2,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
            {record.quantity} {record.unit}
          </Text>
        </View>
      </View>

      {/* Product & Item Details Card */}
      <View
        style={{
          backgroundColor: theme.colors.bgElevated,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.md + 4,
          gap: theme.spacing.sm + 2,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 16,
            fontWeight: '700',
            marginBottom: 4,
          }}
        >
          Item Details
        </Text>

        {category ? (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Category</Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>{category}</Text>
          </View>
        ) : null}

        {barcode ? (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Barcode</Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>{barcode}</Text>
          </View>
        ) : null}

        {shelfLife ? (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Shelf Life</Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>{shelfLife} days</Text>
          </View>
        ) : null}

        {record.store ? (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Store</Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>{record.store}</Text>
          </View>
        ) : null}

        {record.price != null ? (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Price</Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>${record.price}</Text>
          </View>
        ) : null}

        {record.purchaseDate ? (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Purchased</Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>{record.purchaseDate}</Text>
          </View>
        ) : null}

        {record.notes ? (
          <View style={{ marginTop: 4, gap: 2 }}>
            <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Notes</Text>
            <Text style={{ color: theme.colors.text, fontSize: 14, lineHeight: 20 }}>{record.notes}</Text>
          </View>
        ) : null}

        {description ? (
          <View style={{ marginTop: 4, gap: 2 }}>
            <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Description</Text>
            <Text style={{ color: theme.colors.text, fontSize: 14, lineHeight: 20 }}>{description}</Text>
          </View>
        ) : null}
      </View>

      {/* Navigation link to catalog product */}
      {record.productId ? (
        <Button
          label="View in product catalog"
          icon="open-outline"
          variant="outline"
          onPress={() => navigation.navigate('Product', { id: record.productId! })}
        />
      ) : null}

      {/* Actions */}
      <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.md }}>
        <Button testID="record-mark-consumed" label="Mark as used" icon="checkmark" variant="secondary" onPress={() => void mark('consumed')} />
        <Button testID="record-mark-discarded" label="Discard item" icon="trash-outline" variant="outline" onPress={() => void mark('discarded')} />
        <Button testID="record-delete" label="Delete permanently" icon="close" variant="danger" onPress={() => void remove()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '65%',
    textAlign: 'right',
  },
});
