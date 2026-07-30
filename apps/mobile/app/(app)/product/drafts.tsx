import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { ProductDraftRow, ProductDraftStatus } from '@expyrico/shared';
import { useProductDrafts } from '../../../src/api/products';
import { PrivateProductImage } from '../../../src/api/product-private-image';
import { EmptyState } from '../../../src/components/EmptyState';
import { useTheme } from '../../../src/theme/useTheme';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';

const STATUS_LABEL: Record<ProductDraftStatus, string> = {
  draft: 'Draft',
  pending: 'Awaiting review',
  changes_required: 'Changes requested',
};

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
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
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  const openDraft = (item: ProductDraftRow) => {
    const identifier = item.identifier;
    // `draft`/`changes_required` are editable by the creator; `pending` is
    // read-only-awaiting-review with personal-pantry continuation — both
    // land on the same screen, which branches on `resume`.
    navigation.push('ProductNew', {
      barcode: identifier.kind === 'barcode' ? identifier.value : '',
      qr: identifier.kind === 'qr' ? identifier.value : '',
      productId: item.id,
      resume: item.status === 'pending' ? 'pending' : 'edit',
      feedback: item.status === 'changes_required' ? (item.moderationFeedback ?? undefined) : undefined,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 }}>
        <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: '700' }}>My product drafts</Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 4 }}>
          Products you've scanned and started adding, before they're approved.
        </Text>
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
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 124 }}
          renderItem={({ item }) => <DraftRow item={item} onPress={openDraft} />}
          onEndReached={() => {
            if (q.hasNextPage) q.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            q.isLoading ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <EmptyState
                icon="document-text-outline"
                title="No drafts yet"
                body="Scan a barcode or QR code that isn't in the catalog yet to start one."
              />
            )
          }
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={theme.colors.primary} /> : null}
        />
      )}
    </View>
  );
}
