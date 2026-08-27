// apps/admin/src/app/login/totp-form.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

export function TotpForm({ challengeToken }: { challengeToken: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/totp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challengeToken, code, trustDevice }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        throw new Error(body.code ?? 'totp_failed');
      }
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code">Authenticator code</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </div>

      <div className="flex items-start space-x-2 pt-1">
        <input
          id="trust-device"
          type="checkbox"
          checked={trustDevice}
          onChange={(e) => setTrustDevice(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        <div className="grid gap-0.5 leading-none">
          <Label htmlFor="trust-device" className="cursor-pointer text-sm font-medium">
            Trust this device for 60 days
          </Label>
          <p className="text-xs text-neutral-mid">
            Skip 2FA verification when signing in on this browser for the next 60 days.
          </p>
        </div>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      <Button type="submit" disabled={busy || code.length !== 6} className="w-full">
        {busy ? 'Verifying…' : 'Verify'}
      </Button>
    </form>
  );
}
