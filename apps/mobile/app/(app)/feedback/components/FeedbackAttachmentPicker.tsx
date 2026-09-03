import React from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '@/theme/useTheme';
import {
  takePhoto,
  choosePhotos,
  handlePhotoPickerError,
  type PickedPhoto,
} from '@/features/products/photo-picker-adapter';

const MAX_ATTACHMENTS = 5;

export function FeedbackAttachmentPicker({
  photos,
  onChange,
}: {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
}) {
  const theme = useTheme();

  const remaining = MAX_ATTACHMENTS - photos.length;

  async function handleAddPhoto() {
    if (remaining <= 0) {
      Alert.alert('Limit Reached', `You can attach up to ${MAX_ATTACHMENTS} photos per ticket.`);
      return;
    }

    Alert.alert(
      'Add Photo or Screenshot',
      'Choose a source for your attachment',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            try {
              const photo = await takePhoto();
              if (photo) {
                onChange([...photos, photo]);
              }
            } catch (err) {
              const msg = handlePhotoPickerError(err, 'camera');
              if (msg) Alert.alert('Camera Error', msg);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            try {
              const selected = await choosePhotos(remaining);
              if (selected.length > 0) {
                onChange([...photos, ...selected]);
              }
            } catch (err) {
              const msg = handlePhotoPickerError(err, 'gallery');
              if (msg) Alert.alert('Gallery Error', msg);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  function handleRemove(index: number) {
    const updated = [...photos];
    updated.splice(index, 1);
    onChange(updated);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>
          ATTACHMENTS ({photos.length}/{MAX_ATTACHMENTS})
        </Text>
        <Text style={[styles.hint, { color: theme.colors.textMuted }]}>Max 10 MB each</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {photos.map((photo, idx) => (
          <View key={`${photo.path}-${idx}`} style={[styles.thumbnailWrap, { borderColor: theme.colors.border }]}>
            <Image source={{ uri: photo.path }} style={styles.thumbnail} />
            <Pressable
              testID={`feedback-remove-photo-${idx}`}
              accessibilityRole="button"
              accessibilityLabel={`Remove attachment ${idx + 1}`}
              onPress={() => handleRemove(idx)}
              style={styles.removeBadge}
            >
              <Ionicons name="close" size={12} color="#FFFFFF" />
            </Pressable>
            <View style={styles.sizeTag}>
              <Text style={styles.sizeText}>{(photo.size / (1024 * 1024)).toFixed(1)} MB</Text>
            </View>
          </View>
        ))}

        {remaining > 0 && (
          <Pressable
            testID="feedback-add-attachment"
            accessibilityRole="button"
            accessibilityLabel="Add screenshot or photo"
            onPress={handleAddPhoto}
            style={({ pressed }) => [
              styles.addCard,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.bgElevated,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="camera-outline" size={22} color={theme.colors.primary} />
            <Text style={[styles.addText, { color: theme.colors.primaryDark }]}>+ Add file</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  hint: {
    fontSize: 11,
  },
  scroll: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  thumbnailWrap: {
    width: 80,
    height: 80,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#2C2C28',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeTag: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 4,
    paddingVertical: 1,
    alignItems: 'center',
  },
  sizeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
  },
  addCard: {
    width: 80,
    height: 80,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
