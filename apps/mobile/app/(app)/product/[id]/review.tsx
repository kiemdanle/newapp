import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Alert,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Review, ReviewRating } from '@expyrico/shared';
import { Screen } from '../../../../src/components/Screen';
import { Button } from '../../../../src/components/Button';
import { TextField } from '../../../../src/components/TextField';
import { ErrorText } from '../../../../src/components/ErrorText';
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

const RECOMMENDATION_OPTIONS: {
  value: ReviewRating;
  label: string;
  icon: string;
  activeBorder: string;
  activeBg: string;
  activeText: string;
  iconColor: string;
}[] = [
  {
    value: 'buy_again',
    label: 'Buy again',
    icon: 'checkmark-circle',
    activeBorder: '#4BAE8A', // Fresh Sage
    activeBg: '#D6F0E6',     // Mint Mist
    activeText: '#3A8F6F',   // Deep Sage
    iconColor: '#4BAE8A',
  },
  {
    value: 'buy_again_on_sale',
    label: 'Buy on sale',
    icon: 'pricetag',
    activeBorder: '#F5A623', // Honey
    activeBg: '#FEEFC3',     // Soft Butter
    activeText: '#2C2C28',   // Almost Black
    iconColor: '#F5A623',
  },
  {
    value: 'wont_buy',
    label: "Won't buy",
    icon: 'thumbs-down',
    activeBorder: '#8C8C85', // Pebble (Zero Alert Red)
    activeBg: '#F0F0ED',     // Stone
    activeText: '#2C2C28',   // Almost Black
    iconColor: '#8C8C85',
  },
];

function ratingToStars(r: ReviewRating | null | undefined): number {
  if (r === 'buy_again') return 5;
  if (r === 'buy_again_on_sale') return 3;
  if (r === 'wont_buy') return 1;
  return 0;
}

function starsToRating(s: number): ReviewRating {
  if (s >= 4) return 'buy_again';
  if (s === 3) return 'buy_again_on_sale';
  return 'wont_buy';
}

export default function ProductReview() {
  const theme = useTheme();
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
  const [stars, setStars] = useState<number>(() => ratingToStars(existingReview?.rating));
  const [rating, setRating] = useState<ReviewRating | null>(
    existingReview?.rating ?? null,
  );
  const [body, setBody] = useState(existingReview?.body ?? '');
  const [error, setError] = useState<string | null>(null);
  const [moderationPending, setModerationPending] = useState(false);
  const [isInitialized, setIsInitialized] = useState(Boolean(existingReview));

  // Pre-populate when existing review loads
  useEffect(() => {
    if (existingReview && (!isInitialized || rating === null)) {
      setRating(existingReview.rating);
      setStars(ratingToStars(existingReview.rating));
      setBody(existingReview.body ?? '');
      setIsInitialized(true);
    }
  }, [existingReview, isInitialized, rating]);

  function handleSelectStars(selectedStars: number) {
    setStars(selectedStars);
    setRating(starsToRating(selectedStars));
    setError(null);
  }

  function handleSelectRecommendation(val: ReviewRating) {
    setRating(val);
    setStars(ratingToStars(val));
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
  }, [body, rating, existingReview]);

  function hasUnsavedChanges() {
    if (existingReview) {
      const bodyChanged = body.trim() !== (existingReview.body ?? '');
      const ratingChanged = rating !== existingReview.rating;
      return bodyChanged || ratingChanged;
    }
    return (rating !== null || body.trim().length > 0);
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

    const trimmedBody = body.trim();
    // In edit mode: explicit null if emptied, so Postgres clears the comment
    const finalBody = trimmedBody.length > 0 ? trimmedBody : null;

    try {
      if (isEdit && existingReview) {
        const res = await updateReviewMutation.mutateAsync({
          reviewId: existingReview.id,
          productId,
          patch: { rating, body: finalBody },
        });
        if (res.status === 'hidden') {
          setModerationPending(true);
        } else {
          navigation.goBack();
        }
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
      <Screen style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4BAE8A" />
      </Screen>
    );
  }

  if (moderationPending) {
    return (
      <Screen style={styles.moderationContainer}>
        <View style={styles.moderationCard}>
          <Ionicons name="time-outline" size={48} color="#F5A623" />
          <Text style={styles.moderationTitle}>Review Pending Moderation</Text>
          <Text style={styles.moderationBody}>
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
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.scrollContent}>
        {/* Navigation Header */}
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={24} color="#2C2C28" />
          </Pressable>
          <Text style={styles.headerTitle}>
            {isEdit ? 'Edit your review' : 'Write a review'}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Product Metadata */}
        <View style={styles.productCard}>
          <Text style={styles.productName} numberOfLines={2}>
            {productData?.name ?? 'Product'}
          </Text>
          {productData?.brand ? (
            <Text style={styles.productBrand}>{productData.brand}</Text>
          ) : null}
        </View>
        {/* 1 to 5 Star Rating Selector */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionLabel}>Rate this product</Text>
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
                  style={styles.starButton}
                  hitSlop={6}
                >
                  <Ionicons
                    name={isFilled ? 'star' : 'star-outline'}
                    size={38}
                    color={isFilled ? '#F5A623' : '#D0D0CA'}
                  />
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.starCaption}>
            {stars === 5
              ? '5 / 5 · Excellent!'
              : stars === 4
                ? '4 / 5 · Great!'
                : stars === 3
                  ? '3 / 5 · Good (Worth it on sale)'
                  : stars === 2
                    ? '2 / 5 · Fair'
                    : stars === 1
                      ? '1 / 5 · Poor'
                      : 'Tap a star to rate'}
          </Text>
        </View>

        {/* Tri-State Recommendation Selector */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionLabel}>Would you recommend this item?</Text>
          <View
            style={styles.radiogroup}
            accessibilityRole="radiogroup"
            accessibilityLabel="Would you recommend this item?"
          >
            {RECOMMENDATION_OPTIONS.map((opt) => {
              const isSelected = rating === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="radio"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => handleSelectRecommendation(opt.value)}
                  style={[
                    styles.radioPill,
                    {
                      borderColor: isSelected ? opt.activeBorder : '#E5E5E0',
                      backgroundColor: isSelected ? opt.activeBg : '#FAFAF8',
                    },
                  ]}
                >
                  <Ionicons
                    name={opt.icon}
                    size={20}
                    color={isSelected ? opt.iconColor : '#8C8C85'}
                    style={{ marginBottom: 4 }}
                  />
                  <Text
                    style={[
                      styles.pillLabel,
                      {
                        color: isSelected ? opt.activeText : '#8C8C85',
                        fontWeight: isSelected ? '600' : '400',
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Written Review Body */}
        <View style={styles.sectionContainer}>
          <TextField
            label="Your thoughts (optional)"
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={5}
            maxLength={2000}
            placeholder="Share what you liked, taste, packaging, value..."
            placeholderTextColor="#8C8C85"
          />
          <Text style={styles.charCount}>{body.length}/2000</Text>
        </View>

        {/* Error Feedback */}
        {error ? (
          <View style={styles.errorText}>
            <ErrorText>{error}</ErrorText>
          </View>
        ) : null}

        {/* Submit CTA */}
        <View style={styles.submitContainer}>
          <Button
            testID="review-submit"
            label={isEdit ? 'Update review' : 'Submit review'}
            onPress={onSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
            variant="primary"
          />
        </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C2C28', // Almost Black
  },
  productCard: {
    backgroundColor: '#FAFAF8', // Warm White
    borderWidth: 1,
    borderColor: '#F0F0ED',     // Stone
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  productName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2C2C28',
  },
  productBrand: {
    fontSize: 14,
    color: '#8C8C85', // Pebble
    marginTop: 4,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C2C28',
    marginBottom: 10,
  },
  radiogroup: {
    flexDirection: 'row',
    gap: 8,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  starButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starCaption: {
    fontSize: 13,
    color: '#8C8C85',
    textAlign: 'center',
    marginTop: 4,
  },
  radioPill: {
    flex: 1,
    minHeight: 52, // >= 44pt rule
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  pillLabel: {
    fontSize: 13,
    textAlign: 'center',
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#8C8C85',
    textAlign: 'right',
    marginTop: 4,
  },
  errorText: {
    marginBottom: 12,
  },
  submitContainer: {
    marginTop: 8,
  },
  submitButton: {
    minHeight: 48,
    borderRadius: 12,
  },
  moderationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  moderationCard: {
    backgroundColor: '#FAFAF8',
    borderWidth: 1,
    borderColor: '#F0F0ED',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  moderationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C2C28',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  moderationBody: {
    fontSize: 14,
    color: '#8C8C85',
    textAlign: 'center',
    lineHeight: 20,
  },
});
