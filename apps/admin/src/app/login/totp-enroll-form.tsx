// apps/admin/src/app/login/totp-enroll-form.tsx
'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

interface EnrollPayload {
  secret: string;
  qrCodeDataUrl: string;
  recoveryCodes: string[];
}

export function TotpEnrollForm({
  enrollmentChallenge,
  onEnrolled,
}: {
  enrollmentChallenge: string;
  onEnrolled: () => void;
}) {
  const [enroll, setEnroll] = useState<EnrollPayload | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  // Start enrollment on mount: fetch secret/QR/recovery codes (shown once).
  // Guarded so React Strict Mode's double effect invocation only enrolls once.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/totp/enroll', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ enrollmentChallenge }),
        });
        const body = (await res.json()) as EnrollPayload & { code?: string };
        if (!res.ok) throw new Error(body.code ?? 'enroll_failed');
        if (!cancelled) setEnroll(body);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enrollmentChallenge]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/totp/verify-enrollment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enrollmentChallenge, code }),
      });
      // Success is 204 empty; no session is granted — the admin must re-login.
      if (res.status === 204) {
        setDone(true);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { code?: string };
      throw new Error(body.code ?? 'verify_enrollment_failed');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert>TOTP enabled — please sign in again.</Alert>
        <Button type="button" className="w-full" onClick={onEnrolled}>
          Back to sign in
        </Button>
      </div>
    );
  }

  if (error && !enroll) {
    return <Alert variant="destructive">{error}</Alert>;
  }

  if (!enroll) {
    return <p className="text-sm text-muted-foreground">Preparing enrollment…</p>;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">1. Scan this QR code in your authenticator app</p>
        <Image
          src={enroll.qrCodeDataUrl}
          alt="TOTP enrollment QR code"
          width={192}
          height={192}
          unoptimized
          className="rounded border"
        />
        <p className="break-all text-xs text-muted-foreground">
          Manual key: <code>{enroll.secret}</code>
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">2. Save your recovery codes</p>
        <Alert variant="destructive">
          Save these now — they are shown only once and will not be displayed again.
        </Alert>
        <ul className="grid grid-cols-2 gap-1 rounded border bg-muted p-3 font-mono text-xs">
          {enroll.recoveryCodes.map((rc) => (
            <li key={rc}>{rc}</li>
          ))}
        </ul>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm font-medium">3. Enter the 6-digit code to confirm</p>
        <div className="space-y-2">
          <Label htmlFor="enroll-code">Authenticator code</Label>
          <Input
            id="enroll-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        {error && <Alert variant="destructive">{error}</Alert>}
        <Button type="submit" disabled={busy || code.length !== 6} className="w-full">
          {busy ? 'Confirming…' : 'Confirm enrollment'}
        </Button>
      </form>
    </div>
  );
}
