'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveFeatureFlagsAction } from '@/lib/actions';

type Flags = {
  reviewsEnabled: boolean;
  passkeysEnabled: boolean;
  ocrEnabled: boolean;
  maintenanceBanner: string | null;
};

/**
 * Feature-flag editor. Toggles each boolean flag plus an optional maintenance
 * banner string, then persists via the save server action (audit-logged
 * API-side). Empty banner is sent as null.
 */
export function FlagsForm({ initial }: { initial: Flags }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flags, setFlags] = useState<Flags>(initial);

  const toggle = (k: keyof Flags) => () =>
    setFlags((f) => ({ ...f, [k]: !f[k as 'reviewsEnabled'] }));

  function save() {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      try {
        await saveFeatureFlagsAction({
          reviewsEnabled: flags.reviewsEnabled,
          passkeysEnabled: flags.passkeysEnabled,
          ocrEnabled: flags.ocrEnabled,
          maintenanceBanner: flags.maintenanceBanner?.trim() ? flags.maintenanceBanner.trim() : null,
        });
        setMsg('Saved.');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Save failed');
      }
    });
  }

  const rows: { key: keyof Flags; label: string }[] = [
    { key: 'reviewsEnabled', label: 'Reviews enabled' },
    { key: 'passkeysEnabled', label: 'Passkeys enabled' },
    { key: 'ocrEnabled', label: 'OCR enabled' },
  ];

  return (
    <div className="max-w-lg space-y-4">
      <div className="space-y-2 rounded-lg border p-4">
        {rows.map((r) => (
          <label key={r.key} className="flex items-center justify-between gap-4 py-1 text-sm">
            <span>{r.label}</span>
            <input
              type="checkbox"
              checked={flags[r.key] as boolean}
              onChange={toggle(r.key)}
              className="h-4 w-4"
            />
          </label>
        ))}
        <label className="block pt-2 text-xs text-muted-foreground">
          Maintenance banner (blank to disable)
          <Input
            value={flags.maintenanceBanner ?? ''}
            onChange={(e) => setFlags({ ...flags, maintenanceBanner: e.target.value })}
            placeholder="e.g. Scheduled maintenance at 02:00 UTC"
            className="mt-1"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? 'Saving…' : 'Save flags'}
        </Button>
        {msg && <span className="text-xs text-foreground">{msg}</span>}
        {err && <span className="text-xs text-destructive">{err}</span>}
      </div>
    </div>
  );
}
