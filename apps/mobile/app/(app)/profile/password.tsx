import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useSessionStore } from '../../../src/auth/session-store';
import { secureStore } from '../../../src/auth/secure-store';
import { meEndpoints } from '../../../src/api/endpoints';
import { TextField } from '../../../src/components/TextField';
import { Button } from '../../../src/components/Button';
import { useTheme } from '../../../src/theme/useTheme';

export default function PasswordScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);

  const hasPassword = Boolean(user?.hasPassword);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Validation rules
  const hasMinLength = newPassword.length >= 10;
  const isMatching = newPassword.length > 0 && newPassword === confirmPassword;
  const isCurrentValid = !hasPassword || currentPassword.length > 0;
  const canSubmit = hasMinLength && isMatching && isCurrentValid;

  const handlePasswordSubmit = async () => {
    if (hasPassword && !currentPassword) {
      setErrorMessage('Please enter your current password.');
      return;
    }

    if (!hasMinLength) {
      setErrorMessage('New password must be at least 10 characters.');
      return;
    }

    if (!isMatching) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await meEndpoints.changePassword({
        currentPassword: hasPassword ? currentPassword : undefined,
        newPassword,
        confirmPassword,
      });

      // Synchronize refreshed tokens in secureStore
      if (res.tokens?.accessToken) {
        await secureStore.setAccessToken(res.tokens.accessToken);
      }
      if (res.tokens?.refreshToken) {
        await secureStore.setRefreshToken(res.tokens.refreshToken);
      }

      setUser(res.user);

      Alert.alert(
        'Password Updated',
        hasPassword
          ? 'Your password has been changed successfully.'
          : 'A password has been successfully added to your account.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      testID="password-screen"
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Information Header Card */}
      <View
        style={[
          styles.infoCard,
          {
            backgroundColor: theme.colors.bgGlass,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Ionicons
          name={hasPassword ? 'key-outline' : 'shield-checkmark-outline'}
          size={24}
          color={theme.colors.primaryDark}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 16 }}>
            {hasPassword ? 'Change your password' : 'Set an account password'}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 }}>
            {hasPassword
              ? 'Enter your current password followed by your new password.'
              : 'Add a password to enable email & password sign-in for your account.'}
          </Text>
        </View>
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

      {/* Form Fields */}
      <View style={styles.formContainer}>
        {hasPassword && (
          <View style={styles.fieldWrapper}>
            <TextField
              testID="current-password-input"
              label="Current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              secureTextEntry={!showCurrent}
              autoCapitalize="none"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle current password visibility"
              onPress={() => setShowCurrent(!showCurrent)}
              style={styles.eyeIconBtn}
            >
              <Ionicons
                name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.colors.textMuted}
              />
            </Pressable>
          </View>
        )}

        <View style={styles.fieldWrapper}>
          <TextField
            testID="new-password-input"
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 10 characters"
            secureTextEntry={!showNew}
            autoCapitalize="none"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle new password visibility"
            onPress={() => setShowNew(!showNew)}
            style={styles.eyeIconBtn}
          >
            <Ionicons
              name={showNew ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.colors.textMuted}
            />
          </Pressable>
        </View>

        <View style={styles.fieldWrapper}>
          <TextField
            testID="confirm-password-input"
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter new password"
            secureTextEntry={!showConfirm}
            autoCapitalize="none"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle confirm password visibility"
            onPress={() => setShowConfirm(!showConfirm)}
            style={styles.eyeIconBtn}
          >
            <Ionicons
              name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.colors.textMuted}
            />
          </Pressable>
        </View>
      </View>

      {/* Real-time Checklist */}
      <View
        style={[
          styles.checklistCard,
          { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.checklistTitle, { color: theme.colors.textMuted }]}>
          PASSWORD REQUIREMENTS
        </Text>
        <View style={styles.checklistItem}>
          <Ionicons
            name={hasMinLength ? 'checkmark-circle' : 'ellipse-outline'}
            size={16}
            color={hasMinLength ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text
            style={{
              fontSize: 13,
              color: hasMinLength ? theme.colors.primaryDark : theme.colors.textMuted,
              fontWeight: hasMinLength ? '600' : '400',
            }}
          >
            At least 10 characters
          </Text>
        </View>
        <View style={styles.checklistItem}>
          <Ionicons
            name={isMatching ? 'checkmark-circle' : 'ellipse-outline'}
            size={16}
            color={isMatching ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text
            style={{
              fontSize: 13,
              color: isMatching ? theme.colors.primaryDark : theme.colors.textMuted,
              fontWeight: isMatching ? '600' : '400',
            }}
          >
            New passwords match
          </Text>
        </View>
      </View>

      {/* Action Button */}
      <View style={{ marginTop: 24 }}>
        <Button
          testID="password-submit-btn"
          label={
            isSubmitting
              ? 'Updating password…'
              : hasPassword
                ? 'Update Password'
                : 'Set Password'
          }
          onPress={handlePasswordSubmit}
          disabled={!canSubmit || isSubmitting}
          variant="primary"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
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
  formContainer: {
    gap: 16,
    marginBottom: 16,
  },
  fieldWrapper: {
    position: 'relative',
  },
  eyeIconBtn: {
    position: 'absolute',
    right: 14,
    top: 36,
    padding: 4,
  },
  checklistCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  checklistTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
