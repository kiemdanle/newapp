import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
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
export default function ProductDetail() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute();
  const { id } = route.params as { id: string };
  const { data, isLoading } = useProduct(id);
  const [showOcr, setShowOcr] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);

  const targetProductId = data?.id ?? id;
  const { data: myReviewData } = useMyProductReview(targetProductId);
  const { data: myReviewsData } = useMyReviews({ limit: 50 });
  const allMyReviews = deduplicateReviews(myReviewsData?.pages);
  const myReview =
    myReviewData?.review ??
    allMyReviews.find((r) => r.productId === targetProductId || r.productId === id);
  const userReviewRating = myReview?.rating;
  const userStars =
    userReviewRating === 'buy_again'
      ? 5
      : userReviewRating === 'buy_again_on_sale'
        ? 3
        : userReviewRating === 'wont_buy'
          ? 1
          : null;

  if (isLoading || !data) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.bg,
        }}
      >
        <Text style={{ color: theme.colors.textMuted }}>Loading product…</Text>
      </View>
    );
  }

  if (showOcr) {
    return (
      <OcrCamera
        onCancel={() => setShowOcr(false)}
        onParsed={(iso) => {
          setPrefillDate(iso);
          setShowOcr(false);
        }}
      />
    );
  }

  const photoList = [
    data.imageUrl,
    ...(data.photos?.map((p: any) => p.displayUrl || p.photoUrl || p.thumbnailUrl) || []),
  ].filter(Boolean) as string[];
  const uniquePhotos = Array.from(new Set(photoList));

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
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
        />
      ) : null}
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.text, fontSize: theme.typeRamp.headlineMedium.fontSize, fontWeight: theme.typeRamp.headlineMedium.fontWeight as any }}>
          {data.name}
        </Text>
        {userStars !== null ? (
          <Pressable
            testID="product-header-stars"
            accessibilityRole="button"
            accessibilityLabel={`Your rating: ${userStars} out of 5 stars. View all reviews.`}
            onPress={() => navigation.navigate('ProductReviews', { id: data.id })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 2,
              marginBottom: 4,
              opacity: pressed ? 0.8 : 1,
            })}
            hitSlop={8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                  key={s}
                  name={s <= userStars ? 'star' : 'star-outline'}
                  size={17}
                  color={s <= userStars ? '#F5A623' : theme.colors.neutralMid}
                  style={{ marginRight: 2 }}
                />
              ))}
            </View>
            <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700', marginRight: 6 }}>
              {userStars.toFixed(1)}
            </Text>
            <View
              style={{
                backgroundColor: theme.colors.bgGlass,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <Text style={{ color: theme.colors.primaryDark, fontSize: 11, fontWeight: '600' }}>
                Your review
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={theme.colors.textMuted}
              style={{ marginLeft: 4 }}
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
  );
}
