'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { revokeTrustedDeviceAction } from '@/lib/actions';

export function RevokeDeviceButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function revoke() {
    if (!window.confirm('Forget and revoke this trusted device?')) return;
    setErr(null);
    startTransition(async () => {
      try {
        await revokeTrustedDeviceAction(id);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Revocation failed');
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={revoke}>
        {pending ? 'Revoking…' : 'Revoke'}
      </Button>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
}
