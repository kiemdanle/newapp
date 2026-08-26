// apps/mobile/src/features/giveaways/GiveawayQuickEditModal.tsx
import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Giveaway } from '@expyrico/shared';
import { useTheme } from '../../theme/useTheme';
import { Button } from '../../components/Button';
import { takePhoto, choosePhotos } from '../products/photo-picker-adapter';
import { uploadGiveawayPhoto } from '../../api/giveaways';

const MAX_PHOTOS = 5;

interface LocalPhotoItem {
  id: string;
  path: string;
  mime?: string;
  uploadedUrl?: string;
}

interface Props {
  visible: boolean;
  giveaway: Giveaway | null;
  onClose: () => void;
  onSave: (patch: {
    title: string;
    locationText: string;
    description?: string;
    photoUrl?: string | null;
    photoUrls?: string[];
  }) => Promise<void>;
}

export function GiveawayQuickEditModal({ visible, giveaway, onClose, onSave }: Props) {
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [locationText, setLocationText] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<LocalPhotoItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && giveaway) {
      setTitle(giveaway.title);
      setLocationText(giveaway.locationText);
      setDescription(giveaway.description ?? '');
      setError(null);

      let existingUrls: string[] = [];
      if (giveaway.photoUrls && Array.isArray(giveaway.photoUrls) && giveaway.photoUrls.length > 0) {
        existingUrls = giveaway.photoUrls;
      } else if (giveaway.photoUrl) {
        const raw = giveaway.photoUrl.trim();
        if (raw.startsWith('[') && raw.endsWith(']')) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              existingUrls = parsed.filter((s): s is string => typeof s === 'string' && s.length > 0);
            }
          } catch {
            existingUrls = [raw];
          }
        } else {
          existingUrls = [raw];
        }
      }

      setPhotos(
        existingUrls.map((url, idx) => ({
          id: `existing-${idx}-${url}`,
          path: url,
          uploadedUrl: url,
        })),
      );
    }
  }, [visible, giveaway]);

  if (!giveaway) return null;

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

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!locationText.trim()) {
      setError('Location is required');
      return;
    }

    try {
      setSaving(true);
      const uploadedUrls: string[] = [];

      // Upload newly added local photos to server
      for (const p of photos) {
        if (p.uploadedUrl) {
          uploadedUrls.push(p.uploadedUrl);
        } else {
          try {
            const res = await uploadGiveawayPhoto({ path: p.path, mime: p.mime });
            if (res && res.photoUrl) {
              uploadedUrls.push(res.photoUrl);
            }
          } catch (uploadErr: unknown) {
            throw new Error(
              (uploadErr as Error).message || 'Failed to upload new photo. Please try again.',
            );
          }
        }
      }

      await onSave({
        title: title.trim(),
        locationText: locationText.trim(),
        description: description.trim() || undefined,
        photoUrl: uploadedUrls.length > 0 ? uploadedUrls[0] : null,
        photoUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
      });
      setSaving(false);
      onClose();
    } catch (err: unknown) {
      setSaving(false);
      setError((err as Error).message || 'Failed to save changes');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss modal"
          style={styles.dismissOverlay}
          onPress={onClose}
        />
        <View style={[styles.modalCard, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
          {/* Modal Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.colors.text }]}>Edit Giveaway</Text>
              <Text style={[styles.subheading, { color: theme.colors.textMuted }]}>
                Update title, photos, location, or details
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close modal"
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border }]}
            >
              <Ionicons name="close" size={18} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.formContent}
          >
            {/* Photos Section */}
            <View style={styles.fieldGroup}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.label, { color: theme.colors.text }]}>
                  Photos ({photos.length}/{MAX_PHOTOS})
                </Text>
                {photos.length > 0 ? (
                  <Text style={[styles.sectionHint, { color: theme.colors.textMuted }]}>
                    First photo is cover
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
                      style={[styles.removeBtn, { backgroundColor: 'rgba(0,0,0,0.65)' }]}
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
                          backgroundColor: theme.colors.bgGlass,
                          borderColor: theme.colors.border,
                          borderRadius: theme.radii.md,
                        },
                      ]}
                    >
                      <Ionicons name="camera-outline" size={20} color={theme.colors.primary} />
                      <Text style={[styles.addPhotoText, { color: theme.colors.text }]}>Camera</Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Select photo from gallery"
                      onPress={handleChooseGallery}
                      style={[
                        styles.addPhotoBtn,
                        {
                          backgroundColor: theme.colors.bgGlass,
                          borderColor: theme.colors.border,
                          borderRadius: theme.radii.md,
                        },
                      ]}
                    >
                      <Ionicons name="images-outline" size={20} color={theme.colors.primary} />
                      <Text style={[styles.addPhotoText, { color: theme.colors.text }]}>Gallery</Text>
                    </Pressable>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Title Field */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Title *</Text>
              <TextInput
                accessibilityLabel="Giveaway title"
                value={title}
                onChangeText={setTitle}
                placeholder="Item title"
                placeholderTextColor={theme.colors.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.bgGlass,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    borderRadius: theme.radii.md,
                  },
                ]}
              />
            </View>

            {/* Location Field */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Location / Neighborhood *</Text>
              <TextInput
                accessibilityLabel="Pickup location"
                value={locationText}
                onChangeText={setLocationText}
                placeholder="e.g. Downtown near Central Park"
                placeholderTextColor={theme.colors.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.bgGlass,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    borderRadius: theme.radii.md,
                  },
                ]}
              />
            </View>

            {/* Description Field */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Description & Notes</Text>
              <TextInput
                accessibilityLabel="Giveaway description"
                value={description}
                onChangeText={setDescription}
                placeholder="Pickup instructions, details…"
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={3}
                style={[
                  styles.multilineInput,
                  {
                    backgroundColor: theme.colors.bgGlass,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    borderRadius: theme.radii.md,
                  },
                ]}
              />
            </View>

            {error ? (
              <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
            ) : null}
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <View style={{ flex: 1 }}>
              <Button
                label="Cancel"
                variant="outline"
                disabled={saving}
                onPress={onClose}
              />
            </View>
            <View style={{ flex: 1.5 }}>
              <Button
                label={saving ? 'Saving…' : 'Save Changes'}
                variant="primary"
                loading={saving}
                disabled={saving}
                onPress={handleSave}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  dismissOverlay: {
    flex: 1,
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    maxHeight: '88%',
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHint: {
    fontSize: 11,
    fontWeight: '500',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  photoList: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  photoCard: {
    width: 72,
    height: 72,
    borderRadius: 10,
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
  },
  removeBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addPhotoBtn: {
    width: 72,
    height: 72,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  addPhotoText: {
    fontSize: 11,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  multilineInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 76,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    marginTop: 8,
  },
});
