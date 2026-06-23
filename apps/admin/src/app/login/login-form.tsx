// apps/admin/src/app/login/login-form.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json()) as {
        requiresTotp?: boolean;
        challengeToken?: string;
        requiresTotpEnrollment?: boolean;
        enrollmentChallenge?: string;
        code?: string;
        detail?: string;
      };
      if (!res.ok) {
        throw new Error(body.detail ?? body.code ?? 'login_failed');
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
    return <TotpForm challengeToken={challengeToken} />;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
