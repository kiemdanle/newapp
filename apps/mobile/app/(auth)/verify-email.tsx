import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ErrorText } from '../../src/components/ErrorText';
import { OtpInput } from '../../src/components/OtpInput';
import { Logo } from '../../src/components/Logo';
import { authEndpoints } from '../../src/api/endpoints';
import { useSessionStore } from '../../src/auth/session-store';
import { isApiError } from '../../src/api/errors';
import { useTheme } from '../../src/theme/useTheme';

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyEmail() {
  const router = useRouter();
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const signIn = useSessionStore((s) => s.signIn);
  const accessToken = useSessionStore((s) => s.accessToken);
  const pendingAuth = useSessionStore((s) => s.pendingAuth);
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? pendingAuth?.user.email ?? user?.email ?? '';
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Tick the resend cooldown down once a second while it's active.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function onResend() {
    setMessage(null);
    setError(null);
    if (!email) {
      setError('No email on file');
      return;
    }
    setResending(true);
    try {
      await authEndpoints.resendVerification(email);
      setMessage('Verification code sent. Check your inbox.');
      setCode('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setError(isApiError(e) ? e.title : 'Something went wrong');
    } finally {
      setResending(false);
    }
  }

  // Wrong address? Go back to where the flow started so the user can re-enter it.
  function onChangeEmail() {
    router.replace(pendingAuth ? '/(auth)/sign-up' : '/(auth)/sign-in');
  }

  async function onSubmit(value = code) {
    const verificationCode = value.replace(/\D/g, '');
    setMessage(null);
    setError(null);
    if (!email) {
      setError('No email on file');
      return;
    }
    if (verificationCode.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      await authEndpoints.verifyEmail({ email, code: verificationCode });
      if (pendingAuth) {
        // Registration flow: the session was held until now. Commit it (with the
        // now-verified flag) so the user lands authenticated on home.
        await signIn({ ...pendingAuth, user: { ...pendingAuth.user, emailVerified: true } });
        router.replace('/(app)/(tabs)/home');
      } else if (accessToken) {
        // Already authenticated and just needed to verify — mark verified.
        if (user) setUser({ ...user, emailVerified: true });
        router.replace('/(app)/(tabs)/home');
      } else {
        // Reached here from the sign-in "email not verified" path with no session
        // — send the user back to sign in now that the email is confirmed.
        router.replace('/(auth)/sign-in');
      }
    } catch (e) {
      setError(isApiError(e) ? e.title : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function onCodeChange(next: string) {
    setCode(next);
    if (error) setError(null);
    if (next.length === 6 && !loading) void onSubmit(next);
  }

  const resendDisabled = resending || cooldown > 0;

  return (
    <Screen backFallback="/(auth)/sign-in">
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: theme.colors.primaryLight }]}>
          <Logo size={44} />
          <View
            style={[
              styles.badgeDot,
              { backgroundColor: theme.colors.accent, borderColor: theme.colors.primaryLight },
            ]}
          />
        </View>
        <Text
          style={[
            styles.title,
            {
              color: theme.colors.text,
              fontSize: theme.typeRamp.headlineLarge.fontSize,
              lineHeight: theme.typeRamp.headlineLarge.lineHeight,
              fontWeight: theme.typeRamp.headlineLarge.fontWeight as any,
            },
          ]}
        >
          Check your inbox
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted, lineHeight: 22 }]}>
          Enter the 6-digit code we sent to
        </Text>
        {email ? (
          <Text style={[styles.email, { color: theme.colors.primary }]}>{email}</Text>
        ) : null}
      </View>

      <OtpInput
        label="Verification code"
        value={code}
        onChangeText={onCodeChange}
        autoFocus
        editable={!loading}
        error={!!error}
      />

      <View style={styles.pillRow}>
        <View style={[styles.pill, { backgroundColor: theme.colors.accentLight }]}>
          <Ionicons name="time-outline" size={15} color={theme.colors.accent} />
          <Text style={[styles.pillText, { color: theme.colors.text }]}>
            Code expires in 10 minutes
          </Text>
        </View>
      </View>

      {message ? (
        <Text style={[styles.status, { color: theme.colors.success }]}>{message}</Text>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      <AuthAction
        testID="verify-submit"
        label="Verify email"
        icon="checkmark-circle"
        onPress={() => void onSubmit()}
        loading={loading}
        disabled={code.length !== 6}
      />

      <Pressable
        testID="verify-resend"
        accessibilityRole="button"
        accessibilityLabel="Resend code"
        onPress={onResend}
        disabled={resendDisabled}
        style={styles.link}
      >
        <Text style={[styles.linkMuted, { color: theme.colors.textMuted }]}>
          Didn't get it?{' '}
        </Text>
        <Text
          style={[
            styles.linkAction,
            { color: resendDisabled ? theme.colors.textMuted : theme.colors.primary },
          ]}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? 'Sending…' : 'Resend code'}
        </Text>
      </Pressable>

      <Pressable
        testID="verify-change-email"
        accessibilityRole="button"
        accessibilityLabel="Change email address"
        onPress={onChangeEmail}
        style={styles.link}
      >
        <Text style={[styles.linkMuted, { color: theme.colors.textMuted }]}>Wrong address?{' '}</Text>
        <Text style={[styles.linkAction, { color: theme.colors.primary }]}>Change email</Text>
      </Pressable>
    </Screen>
  );
}

// Filled Honey pill, matching the primary CTA on sign-in / sign-up so the auth
// flow reads as one consistent surface.
function AuthAction({
  label,
  onPress,
  testID,
  icon,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const color = theme.colors.textInverse;
  const inactive = loading || disabled;

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
        disabled && styles.actionFrameDisabled,
      ]}
    >
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={inactive}
        onPress={onPress}
        style={({ pressed }) => [styles.actionPress, (pressed || loading) && styles.actionPressed]}
      >
        <View style={styles.actionRow}>
          {icon && !loading ? <Ionicons name={icon} size={18} color={color} /> : null}
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
            {loading ? 'Verifying…' : label}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 4 },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  badgeDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
  },
  title: { textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center' },
  email: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  pillRow: { alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  pillText: { fontSize: 13, fontWeight: '600', includeFontPadding: false },
  status: { textAlign: 'center', fontSize: 14, fontWeight: '500' },
  link: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  linkMuted: { fontSize: 14 },
  linkAction: { fontSize: 14, fontWeight: '700' },
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
  actionFrameDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
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
