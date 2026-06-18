'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { patchProductAction } from '@/lib/actions';

/**
 * Client controls for the product-detail page: inline edit of the core fields,
 * plus a link to the dedicated merge tool at /products/[id]/merge. The edit
 * control drives a server action (audit-logged API-side) in a transition.
 */
export function ProductActions({
  id,
  name,
  brand,
  category,
}: {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ name, brand: brand ?? '', category: category ?? '' });

  function run(fn: () => Promise<void>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      try {
        await fn();
        setMsg('Saved.');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Action failed');
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Edit details</h2>
        <label className="block text-xs text-muted-foreground">
          Name
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          Brand
          <Input
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
            className="mt-1"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          Category
          <Input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="mt-1"
          />
        </label>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() =>
              patchProductAction(id, {
                name: form.name,
                brand: form.brand || null,
                category: form.category || null,
              }),
            )
          }
        >
          Save changes
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Merge duplicates</h2>
        <p className="text-xs text-muted-foreground">
          Search for duplicate products and fold them into this one. Records and reviews are
          repointed; loser products become <code>merged_into</code>.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/products/${id}/merge`}>Open merge tool</Link>
        </Button>
      </div>

      {pending && <p className="text-xs text-muted-foreground">Working…</p>}
      {msg && <p className="text-xs text-foreground">{msg}</p>}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
