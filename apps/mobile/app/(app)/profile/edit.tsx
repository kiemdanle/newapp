import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSessionStore } from '../../../src/auth/session-store';
import { meEndpoints } from '../../../src/api/endpoints';
import { Avatar } from '../../../src/components/Avatar';
import { TextField } from '../../../src/components/TextField';
import { Button } from '../../../src/components/Button';
import { CountryPickerModal } from '../../../src/components/CountryPickerModal';
import { MultiPhotoCameraModal } from '../../../src/components/MultiPhotoCameraModal';
import {
  getCountryMetadata,
  type CountryMetadata,
} from '../../../src/utils/country-format';
import {
  choosePhotos,
  handlePhotoPickerError,
} from '../../../src/features/products/photo-picker-adapter';
import { useTheme } from '../../../src/theme/useTheme';

export default function EditProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [country, setCountry] = useState(user?.country ?? 'US');

  const [isCameraModalVisible, setIsCameraModalVisible] = useState(false);
  const [isCountryModalVisible, setIsCountryModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedCountryMeta = useMemo(() => getCountryMetadata(country), [country]);

  // Dirty detection for unsaved changes guard
  const isDirty =
    firstName !== (user?.firstName ?? '') ||
    lastName !== (user?.lastName ?? '') ||
    address !== (user?.address ?? '') ||
    country !== (user?.country ?? 'US');

  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (e: { preventDefault: () => void; data: { action: unknown } }) => {
        if (!dirtyRef.current) return;
        e.preventDefault();
        Alert.alert(
          'Discard unsaved changes?',
          "You have unsaved changes to your profile. Are you sure you want to leave?",
          [
            { text: 'Keep editing', style: 'cancel' },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => {
                dirtyRef.current = false;
                // @ts-expect-error navigation dispatch action
                navigation.dispatch(e.data.action);
              },
            },
          ],
        );
      });
      return unsubscribe;
    }, [navigation]),
  );

  const handleAvatarUpload = async (photoPath: string, mimeType: string = 'image/jpeg') => {
    setIsAvatarUploading(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      const normalizedPath =
        Platform.OS === 'android' ? photoPath : photoPath.replace('file://', '');

      formData.append('file', {
        uri: normalizedPath,
        type: mimeType || 'image/jpeg',
        name: 'avatar.jpg',
      } as unknown as Blob);

      const res = await meEndpoints.uploadAvatar(formData);
      setUser(res.user);
      Alert.alert('Success', 'Profile photo updated successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload photo';
      setErrorMessage(msg);
      Alert.alert('Upload Failed', msg);
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const handleAvatarDelete = async () => {
    setIsAvatarUploading(true);
    setErrorMessage(null);
    try {
      const updated = await meEndpoints.deleteAvatar();
      setUser(updated);
      Alert.alert('Success', 'Profile photo removed.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete photo';
      setErrorMessage(msg);
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const openAvatarPicker = () => {
    const options = ['Take Photo', 'Choose from Library', 'Cancel'];
    if (user?.avatarUrl) {
      options.splice(2, 0, 'Remove Photo');
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: user?.avatarUrl ? 2 : undefined,
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) {
            setIsCameraModalVisible(true);
          } else if (buttonIndex === 1) {
            try {
              const photos = await choosePhotos(1);
              if (photos.length > 0) await handleAvatarUpload(photos[0]!.path, photos[0]!.mime);
            } catch (err) {
              handlePhotoPickerError(err, 'gallery');
            }
          } else if (user?.avatarUrl && buttonIndex === 2) {
            await handleAvatarDelete();
          }
        },
      );
    } else {
      Alert.alert('Profile Photo', 'Select an option', [
        {
          text: 'Take Photo',
          onPress: () => {
            setIsCameraModalVisible(true);
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            try {
              const photos = await choosePhotos(1);
              if (photos.length > 0) await handleAvatarUpload(photos[0]!.path, photos[0]!.mime);
            } catch (err) {
              handlePhotoPickerError(err, 'gallery');
            }
          },
        },
        ...(user?.avatarUrl
          ? [
              {
                text: 'Remove Photo',
                style: 'destructive' as const,
                onPress: handleAvatarDelete,
              },
            ]
          : []),
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleCameraCapture = async (photos: { path: string; mime?: string }[]) => {
    if (photos.length > 0 && photos[0]?.path) {
      await handleAvatarUpload(photos[0].path, photos[0].mime ?? 'image/jpeg');
    }
  };

  const handleCountrySelect = (meta: CountryMetadata) => {
    setCountry(meta.code);
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage('First name and last name are required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const updatedUser = await meEndpoints.update({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        address: address.trim() || null,
        country: country || null,
      });

      setUser(updatedUser);
      dirtyRef.current = false;
      Alert.alert('Profile Updated', 'Your profile details have been saved successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView
      testID="edit-profile-screen"
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Avatar Section */}
      <View style={styles.avatarSection}>
        <View style={{ position: 'relative' }}>
          <Avatar
            testID="edit-profile-avatar"
            url={user?.avatarUrl}
            firstName={user?.firstName}
            lastName={user?.lastName}
            size="xxl"
            editable
            onEditPress={openAvatarPicker}
          />
          {isAvatarUploading && (
            <View style={styles.avatarLoadingOverlay}>
              <ActivityIndicator color="#FFFFFF" size="small" />
            </View>
          )}
        </View>
        <Pressable
          testID="edit-avatar-btn"
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          onPress={openAvatarPicker}
          disabled={isAvatarUploading}
          style={styles.changePhotoBtn}
        >
          <Text style={[styles.changePhotoText, { color: theme.colors.primaryDark }]}>
            {isAvatarUploading ? 'Uploading photo…' : 'Change profile photo'}
          </Text>
        </Pressable>
      </View>

      {errorMessage ? (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: 'rgba(224,68,42,0.1)', borderColor: theme.colors.danger },
          ]}
        >
          <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
          <Text style={{ color: theme.colors.danger, fontSize: 13, flex: 1 }}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* Personal Info Form */}
      <View style={styles.formSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>PERSONAL INFORMATION</Text>

        <TextField
          testID="edit-profile-first-name"
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          autoCapitalize="words"
        />

        <TextField
          testID="edit-profile-last-name"
          label="Last name"
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          autoCapitalize="words"
        />

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Email address</Text>
          <View
            style={[
              styles.disabledEmailField,
              { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border },
            ]}
          >
            <Text style={{ color: theme.colors.textMuted, fontSize: 15, flex: 1 }}>{user?.email}</Text>
            {user?.emailVerified ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.primaryDark, fontSize: 12, fontWeight: '600' }}>Verified</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Address & Regional Preferences */}
      <View style={styles.formSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>LOCATION & REGIONAL PREFERENCES</Text>

        <View style={styles.fieldContainer}>
          <TextField
            testID="edit-profile-address"
            label="Address (Optional)"
            value={address}
            onChangeText={setAddress}
            placeholder="e.g. 123 Market St, Apt 4B"
          />
          <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: -4 }}>
            Used for local deals, community giveaways, and delivery
          </Text>
        </View>

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Country & Currency</Text>
          <Pressable
            testID="edit-profile-country-btn"
            accessibilityRole="button"
            accessibilityLabel="Select country"
            onPress={() => setIsCountryModalVisible(true)}
            style={({ pressed }) => [
              styles.countrySelectorButton,
              {
                backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={styles.countryFlag}>{selectedCountryMeta.flag}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '600' }}>
                {selectedCountryMeta.name} ({selectedCountryMeta.code})
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                Default currency: {selectedCountryMeta.currencyCode} ({selectedCountryMeta.currencySymbol})
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        {/* Regional Preview Card */}
        <View
          style={[
            styles.regionalCallout,
            { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
          ]}
        >
          <Ionicons name="globe-outline" size={18} color={theme.colors.primaryDark} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: theme.colors.primaryDark, fontWeight: '700', fontSize: 13 }}>
              Regional Formatting Impact
            </Text>
            <Text style={{ color: theme.colors.text, fontSize: 12, lineHeight: 17 }}>
              Selecting {selectedCountryMeta.name} will format dates as{' '}
              <Text style={{ fontWeight: '700' }}>
                {selectedCountryMeta.dateFormat === 'DMY'
                  ? 'DD/MM/YYYY'
                  : selectedCountryMeta.dateFormat === 'MDY'
                    ? 'MM/DD/YYYY'
                    : 'YYYY/MM/DD'}
              </Text>{' '}
              and display prices in{' '}
              <Text style={{ fontWeight: '700' }}>
                {selectedCountryMeta.currencyCode} ({selectedCountryMeta.currencySymbol})
              </Text>{' '}
              across the entire app.
            </Text>
          </View>
        </View>
      </View>

      {/* Submit Button */}
      <View style={{ marginTop: 24 }}>
        <Button
          testID="edit-profile-save-btn"
          label={isSaving ? 'Saving changes…' : 'Save Changes'}
          onPress={handleSave}
          disabled={isSaving || isAvatarUploading}
          variant="primary"
        />
      </View>

      <CountryPickerModal
        visible={isCountryModalVisible}
        selectedCountry={country}
        onSelect={handleCountrySelect}
        onClose={() => setIsCountryModalVisible(false)}
      />
      <MultiPhotoCameraModal
        visible={isCameraModalVisible}
        maxPhotos={1}
        title="Profile Photo"
        onCapture={handleCameraCapture}
        onClose={() => setIsCameraModalVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatarSection: {
    alignItems: 'center',
    marginVertical: 16,
    gap: 10,
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 52,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  formSection: {
    gap: 14,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
    marginLeft: 2,
  },
  fieldContainer: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  disabledEmailField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countrySelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  countryFlag: {
    fontSize: 24,
  },
  regionalCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
});
