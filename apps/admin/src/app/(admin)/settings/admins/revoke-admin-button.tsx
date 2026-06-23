'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { revokeAdminAction } from '@/lib/actions';

export function RevokeAdminButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function revoke() {
    if (!window.confirm('Revoke admin access for this user?')) return;
    setErr(null);
    startTransition(async () => {
      try {
        await revokeAdminAction(id);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Revoke failed');
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
