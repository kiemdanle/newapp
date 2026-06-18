'use client';
import { useState, useTransition } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';

/**
 * Submits a server action behind a confirmation prompt. Used for destructive or
 * state-changing admin operations (suspend user, hide review, resolve report,
 * merge products). The action runs in a transition so the row reflects pending
 * state; on rejection the native confirm() simply cancels.
 */
export function ConfirmButton({
  action,
  confirm,
  children,
  variant = 'outline',
  size = 'sm',
}: {
  action: () => Promise<void>;
  confirm: string;
  children: React.ReactNode;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(confirm)) return;
          setErr(null);
          startTransition(async () => {
            try {
              await action();
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Action failed');
            }
          });
        }}
      >
        {pending ? 'Working…' : children}
      </Button>
      {err && <span className="text-xs text-destructive mt-1">{err}</span>}
    </span>
  );
}
