'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveFeatureFlagsAction, saveProductCreationAction } from '@/lib/actions';
import type { ProductCreationSettings } from '@expyrico/shared';
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
export function FlagsForm({
  initial,
  initialProductCreation,
}: {
  initial: Flags;
  initialProductCreation?: ProductCreationSettings;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flags, setFlags] = useState<Flags>(initial);
  const [mode, setMode] = useState<'off' | 'internal' | 'all'>(initialProductCreation?.mode ?? 'all');
  const [requireApproval, setRequireApproval] = useState<boolean>(initialProductCreation?.requireApproval ?? false);
  const toggle = (k: keyof Flags) => () =>
    setFlags((f) => ({ ...f, [k]: !f[k as 'reviewsEnabled'] }));

  function save() {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      try {
        await Promise.all([
          saveFeatureFlagsAction({
            reviewsEnabled: flags.reviewsEnabled,
            passkeysEnabled: flags.passkeysEnabled,
            ocrEnabled: flags.ocrEnabled,
            maintenanceBanner: flags.maintenanceBanner?.trim() ? flags.maintenanceBanner.trim() : null,
          }),
          saveProductCreationAction({ mode, requireApproval }),
        ]);
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

      {/* Product Creation Gate Mode */}
      <div className="space-y-3 rounded-lg border p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Community Product Creation Mode</h3>
          <p className="text-xs text-muted-foreground">
            Controls whether users scanning uncatalogued barcodes can create new products for the catalog.
          </p>
        </div>
        <div className="space-y-2 pt-1">
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <input
              type="radio"
              name="product_creation_mode"
              value="all"
              checked={mode === 'all'}
              onChange={() => setMode('all')}
              className="h-4 w-4 text-primary"
            />
            <div>
              <span className="font-medium">All users (Enabled - Recommended)</span>
              <p className="text-xs text-muted-foreground">Any user can create new products when scanning an uncatalogued item.</p>
            </div>
          </label>
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <input
              type="radio"
              name="product_creation_mode"
              value="internal"
              checked={mode === 'internal'}
              onChange={() => setMode('internal')}
              className="h-4 w-4 text-primary"
            />
            <div>
              <span className="font-medium">Internal / Admins only</span>
              <p className="text-xs text-muted-foreground">Only admin users and internal allowlist can submit new products.</p>
            </div>
          </label>
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <input
              type="radio"
              name="product_creation_mode"
              value="off"
              checked={mode === 'off'}
              onChange={() => setMode('off')}
              className="h-4 w-4 text-primary"
            />
            <div>
              <span className="font-medium">Disabled (Off)</span>
              <p className="text-xs text-muted-foreground">No one can create new products; users can only save custom pantry items.</p>
            </div>
          </label>
        </div>
      </div>

      {/* Product Approval Policy */}
      <div className="space-y-3 rounded-lg border p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Community Product Approval Policy</h3>
          <p className="text-xs text-muted-foreground">
            Controls whether newly added community products require administrative review before becoming active in the catalog.
          </p>
        </div>
        <div className="space-y-2 pt-1">
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <input
              type="radio"
              name="require_approval"
              checked={!requireApproval}
              onChange={() => setRequireApproval(false)}
              className="h-4 w-4 text-primary"
            />
            <div>
              <span className="font-medium">Auto-Approve (Approval Disabled - Default)</span>
              <p className="text-xs text-muted-foreground">
                Newly created products are active and immediately visible in the catalog without waiting in moderation.
              </p>
            </div>
          </label>
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <input
              type="radio"
              name="require_approval"
              checked={requireApproval}
              onChange={() => setRequireApproval(true)}
              className="h-4 w-4 text-primary"
            />
            <div>
              <span className="font-medium">Require Approval (Approval Enabled)</span>
              <p className="text-xs text-muted-foreground">
                All newly created community products are held in the moderation queue until an admin reviews them.
              </p>
            </div>
          </label>
        </div>
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
