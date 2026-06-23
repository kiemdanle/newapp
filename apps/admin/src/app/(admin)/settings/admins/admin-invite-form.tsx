'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { inviteAdminAction } from '@/lib/actions';

export function AdminInviteForm() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '' });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      try {
        await inviteAdminAction({
          email: form.email.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
        });
        setForm({ email: '', firstName: '', lastName: '' });
        setMsg('Invited.');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Invite failed');
      }
    });
  }

  return (
    <form onSubmit={submit} className="max-w-lg space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium">Invite admin</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-muted-foreground">
          Email
          <Input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          First name
          <Input
            required
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="mt-1"
          />
        </label>
      </div>
      <label className="block text-xs text-muted-foreground">
        Last name
        <Input
          required
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          className="mt-1"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Inviting…' : 'Invite admin'}
        </Button>
        {msg && <span className="text-xs text-foreground">{msg}</span>}
        {err && <span className="text-xs text-destructive">{err}</span>}
      </div>
    </form>
  );
}
