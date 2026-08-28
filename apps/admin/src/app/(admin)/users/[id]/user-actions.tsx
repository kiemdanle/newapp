'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  patchUserAction,
  revokeUserSessionsAction,
  impersonateUserAction,
  resetUser2faAction,
} from '@/lib/actions';
import { actionErrorMessage } from '@/lib/action-result';
import { ShieldAlert } from 'lucide-react';

/**
 * Client controls for the user-detail page. Each button drives a server action
 * (which audit-logs on the API side) inside a transition so the row reflects
 * pending state. Impersonation surfaces the short-lived access token returned
 * by the API so an admin can copy it for support debugging.
 */
export function UserActions({
  id,
  status,
  role,
  totpEnabledAt,
}: {
  id: string;
  status: 'active' | 'suspended' | 'deleted';
  role: 'user' | 'admin';
  totpEnabledAt?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function run(fn: () => Promise<void>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      try {
        await fn();
        setMsg('Done.');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Action failed');
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status !== 'suspended' && (
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() => patchUserAction(id, { status: 'suspended' }), 'Suspend this user?')
            }
          >
            Suspend
          </Button>
        )}
        {status === 'suspended' && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => patchUserAction(id, { status: 'active' }))}
          >
            Reactivate
          </Button>
        )}
        {role === 'user' ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => patchUserAction(id, { role: 'admin' }), 'Promote to admin?')}
          >
            Promote to admin
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => patchUserAction(id, { role: 'user' }), 'Demote to user?')}
          >
            Demote to user
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => revokeUserSessionsAction(id), 'Revoke all sessions for this user?')
          }
        >
          Revoke sessions
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const { accessToken } = await impersonateUserAction(id);
              setMsg(`Impersonation token: ${accessToken}`);
            }, 'Generate an impersonation token for this user?')
          }
        >
          Impersonate
        </Button>
        {totpEnabledAt && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(
                async () => {
                  const res = await resetUser2faAction(id, { confirmSelfReset: true });
                  if (!res.ok) {
                    throw new Error(actionErrorMessage(res));
                  }
                  setMsg('Two-factor authentication has been reset. User will re-enroll on next login.');
                },
                'Reset 2FA for this account?\n\nThis will:\n• Clear the current authenticator secret and purge all recovery codes.\n• Revoke all active sessions and trusted devices immediately.\n• Require the user to scan a new QR code upon next login.',
              )
            }
            className="border-amber-300 text-amber-900 hover:bg-amber-50"
          >
            <ShieldAlert className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
            <span>Reset 2FA</span>
          </Button>
        )}
      </div>
      {pending && <p className="text-xs text-muted-foreground">Working…</p>}
      {msg && <p className="break-all text-xs text-foreground">{msg}</p>}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
