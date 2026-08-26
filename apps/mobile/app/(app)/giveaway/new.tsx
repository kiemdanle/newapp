// apps/mobile/app/(app)/giveaway/new.tsx
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useCreateGiveaway, uploadGiveawayPhoto } from '@/api/giveaways';
import { choosePhotos, takePhoto } from '@/features/products/photo-picker-adapter';
import { WheelDatePickerModal } from '@/components/WheelDatePickerModal';
import { useSessionStore } from '@/auth/session-store';
import { useTheme } from '@/theme/useTheme';
import { formatDate } from '@/utils/country-format';
import type { AppNavigationProp } from '@/navigation/AppNavigator';
const MAX_PHOTOS = 5;

interface LocalPhotoItem {
  id: string;
  path: string;
  mime?: string;
  uploading?: boolean;
  uploadedUrl?: string;
}

export default function NewGiveawayScreen() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const user = useSessionStore((s) => s.user);
  const userCountry = user?.country ?? null;
  const profileLocation = user?.address?.trim() ?? '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationText, setLocation] = useState(profileLocation);
  const [expiryDate, setExpiryDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [photos, setPhotos] = useState<LocalPhotoItem[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateGiveaway();
  const pending = create.isPending || uploadingPhotos;

  async function handleTakePhoto() {
    if (photos.length >= MAX_PHOTOS) return;
    try {
      const picked = await takePhoto();
      if (picked) {
        setPhotos((prev) => [
          ...prev,
          {
            id: `photo-${Date.now()}-${Math.random()}`,
            path: picked.path,
            mime: picked.mime,
          },
        ]);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to capture photo');
    }
  }

  async function handleChooseGallery() {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    try {
      const pickedList = await choosePhotos(remaining);
      if (pickedList && pickedList.length > 0) {
        const newItems: LocalPhotoItem[] = pickedList.map((p, idx) => ({
          id: `photo-${Date.now()}-${idx}`,
          path: p.path,
          mime: p.mime,
        }));
        setPhotos((prev) => [...prev, ...newItems]);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to select photos');
    }
  }

  function handleRemovePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  async function submit() {
    setError(null);
    if (!title.trim() || !locationText.trim()) {
      setError('Title and location are required.');
      return;
    }

    try {
      setUploadingPhotos(true);
      const uploadedUrls: string[] = [];

      // Upload all picked photos to server
      for (const p of photos) {
        if (p.uploadedUrl) {
          uploadedUrls.push(p.uploadedUrl);
        } else {
          try {
            const res = await uploadGiveawayPhoto({ path: p.path, mime: p.mime });
            uploadedUrls.push(res.photoUrl);
          } catch {
            // If upload fails, continue with local URL or fallback
            uploadedUrls.push(p.path);
          }
        }
      }

      await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        locationText: locationText.trim(),
        expiryDate: expiryDate || undefined,
        photoUrl: uploadedUrls.length > 0 ? uploadedUrls[0] : undefined,
        photoUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
      });
      setUploadingPhotos(false);
      navigation.goBack();
    } catch (err: unknown) {
      setUploadingPhotos(false);
      setError((err as Error).message || 'Could not create giveaway.');
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.heading, { color: theme.colors.text }]}>Share an Item</Text>
        <Text style={[styles.subheading, { color: theme.colors.textMuted }]}>
          Give food, pantry staples, or groceries to neighbors nearby.
        </Text>
      </View>

      {/* Image Picker Section */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Photos ({photos.length}/{MAX_PHOTOS})
          </Text>
          {photos.length > 0 ? (
            <Text style={[styles.sectionHint, { color: theme.colors.textMuted }]}>
              First photo is the cover
            </Text>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoList}
        >
          {photos.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.photoCard,
                {
                  borderColor: index === 0 ? theme.colors.primary : theme.colors.border,
                  backgroundColor: theme.colors.bgElevated,
                },
              ]}
            >
              <Image
                source={{ uri: item.path }}
                style={styles.photoImage}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
              {index === 0 && (
                <View style={[styles.coverBadge, { backgroundColor: theme.colors.primary }]}>
                  <Text style={[styles.coverText, { color: theme.colors.primaryFg }]}>Cover</Text>
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
                onPress={() => handleRemovePhoto(item.id)}
                style={[styles.removeBtn, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
              >
                <Ionicons name="close" size={14} color="#FFF" />
              </Pressable>
            </View>
          ))}

          {photos.length < MAX_PHOTOS && (
            <View style={styles.addPhotoActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take a photo with camera"
                onPress={handleTakePhoto}
                style={[
                  styles.addPhotoBtn,
                  {
                    backgroundColor: theme.colors.bgElevated,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.md,
                  },
                ]}
              >
                <Ionicons name="camera-outline" size={22} color={theme.colors.primary} />
                <Text style={[styles.addPhotoText, { color: theme.colors.text }]}>Camera</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Select photo from gallery"
                onPress={handleChooseGallery}
                style={[
                  styles.addPhotoBtn,
                  {
                    backgroundColor: theme.colors.bgElevated,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.md,
                  },
                ]}
              >
                <Ionicons name="images-outline" size={22} color={theme.colors.primary} />
                <Text style={[styles.addPhotoText, { color: theme.colors.text }]}>Gallery</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Form Fields */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Item Title *</Text>
        <TextInput
          accessibilityLabel="Giveaway title"
          placeholder="e.g. 2 Unopened boxes of Organic Pasta"
          placeholderTextColor={theme.colors.textMuted}
          value={title}
          onChangeText={setTitle}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              color: theme.colors.text,
            },
          ]}
        />
      </View>

      <View style={styles.fieldGroup}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
            Location / Neighborhood *
          </Text>
          {profileLocation && locationText !== profileLocation ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Auto-fill location from profile"
              onPress={() => setLocation(profileLocation)}
              hitSlop={8}
            >
              <Text style={{ color: theme.colors.primaryDark, fontSize: 12, fontWeight: '600' }}>
                📍 Use profile location
              </Text>
            </Pressable>
          ) : profileLocation && locationText === profileLocation ? (
            <Text style={{ color: theme.colors.primaryDark, fontSize: 11, fontWeight: '600' }}>
              ✓ Filled from profile
            </Text>
          ) : null}
        </View>
        <TextInput
          accessibilityLabel="Pickup location"
          placeholder="e.g. Downtown near Central Park or Porch Pickup"
          placeholderTextColor={theme.colors.textMuted}
          value={locationText}
          onChangeText={setLocation}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              color: theme.colors.text,
            },
          ]}
        />
      </View>
      {/* Item Expiry Date Field (Optional) */}
      <View style={styles.fieldGroup}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
            Item Expiration / Best-By Date (Optional)
          </Text>
          {expiryDate ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setExpiryDate('')}
              hitSlop={8}
            >
              <Text style={{ color: theme.colors.danger, fontSize: 12, fontWeight: '600' }}>
                Clear
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select expiration date"
          onPress={() => setShowDatePicker(true)}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
            <Text
              style={{
                color: expiryDate ? theme.colors.text : theme.colors.textMuted,
                fontSize: 15,
                fontWeight: expiryDate ? '600' : '400',
              }}
            >
              {expiryDate ? formatDate(expiryDate, userCountry) : 'Select expiration date'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      <WheelDatePickerModal
        visible={showDatePicker}
        value={expiryDate}
        onClose={() => setShowDatePicker(false)}
        onConfirm={(iso) => setExpiryDate(iso)}
      />

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Description & Notes</Text>
        <TextInput
          accessibilityLabel="Giveaway description"
          placeholder="Expiry date, pickup instructions, allergy details…"
          placeholderTextColor={theme.colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          style={[
            styles.multilineInput,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              color: theme.colors.text,
            },
          ]}
        />
      </View>
      {error ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text> : null}

      {/* Submit Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Post Giveaway"
        onPress={submit}
        disabled={pending}
        style={({ pressed }) => [
          styles.submitBtn,
          {
            backgroundColor: pressed ? theme.colors.primaryDark : theme.colors.primary,
            borderRadius: theme.radii.pill,
            opacity: pending ? 0.7 : 1,
          },
        ]}
      >
        {pending ? (
          <ActivityIndicator color={theme.colors.primaryFg} style={{ marginRight: 8 }} />
        ) : (
          <Ionicons name="gift-outline" size={20} color={theme.colors.primaryFg} style={{ marginRight: 6 }} />
        )}
        <Text style={[styles.submitBtnText, { color: theme.colors.primaryFg }]}>
          {pending ? (uploadingPhotos ? 'Uploading Photos…' : 'Posting…') : 'Post Giveaway'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    marginBottom: 4,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
  },
  subheading: {
    fontSize: 13,
    marginTop: 4,
  },
  section: {
    gap: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 12,
  },
  photoList: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  photoCard: {
    width: 90,
    height: 90,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  coverBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 2,
    alignItems: 'center',
  },
  coverText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addPhotoBtn: {
    width: 80,
    height: 90,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 11,
    fontWeight: '600',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 48,
  },
  multilineInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    minHeight: 52,
    marginTop: 8,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
