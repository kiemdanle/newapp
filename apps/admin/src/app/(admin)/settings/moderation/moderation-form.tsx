'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveModerationAction } from '@/lib/actions';

type Moderation = {
  autoHideReportThreshold: number;
  profanitySensitivity: 'low' | 'medium' | 'high';
};

/**
 * Moderation settings editor: the report count that auto-hides content and the
 * profanity-filter sensitivity. Persists via the save server action
 * (audit-logged API-side).
 */
export function ModerationForm({ initial }: { initial: Moderation }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<Moderation>(initial);

  function save() {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      try {
        await saveModerationAction({
          autoHideReportThreshold: form.autoHideReportThreshold,
          profanitySensitivity: form.profanitySensitivity,
        });
        setMsg('Saved.');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Save failed');
      }
    });
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="space-y-3 rounded-lg border p-4">
        <label className="block text-xs text-muted-foreground">
          Auto-hide report threshold
          <Input
            type="number"
            min={1}
            max={100}
            value={form.autoHideReportThreshold}
            onChange={(e) =>
              setForm({ ...form, autoHideReportThreshold: Number(e.target.value) })
            }
            className="mt-1"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          Profanity sensitivity
          <select
            value={form.profanitySensitivity}
            onChange={(e) =>
              setForm({
                ...form,
                profanitySensitivity: e.target.value as 'low' | 'medium' | 'high',
              })
            }
            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? 'Saving…' : 'Save settings'}
        </Button>
        {msg && <span className="text-xs text-foreground">{msg}</span>}
        {err && <span className="text-xs text-destructive">{err}</span>}
      </div>
    </div>
  );
}
