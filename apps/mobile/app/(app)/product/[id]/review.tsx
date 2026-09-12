import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Alert,
  BackHandler,
  ActivityIndicator,
  Image,
  Platform,
  TextInput,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Review } from '@expyrico/shared';
import { useConnectionGuardStore } from '../../../../src/store/connectionGuardStore';
import { Button } from '../../../../src/components/Button';
import { ErrorText } from '../../../../src/components/ErrorText';
import { KeyboardAwareScrollView } from '../../../../src/components/KeyboardAwareScrollView';
import { useTheme } from '../../../../src/theme/useTheme';
import { useSessionStore } from '../../../../src/auth/session-store';
import { useProduct } from '../../../../src/api/products';
import {
  useMyProductReview,
  useProductReviews,
  useCreateReview,
  useUpdateReview,
  deduplicateReviews,
  isUserOwnReview,
} from '../../../../src/api/reviews';


export default function ProductReview() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const { id: productId, review: routeReview } = route.params as {
    id: string;
    review?: Review;
  };

  const { data: productData } = useProduct(productId);
  const { data: myReviewData, isLoading: isLoadingReview } = useMyProductReview(productId);
  const { data: reviewsData } = useProductReviews(productId);
  const createReviewMutation = useCreateReview();
  const updateReviewMutation = useUpdateReview();
  const currentUserId = useSessionStore((s) => s.user?.id);
  const allReviews = deduplicateReviews(reviewsData?.pages);
  const existingReview =
    routeReview ??
    myReviewData?.review ??
    allReviews.find((r) => isUserOwnReview(r, currentUserId)) ??
    null;
  const isEdit = Boolean(existingReview);
  const [stars, setStars] = useState<number>(() => existingReview?.stars ?? (existingReview?.rating === 'buy_again' ? 5 : existingReview?.rating === 'buy_again_on_sale' ? 3 : existingReview?.rating === 'wont_buy' ? 1 : 0));
  const [body, setBody] = useState(existingReview?.body ?? '');
  const [inputFocused, setInputFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moderationPending, setModerationPending] = useState(false);
  const [isInitialized, setIsInitialized] = useState(Boolean(existingReview));

  // Pre-populate when existing review loads
  useEffect(() => {
    if (existingReview && (!isInitialized || stars === 0)) {
      const initialStars = existingReview.stars ?? (existingReview.rating === 'buy_again' ? 5 : existingReview.rating === 'buy_again_on_sale' ? 3 : existingReview.rating === 'wont_buy' ? 1 : 0);
      setStars(initialStars);
      setBody(existingReview.body ?? '');
      setIsInitialized(true);
    }
  }, [existingReview, isInitialized, stars]);

  function handleSelectStars(selectedStars: number) {
    setStars(selectedStars);
    setError(null);
  }
  // Android hardware back handler with unsaved changes prompt
  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [body, stars, existingReview]);

  function hasUnsavedChanges() {
    const initialStars = existingReview?.stars ?? (existingReview?.rating === 'buy_again' ? 5 : existingReview?.rating === 'buy_again_on_sale' ? 3 : existingReview?.rating === 'wont_buy' ? 1 : 0);
    const starsChanged = stars !== initialStars;
    const bodyChanged = body.trim() !== (existingReview?.body ?? '').trim();
    return starsChanged || bodyChanged;
  }

  function handleBack() {
    if (hasUnsavedChanges()) {
      Alert.alert(
        'Discard changes?',
        'You have unsaved review edits. Are you sure you want to discard them?',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ],
      );
    } else {
      navigation.goBack();
    }
  }

  async function onSubmit() {
    setError(null);
    if (!stars || stars < 1) {
      setError('Please select a star rating.');
      return;
    }

    if (!useConnectionGuardStore.getState().requireServerConnection('Submit Review', () => void onSubmit())) {
      return;
    }

    const finalBody = body.trim() ? body.trim() : null;

    try {
      if (isEdit && existingReview) {
        await updateReviewMutation.mutateAsync({
          reviewId: existingReview.id,
          productId,
          patch: { stars, body: finalBody },
        });
        navigation.goBack();
      } else {
        const res = await createReviewMutation.mutateAsync({
          productId,
          input: { stars, body: finalBody },
        });
        if (res.status === 'hidden') {
          setModerationPending(true);
        } else {
          navigation.goBack();
        }
      }
    } catch (err: unknown) {
      const isAlreadyExists =
        (err as any)?.status === 409 ||
        (err as any)?.code === 'review_already_exists';
      if (isAlreadyExists) {
        const all = deduplicateReviews(reviewsData?.pages);
        const match = all.find((r) => isUserOwnReview(r, currentUserId));
        if (match) {
          try {
            await updateReviewMutation.mutateAsync({
              reviewId: match.id,
              productId,
              patch: { stars, body: finalBody },
            });
            navigation.goBack();
            return;
          } catch (updateErr: unknown) {
            setError((updateErr as Error).message);
            return;
          }
        }
      }
      const message = err instanceof Error ? err.message : 'Failed to submit review';
      setError(message);
    }
  }

  const isSubmitting =
    createReviewMutation.isPending || updateReviewMutation.isPending;

  if (isLoadingReview && !isInitialized) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.bg }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (moderationPending) {
    return (
      <View style={[styles.moderationContainer, { backgroundColor: theme.colors.bg }]}>
        <View
          style={[
            styles.moderationCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.lg,
            },
          ]}
        >
          <View style={[styles.moderationIconBadge, { backgroundColor: '#FEEFC3' }]}>
            <Ionicons name="time" size={36} color="#F5A623" />
          </View>
          <Text style={[styles.moderationTitle, { color: theme.colors.text }]}>
            Review Pending Moderation
          </Text>
          <Text style={[styles.moderationBody, { color: theme.colors.textMuted }]}>
            Your review was submitted and is pending community moderation. It will become
            visible once approved by moderators.
          </Text>
          <View style={{ marginTop: 24, width: '100%' }}>
            <Button
              label="Back to Product"
              variant="primary"
              onPress={() => navigation.goBack()}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {/* Top Header Bar */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: theme.colors.bgElevated,
            borderBottomColor: theme.colors.border,
            paddingTop: insets.top + 4,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={handleBack}
          style={[styles.backButton, { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border }]}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerEyebrow, { color: theme.colors.primaryDark }]}>
            COMMUNITY NOTES
          </Text>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {isEdit ? 'Edit your review' : 'Write a review'}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        extraKeyboardOffset={Platform.OS === 'android' ? 40 : 20}
      >
        {/* Product Hero Card */}
        <View
          style={[
            styles.productCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: 12,
            },
          ]}
        >
          <View style={styles.productRow}>
            {Boolean(
              productData?.imageUrl ||
                (productData?.photos &&
                  (productData.photos[0]?.displayUrl ||
                    productData.photos[0]?.thumbnailUrl)),
            ) ? (
              <Image
                source={{
                  uri:
                    productData?.imageUrl ||
                    (productData?.photos &&
                      (productData.photos[0]?.displayUrl ||
                        productData.photos[0]?.thumbnailUrl)) ||
                    '',
                }}
                style={styles.productImage}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View
                style={[
                  styles.productPlaceholder,
                  { backgroundColor: theme.colors.primaryLight },
                ]}
              >
                <Ionicons name="bag-handle-outline" size={20} color={theme.colors.primaryDark} />
              </View>
            )}
            <View style={styles.productInfo}>
              {productData?.brand ? (
                <Text style={[styles.productBrand, { color: theme.colors.textMuted }]}>
                  {productData.brand}
                </Text>
              ) : null}
              <Text
                style={[styles.productName, { color: theme.colors.text }]}
                numberOfLines={2}
              >
                {productData?.name ?? 'Product'}
              </Text>
              {productData?.category ? (
                <View style={styles.categoryBadgeRow}>
                  <View
                    style={[
                      styles.categoryBadge,
                      { backgroundColor: theme.colors.primaryLight },
                    ]}
                  >
                    <Text style={[styles.categoryBadgeText, { color: theme.colors.primaryDark }]}>
                      {productData.category}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* 1 to 5 Star Rating Selector Card */}
        <View
          style={[
            styles.cardContainer,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: 12,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sparkles" size={18} color="#F5A623" />
              <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
                Rate this product
              </Text>
            </View>
            <Text style={[styles.requiredBadge, { color: theme.colors.textMuted }]}>
              Required *
            </Text>
          </View>

          <View
            style={styles.starRow}
            accessibilityRole="radiogroup"
            accessibilityLabel="Rating out of 5 stars"
          >
            {[1, 2, 3, 4, 5].map((starIndex) => {
              const isFilled = starIndex <= stars;
              return (
                <Pressable
                  key={starIndex}
                  testID={`rating-star-${starIndex}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`${starIndex} star${starIndex > 1 ? 's' : ''}`}
                  accessibilityState={{ selected: isFilled }}
                  onPress={() => handleSelectStars(starIndex)}
                  style={({ pressed }) => [
                    styles.starButton,
                    { transform: [{ scale: pressed ? 1.15 : 1 }] },
                  ]}
                  hitSlop={6}
                >
                  <Ionicons
                    name={isFilled ? 'star' : 'star-outline'}
                    size={30}
                    color={isFilled ? '#F5A623' : theme.scheme === 'dark' ? '#3E3E38' : '#D0D0CA'}
                  />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sentimentBadgeContainer}>
            <View
              style={[
                styles.sentimentBadge,
                {
                  backgroundColor:
                    stars >= 4
                      ? theme.colors.primaryLight
                      : stars === 3
                        ? '#FEEFC3'
                        : theme.scheme === 'dark'
                          ? 'rgba(255,255,255,0.08)'
                          : '#F0F0ED',
                },
              ]}
            >
              <Text
                style={[
                  styles.starCaption,
                  {
                    color:
                      stars >= 4
                        ? theme.colors.primaryDark
                        : stars === 3
                          ? '#7A4D05'
                          : theme.colors.text,
                  },
                ]}
              >
                {stars === 5
                  ? '5 / 5 · Excellent!'
                  : stars === 4
                    ? '4 / 5 · Great!'
                    : stars === 3
                      ? '3 / 5 · Good'
                      : stars === 2
                        ? '2 / 5 · Fair'
                        : stars === 1
                          ? '1 / 5 · Poor'
                          : 'Tap a star to rate'}
              </Text>
            </View>
          </View>
        </View>

        {/* Written Review Body Card */}
        <View
          style={[
            styles.cardContainer,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: 12,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
                Your thoughts (optional)
              </Text>
            </View>
          </View>

          <TextInput
            accessibilityLabel="Your thoughts (optional)"
            placeholder="Share what you liked, taste, packaging, value..."
            placeholderTextColor={theme.colors.textMuted}
            value={body}
            onChangeText={setBody}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            numberOfLines={3}
            maxLength={2000}
            textAlignVertical="top"
            style={[
              styles.reviewInput,
              {
                color: theme.colors.text,
                backgroundColor: theme.scheme === 'dark' ? 'rgba(255,255,255,0.04)' : theme.colors.bg,
                borderColor: inputFocused ? theme.colors.primary : theme.colors.border,
                borderWidth: inputFocused ? 1.5 : 1,
                borderRadius: theme.radii.md,
              },
            ]}
          />
          <Text style={styles.charCount}>{body.length}/2000</Text>
        </View>

        {/* Error Feedback */}
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={theme.colors.danger} />
            <View style={{ flex: 1 }}>
              <ErrorText>{error}</ErrorText>
            </View>
          </View>
        ) : null}

        {/* Submit CTA Bar */}
        <View style={styles.submitContainer}>
          <Button
            testID="review-submit"
            label={isEdit ? 'Update review' : 'Submit review'}
            onPress={onSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
            variant="primary"
            style={{ height: 46, minHeight: 46 }}
          />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 1,
  },
  productCard: {
    borderWidth: 1,
    padding: 8,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  productImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  productPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
    gap: 1,
  },
  productBrand: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  categoryBadgeRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardContainer: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  requiredBadge: {
    fontSize: 11,
    fontWeight: '600',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  starButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentimentBadgeContainer: {
    alignItems: 'center',
    marginTop: 0,
  },
  sentimentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  starCaption: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  reviewInput: {
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    lineHeight: 20,
  },
  charCount: {
    fontSize: 11,
    color: '#8C8C85',
    textAlign: 'right',
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  submitContainer: {
    marginTop: 2,
    marginBottom: 4,
  },
  moderationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  moderationCard: {
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  moderationIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  moderationTitle: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  moderationBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
