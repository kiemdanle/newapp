import { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from '../../../src/components/KeyboardAwareScrollView';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useProduct } from '../../../src/api/products';
import { useMyProductReview, useMyReviews, deduplicateReviews } from '../../../src/api/reviews';
import { AddRecordForm } from '../../../src/features/records/AddRecordForm';
import { OcrCamera } from '../../../src/features/expiry/OcrCamera';
import { useTheme } from '../../../src/theme/useTheme';
import { ensurePushTokenRegistered } from '../../../src/features/push/registerPushToken';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';
import { Button } from '../../../src/components/Button';
import { ItemImageGallery } from '../../../src/components/ItemImageGallery';
import { ProductReviewsSection } from '../../../src/features/reviews/ProductReviewsSection';
import { REVIEW_BADGE_CONFIG } from '../../../src/features/reviews/ReviewCard';
import { useImageSettlementTracker } from '../../../src/cache/useImageSettlementTracker';
import { ProductDetailSkeleton } from '../../../src/components/skeleton';

export default function ProductDetail() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute();
  const { id } = route.params as { id: string };
  const { data, isLoading, isError, isFetching } = useProduct(id);
  const [showOcr, setShowOcr] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const canonicalId = data?.id || id;
  const { data: myReviewData } = useMyProductReview(canonicalId);
  const { data: myReviewsData } = useMyReviews({ limit: 50 });
  const uniquePhotos = useMemo(() => {
    const photoList = [
      data?.imageUrl,
      ...(data?.photos?.map((p) => p.displayUrl || p.thumbnailUrl) || []),
    ].filter(Boolean) as string[];
    return Array.from(new Set(photoList));
  }, [data?.imageUrl, data?.photos]);

  const { allSettled: allVisibleImagesSettled, markSettled } = useImageSettlementTracker(uniquePhotos);

  if (!data && (isLoading || isFetching || !isError)) {
    return <ProductDetailSkeleton />;
  }

  if (!data) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.bg,
          padding: 24,
          gap: 12,
        }}
      >
        <Ionicons name="cube-outline" size={48} color={theme.colors.textMuted} />
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '700' }}>Product not found</Text>
        <Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
          This product could not be loaded or may have been removed.
        </Text>
        <Button label="Back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const targetProductId = data.id ?? id;
  const allMyReviews = deduplicateReviews(myReviewsData?.pages);
  const myReview =
    myReviewData?.review ??
    allMyReviews.find((r) => r.productId === targetProductId || r.productId === id);
  const userReviewRating = myReview?.rating;
  const totalRatings = data.ratingCount ?? 0;
  const positiveCount = (data.buyAgainCount ?? 0) + (data.buyAgainOnSaleCount ?? 0);
  const scorePct = totalRatings > 0 ? Math.round((positiveCount / totalRatings) * 100) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 80 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {uniquePhotos.length > 0 ? (
        <ItemImageGallery
          photos={uniquePhotos}
          title={data.name || 'Product'}
          placeholderIcon="cube-outline"
          placeholderText="No product photo"
          onImageSettled={markSettled}
        />
      ) : null}
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.text, fontSize: theme.typeRamp.headlineMedium.fontSize, fontWeight: theme.typeRamp.headlineMedium.fontWeight as any }}>
          {data.name}
        </Text>
        {totalRatings > 0 || userReviewRating ? (
          <Pressable
            testID="product-header-sentiment"
            accessibilityRole="button"
            accessibilityLabel={
              userReviewRating
                ? `Community: ${scorePct ?? 0}% recommend. Your rating: ${userReviewRating === 'buy_again' ? 'Buy again' : userReviewRating === 'buy_again_on_sale' ? 'Buy on sale' : "Won't buy"}. View all reviews.`
                : `${scorePct}% recommend from ${totalRatings} community ratings. View all reviews.`
            }
            onPress={() => navigation.navigate('ProductReviews', { id: data.id })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 2,
              marginBottom: 4,
              opacity: pressed ? 0.8 : 1,
            })}
            hitSlop={8}
          >
            {scorePct !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="thumbs-up" size={16} color="#4BAE8A" />
                <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '700' }}>
                  {scorePct}% recommend
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                  · {totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'}
                </Text>
              </View>
            ) : null}

            {userReviewRating ? (() => {
              const userBadge = REVIEW_BADGE_CONFIG[userReviewRating];
              return (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: userBadge.bg,
                    borderColor: userBadge.border,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                    borderWidth: 1,
                  }}
                >
                  <Ionicons
                    name={userBadge.icon}
                    size={12}
                    color={userBadge.border}
                  />
                  <Text
                    style={{
                      color: userBadge.text,
                      fontSize: 11,
                      fontWeight: '600',
                    }}
                  >
                    {userBadge.label} (You)
                  </Text>
                </View>
              );
            })() : null}

            <Ionicons
              name="chevron-forward"
              size={14}
              color={theme.colors.textMuted}
            />
          </Pressable>
        ) : null}
        {data.brand ? <Text style={{ color: theme.colors.textMuted }}>{data.brand}</Text> : null}
        {data.defaultShelfLifeDays ? (
          <Text style={{ color: theme.colors.textMuted, marginTop: theme.spacing.sm }}>
            Default shelf life: {data.defaultShelfLifeDays} days
          </Text>
        ) : null}
        <View
          style={{
            marginTop: theme.spacing.lg,
            padding: theme.spacing.md,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.bgGlass,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text style={{ color: theme.colors.textMuted }}>Save it now, then add an expiry date to keep it on your radar.</Text>
        </View>
        {data.status === 'active' ? (
          <Button
            testID="product-suggest-edit"
            label="Suggest an edit"
            variant="outline"
            icon="create-outline"
            onPress={() => navigation.navigate('ProductEdit', { id: data.id })}
          />
        ) : null}
      </View>
      <AddRecordForm
        productId={data.id}
        productName={data.name}
        initialCategory={data.category}
        scannedExpiry={prefillDate}
        onOpenOcr={() => setShowOcr(true)}
        onSaved={async () => {
          await ensurePushTokenRegistered();
          navigation.replace('Tabs');
        }}
      />
      {prefillDate ? (
        <Text
          testID="ocr-prefill-hint"
          style={{ color: theme.colors.textMuted, paddingHorizontal: theme.spacing.lg }}
        >
          Scanned date: {prefillDate} (enter above)
        </Text>
      ) : null}
      <ProductReviewsSection product={data} />
    </KeyboardAwareScrollView>
      <Modal
        visible={showOcr}
        animationType="slide"
        onRequestClose={() => setShowOcr(false)}
      >
        <OcrCamera
          onCancel={() => setShowOcr(false)}
          onParsed={(iso) => {
            setPrefillDate(iso);
            setShowOcr(false);
          }}
        />
      </Modal>
      {!allVisibleImagesSettled && (
        <ProductDetailSkeleton
          style={StyleSheet.absoluteFillObject}
          pointerEvents="auto"
        />
      )}
    </View>
  );
}
