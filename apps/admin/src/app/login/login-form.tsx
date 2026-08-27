// apps/admin/src/app/login/login-form.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { TotpForm } from './totp-form';
import { TotpEnrollForm } from './totp-enroll-form';

type Step = 'credentials' | 'totp' | 'enroll';

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [enrollmentChallenge, setEnrollmentChallenge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        requiresTotp?: boolean;
        challengeToken?: string;
        requiresTotpEnrollment?: boolean;
        enrollmentChallenge?: string;
        code?: string;
        detail?: string;
      };
      if (!res.ok) {
        if (body.code === 'invalid_credentials') {
          throw new Error('Invalid email or password. Please try again.');
        }
        throw new Error(body.detail ?? body.code ?? 'Unable to sign in. Please try again.');
      }
      // Fresh admin without TOTP yet: enroll first, no session granted.
      if (body.requiresTotpEnrollment && body.enrollmentChallenge) {
        setEnrollmentChallenge(body.enrollmentChallenge);
        setStep('enroll');
        return;
      }
      if (body.requiresTotp && body.challengeToken) {
        setChallengeToken(body.challengeToken);
        setStep('totp');
        return;
      }
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // After enrollment the API grants NO session, so return to the password step.
  // The admin signs in again; that login then yields { requiresTotp, challengeToken }.
  function backToCredentialsAfterEnroll() {
    setEnrollmentChallenge(null);
    setChallengeToken(null);
    setPassword('');
    setError(null);
    setStep('credentials');
  }

  if (step === 'enroll' && enrollmentChallenge) {
    return (
      <TotpEnrollForm
        enrollmentChallenge={enrollmentChallenge}
        onEnrolled={backToCredentialsAfterEnroll}
      />
    );
  }

  if (step === 'totp' && challengeToken) {
    return (
      <TotpForm
        challengeToken={challengeToken}
        onCancel={() => {
          setStep('credentials');
          setChallengeToken(null);
          setError(null);
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Email Field */}
      <div className="space-y-1.5">
        <Label
          htmlFor="email"
          className="text-xs font-semibold uppercase tracking-wider text-neutral-dark/80"
        >
          Email address
        </Label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-mid/70">
            <Mail className="h-4.5 w-4.5" />
          </div>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="admin@expyrico.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            disabled={busy}
            className="flex h-12 w-full rounded-xl border-2 border-neutral-200 bg-neutral-light/30 pl-10 pr-3.5 text-base text-neutral-dark placeholder:text-neutral-mid/50 transition-all outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="password"
            className="text-xs font-semibold uppercase tracking-wider text-neutral-dark/80"
          >
            Password
          </Label>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-mid/70">
            <Lock className="h-4.5 w-4.5" />
          </div>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            disabled={busy}
            className="flex h-12 w-full rounded-xl border-2 border-neutral-200 bg-neutral-light/30 pl-10 pr-11 text-base text-neutral-dark placeholder:text-neutral-mid/50 transition-all outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-neutral-mid/70 transition-colors hover:text-neutral-dark focus:outline-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4.5 w-4.5" />
            ) : (
              <Eye className="h-4.5 w-4.5" />
            )}
          </button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="text-xs">
          {error}
        </Alert>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={busy || !email || !password}
        className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-white shadow-sm hover:bg-primary-dark transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Signing in…</span>
          </>
        ) : (
          <>
            <span>Sign in</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
