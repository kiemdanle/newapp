'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { resetUser2faAction } from '@/lib/actions';
import { actionErrorMessage } from '@/lib/action-result';
import { ShieldAlert } from 'lucide-react';

export function ResetAdmin2faButton({ id, email }: { id: string; email: string }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    const confirmed = window.confirm(
      `Reset 2FA for ${email}?\n\nThis will:\n• Clear the current authenticator secret and purge recovery codes.\n• Revoke all active sessions and trusted devices immediately.\n• Require the admin to scan a new QR code upon next login.`,
    );
    if (!confirmed) return;

    setErr(null);
    startTransition(async () => {
      try {
        const res = await resetUser2faAction(id, { confirmSelfReset: true });
        if (!res.ok) {
          setErr(actionErrorMessage(res));
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : '2FA reset failed');
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={reset}
        className="border-amber-300 text-amber-900 hover:bg-amber-50"
      >
        <ShieldAlert className="mr-1 h-3.5 w-3.5 text-amber-600" />
        <span>{pending ? 'Resetting…' : 'Reset 2FA'}</span>
      </Button>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
}
