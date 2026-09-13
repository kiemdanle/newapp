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
import type { Review, ReviewRating } from '@expyrico/shared';
import { REVIEW_BADGE_CONFIG } from '../../../../src/features/reviews/ReviewCard';
import { useConnectionGuardStore } from '../../../../src/store/connectionGuardStore';

const RECOMMENDATION_OPTIONS: Array<{
  value: ReviewRating;
  label: string;
  sublabel: string;
  icon: string;
  activeBorder: string;
  activeBg: string;
  activeText: string;
}> = [
  {
    value: 'buy_again',
    label: REVIEW_BADGE_CONFIG.buy_again.label,
    sublabel: REVIEW_BADGE_CONFIG.buy_again.sublabel,
    icon: REVIEW_BADGE_CONFIG.buy_again.icon,
    activeBorder: REVIEW_BADGE_CONFIG.buy_again.border,
    activeBg: REVIEW_BADGE_CONFIG.buy_again.bg,
    activeText: REVIEW_BADGE_CONFIG.buy_again.text,
  },
  {
    value: 'buy_again_on_sale',
    label: REVIEW_BADGE_CONFIG.buy_again_on_sale.label,
    sublabel: REVIEW_BADGE_CONFIG.buy_again_on_sale.sublabel,
    icon: REVIEW_BADGE_CONFIG.buy_again_on_sale.icon,
    activeBorder: REVIEW_BADGE_CONFIG.buy_again_on_sale.border,
    activeBg: REVIEW_BADGE_CONFIG.buy_again_on_sale.bg,
    activeText: REVIEW_BADGE_CONFIG.buy_again_on_sale.text,
  },
  {
    value: 'wont_buy',
    label: REVIEW_BADGE_CONFIG.wont_buy.label,
    sublabel: REVIEW_BADGE_CONFIG.wont_buy.sublabel,
    icon: REVIEW_BADGE_CONFIG.wont_buy.icon,
    activeBorder: REVIEW_BADGE_CONFIG.wont_buy.border,
    activeBg: REVIEW_BADGE_CONFIG.wont_buy.bg,
    activeText: REVIEW_BADGE_CONFIG.wont_buy.text,
  },
];
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
  const [rating, setRating] = useState<ReviewRating | null>(() => existingReview?.rating ?? null);
  const [body, setBody] = useState(existingReview?.body ?? '');
  const [inputFocused, setInputFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moderationPending, setModerationPending] = useState(false);
  const [isInitialized, setIsInitialized] = useState(Boolean(existingReview));

  // Pre-populate when existing review loads
  useEffect(() => {
    if (existingReview && (!isInitialized || !rating)) {
      setRating(existingReview.rating ?? null);
      setBody(existingReview.body ?? '');
      setIsInitialized(true);
    }
  }, [existingReview, isInitialized, rating]);
  // Android hardware back handler with unsaved changes prompt
  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [body, rating, existingReview]);

  function hasUnsavedChanges() {
    const initialRating = existingReview?.rating ?? null;
    const ratingChanged = rating !== initialRating;
    const bodyChanged = body.trim() !== (existingReview?.body ?? '').trim();
    return ratingChanged || bodyChanged;
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
    if (!rating) {
      setError('Please select whether you recommend this product.');
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
          patch: { rating, body: finalBody },
        });
        navigation.goBack();
      } else {
        const res = await createReviewMutation.mutateAsync({
          productId,
          input: { rating, body: finalBody },
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
              patch: { rating, body: finalBody },
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

        {/* Recommendation Selector Card */}
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
              <Ionicons name="sparkles" size={18} color="#4BAE8A" />
              <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
                Rate this product
              </Text>
            </View>
            <Text style={[styles.requiredBadge, { color: theme.colors.textMuted }]}>
              Required *
            </Text>
          </View>

          <View
            style={styles.recommendationRow}
            accessibilityRole="radiogroup"
            accessibilityLabel="Product recommendation options"
          >
            {RECOMMENDATION_OPTIONS.map((opt) => {
              const isSelected = rating === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  testID={`recommendation-option-${opt.value}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`${opt.label} - ${opt.sublabel}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    setRating(opt.value);
                    setError(null);
                  }}
                  style={({ pressed }) => [
                    styles.recommendationCard,
                    {
                      borderColor: isSelected
                        ? opt.activeBorder
                        : theme.colors.border,
                      borderWidth: isSelected ? 2 : 1,
                      backgroundColor: isSelected
                        ? theme.scheme === 'dark'
                          ? 'rgba(255,255,255,0.08)'
                          : opt.activeBg
                        : theme.scheme === 'dark'
                          ? 'rgba(255,255,255,0.03)'
                          : theme.colors.bg,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                  hitSlop={4}
                >
                  <Ionicons
                    name={opt.icon}
                    size={24}
                    color={isSelected ? opt.activeBorder : theme.colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.recommendationLabel,
                      {
                        color: isSelected
                          ? theme.scheme === 'dark'
                            ? theme.colors.text
                            : opt.activeText
                          : theme.colors.text,
                        fontWeight: isSelected ? '700' : '600',
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text
                    style={[
                      styles.recommendationSublabel,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {opt.sublabel}
                  </Text>
                </Pressable>
              );
            })}
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
  recommendationRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  recommendationCard: {
    flex: 1,
    minHeight: 80,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 4,
  },
  recommendationLabel: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  recommendationSublabel: {
    fontSize: 10,
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
