// apps/admin/src/app/login/totp-form.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { OtpInput } from '@/components/ui/otp-input';

export interface TotpFormProps {
  challengeToken: string;
  onCancel?: () => void;
}

export function TotpForm({ challengeToken, onCancel }: TotpFormProps) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleVerify(verificationCode: string) {
    if (verificationCode.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/totp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challengeToken, code: verificationCode, trustDevice }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string; detail?: string };
        if (body.code === 'invalid_totp_code') {
          throw new Error('Invalid code. Please check your authenticator app and try again.');
        }
        throw new Error(body.detail || body.code || 'Verification failed');
      }
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await handleVerify(code);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Header with Security Badge */}
      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-neutral-dark">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-xs">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-neutral-dark">Two-Factor Authentication</h2>
          <p className="text-xs text-neutral-mid">Enter the 6-digit code from your authenticator app</p>
        </div>
      </div>

      {/* 6-Digit Segmented Code Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="otp-input" className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
            Security Code
          </Label>
          <span className="text-xs text-neutral-mid/70 font-mono">6 digits</span>
        </div>

        <OtpInput
          value={code}
          onChange={(val) => {
            setCode(val);
            if (error) setError(null);
          }}
          onComplete={(val) => {
            handleVerify(val);
          }}
          disabled={busy}
          hasError={Boolean(error)}
          autoFocus
        />
      </div>

      {/* Trust this device option */}
      <label
        htmlFor="trust-device"
        className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-300/80 bg-neutral-light/30 p-3 transition-colors hover:bg-neutral-light/60"
      >
        <input
          id="trust-device"
          type="checkbox"
          checked={trustDevice}
          onChange={(e) => setTrustDevice(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary focus:ring-2 focus:ring-primary/20 accent-primary"
        />
        <div className="grid gap-0.5 leading-none">
          <span className="text-sm font-medium text-neutral-dark select-none">
            Trust this device for 60 days
          </span>
          <span className="text-xs text-neutral-mid select-none leading-relaxed">
            Skip 2FA verification when signing in on this browser for the next 60 days.
          </span>
        </div>
      </label>

      {error && (
        <Alert variant="destructive" className="text-xs">
          {error}
        </Alert>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={busy || code.length !== 6}
        className="h-11 w-full rounded-xl bg-primary text-base font-semibold text-white shadow-sm hover:bg-primary-dark transition-all active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Verifying…</span>
          </span>
        ) : (
          'Verify & Continue'
        )}
      </Button>

      {/* Back button if cancelable */}
      {onCancel && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={busy}
          className="w-full text-xs text-neutral-mid hover:text-neutral-dark"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          <span>Back to email and password</span>
        </Button>
      )}
    </form>
  );
}
