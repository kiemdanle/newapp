import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { registerSchema } from '@expyrico/shared';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { ErrorText } from '../../src/components/ErrorText';
import { LogoLockup } from '../../src/components/Logo';
import { fieldErrors } from '../../src/lib/validate';
import { authEndpoints } from '../../src/api/endpoints';
import { useSessionStore } from '../../src/auth/session-store';
import { isApiError } from '../../src/api/errors';
import { isNetworkError, NETWORK_ERROR_MESSAGE } from '../../src/api/network-error';
import { useTheme } from '../../src/theme/useTheme';
import {
  readPendingReferralCode,
  clearPendingReferralCode,
} from '../../src/referral/pendingReferralStore';

export default function SignUp() {
  const router = useRouter();
  const theme = useTheme();
  const setPendingAuth = useSessionStore((s) => s.setPendingAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [referralCode, setReferralCode] = useState<string | undefined>(undefined);
  const [codeManuallySet, setCodeManuallySet] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void readPendingReferralCode().then((c) => {
      if (c) setReferralCode(c);
    });
  }, []);

  async function onSubmit() {
    setFormError(null);
    const input = {
      email,
      password,
      firstName,
      lastName,
      ...(referralCode ? { referralCode } : {}),
    };
    const errs = fieldErrors(registerSchema, input);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      const result = await authEndpoints.register(input);
      await clearPendingReferralCode();
      // Hold the session as pending (do NOT sign in yet). Signing in would set
      // accessToken, and AuthGate bounces any token-holder in the (auth) group
      // straight to home — skipping the OTP step. verify-email commits the
      // session once the email is confirmed.
      setPendingAuth(result);
      router.replace({ pathname: '/(auth)/verify-email', params: { email: result.user.email } });
    } catch (e) {
      if (isApiError(e)) {
        setFormError(e.title);
      } else if (isNetworkError(e)) {
        setFormError(NETWORK_ERROR_MESSAGE);
      } else {
        setFormError('Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen backFallback="/(auth)/welcome">
      <View style={styles.header}>
        <LogoLockup width={146} />
        <View style={styles.logoAccent}>
          <View style={[styles.logoAccentPrimary, { backgroundColor: theme.colors.primary }]} />
          <View style={[styles.logoAccentSecondary, { backgroundColor: theme.colors.accent }]} />
        </View>
        <Text
          style={[
            styles.title,
            {
              color: theme.colors.text,
              fontSize: theme.typeRamp.headlineMedium.fontSize,
              lineHeight: theme.typeRamp.headlineMedium.lineHeight,
              fontWeight: theme.typeRamp.headlineLarge.fontWeight as any,
            },
          ]}
        >
          Create your account
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Start tracking pantry items with expiry alerts and fresh-use suggestions.
        </Text>
      </View>

      <TextField
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
      />
      <TextField
        label="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        error={errors.password}
      />
      <View style={styles.row}>
        <View style={styles.half}>
          <TextField
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            error={errors.firstName}
          />
        </View>
        <View style={styles.half}>
          <TextField
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            error={errors.lastName}
          />
        </View>
      </View>

      <TextField
        label="Invite code (optional)"
        autoCapitalize="characters"
        value={referralCode ?? ''}
        onChangeText={(t) => {
          setCodeManuallySet(true);
          setReferralCode(t.trim().toUpperCase() || undefined);
        }}
        error={errors.referralCode}
      />
      {referralCode && !codeManuallySet ? (
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.typeRamp.labelSmall.fontSize }}>
          Code applied from your invite link
        </Text>
      ) : null}

      {formError ? <ErrorText>{formError}</ErrorText> : null}
      <AuthAction
        testID="sign-up-submit"
        label="Create account"
        icon="person-add"
        onPress={onSubmit}
        loading={loading}
      />
    </Screen>
  );
}

function AuthAction({
  label,
  onPress,
  testID,
  icon,
  loading,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
}) {
  const theme = useTheme();
  const color = theme.colors.textInverse;

  return (
    <View
      style={[
        styles.actionFrame,
        {
          backgroundColor: theme.colors.accent,
          borderColor: theme.colors.accent,
          borderRadius: theme.radii.pill,
          shadowColor: theme.colors.accent,
        },
      ]}
    >
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={loading}
        onPress={onPress}
        style={({ pressed }) => [styles.actionPress, (pressed || loading) && styles.actionPressed]}
      >
        <View style={styles.actionRow}>
          {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
          <Text
            style={[
              styles.actionLabel,
              {
                color,
                fontSize: theme.typeRamp.labelLarge.fontSize,
                lineHeight: theme.typeRamp.labelLarge.lineHeight,
                fontWeight: '700',
              },
            ]}
          >
            {loading ? 'Creating account...' : label}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 8, marginBottom: 4, marginTop: 0 },
  logoAccent: {
    width: 58,
    height: 4,
    borderRadius: 999,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  logoAccentPrimary: {
    flex: 2,
  },
  logoAccentSecondary: {
    flex: 1,
  },
  title: { textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: 12 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  actionFrame: {
    height: 52,
    width: '100%',
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 4,
  },
  actionPress: {
    height: 52,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  actionPressed: {
    opacity: 0.82,
  },
  actionRow: {
    height: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  actionLabel: {
    textAlign: 'center',
    includeFontPadding: false,
  },
});
