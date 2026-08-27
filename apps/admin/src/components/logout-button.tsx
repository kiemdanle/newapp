// apps/admin/src/components/logout-button.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      router.replace('/login');
      router.refresh();
    } catch {
      router.replace('/login');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onLogout}
      disabled={busy}
      className="h-8 gap-1.5 px-2 text-xs text-neutral-mid hover:text-neutral-dark"
      title="Sign out of admin dashboard"
    >
      <LogOut className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  );
}
