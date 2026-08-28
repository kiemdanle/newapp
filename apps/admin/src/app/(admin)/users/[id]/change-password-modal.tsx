'use client';

import { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { changeUserPasswordAction } from '@/lib/actions';
import { actionErrorMessage } from '@/lib/action-result';
import { KeyRound, Eye, EyeOff, AlertTriangle, X } from 'lucide-react';

interface ChangePasswordModalProps {
  userId: string;
  userEmail: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function ChangePasswordModal({
  userId,
  userEmail,
  isOpen,
  onClose,
  onSuccess,
}: ChangePasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setErr(null);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !pending) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pending, onClose]);

  if (!isOpen) return null;

  const isTooShort = password.length > 0 && password.length < 10;
  const isMismatched = confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit = password.length >= 10 && password === confirmPassword && !pending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setErr(null);
    startTransition(async () => {
      try {
        const res = await changeUserPasswordAction(userId, { password });
        if (!res.ok) {
          setErr(actionErrorMessage(res));
          return;
        }
        onSuccess(res.data.message || 'Password changed successfully.');
        onClose();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to update password');
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-light/60 text-primary-dark">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 id="change-password-modal-title" className="text-base font-bold text-neutral-dark font-display">Set User Password</h2>
              <p className="text-xs text-neutral-mid font-mono truncate max-w-[260px]">{userEmail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg p-1 text-muted-foreground hover:bg-neutral-light hover:text-foreground transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Security Warning */}
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200/80 p-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <span>
            Setting a new password will immediately revoke all active sessions and trusted devices for this user.
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">
              New Password
              <div className="relative mt-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  placeholder="Min 10 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9 font-mono text-sm"
                  disabled={pending}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            {isTooShort && (
              <p className="text-[11px] text-amber-600 font-medium">Password must be at least 10 characters.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">
              Confirm New Password
              <Input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 font-mono text-sm"
                disabled={pending}
              />
            </label>
            {isMismatched && (
              <p className="text-[11px] text-destructive font-medium">Passwords do not match.</p>
            )}
          </div>

          {err && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
              {err}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit}
            >
              {pending ? 'Updating…' : 'Update Password'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
