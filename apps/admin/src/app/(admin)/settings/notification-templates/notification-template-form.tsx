'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { patchNotificationTemplateAction } from '@/lib/actions';

type Template = {
  id: string;
  key: string;
  title: string;
  body: string;
  enabled: boolean;
};

export function NotificationTemplateForm({ template }: { template: Template }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState(template);

  function save() {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      try {
        await patchNotificationTemplateAction(form.id, {
          title: form.title.trim(),
          body: form.body.trim(),
          enabled: form.enabled,
        });
        setMsg('Saved.');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Save failed');
      }
    });
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">{form.key}</span>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="h-4 w-4"
          />
          Enabled
        </label>
      </div>
      <label className="block text-xs text-muted-foreground">
        Title
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="mt-1"
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        Body
        <Input
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          className="mt-1"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? 'Saving…' : 'Save template'}
        </Button>
        {msg && <span className="text-xs text-foreground">{msg}</span>}
        {err && <span className="text-xs text-destructive">{err}</span>}
      </div>
    </div>
  );
}
