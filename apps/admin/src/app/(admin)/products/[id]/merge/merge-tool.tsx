'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mergeProductsAction } from '@/lib/actions';

type Candidate = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  reviewCount: number;
};

/**
 * Candidate-picker merge tool: the parent server component pre-fetches a page of
 * products (optionally filtered by the `q` URL param). The operator narrows with
 * the search box (a plain GET that re-runs the server fetch), ticks the loser
 * products, and confirms. The merge runs through `mergeProductsAction`
 * (audit-logged API-side), then routes back to the winner detail page.
 */
export function MergeTool({
  winnerId,
  candidates,
  query,
}: {
  winnerId: string;
  candidates: Candidate[];
  query: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(query);
  const [selected, setSelected] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // The winner can never be a loser of itself.
  const rows = useMemo(() => candidates.filter((c) => c.id !== winnerId), [candidates, winnerId]);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    router.push(`/products/${winnerId}/merge${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function runMerge() {
    if (selected.length === 0) {
      setErr('Select at least one product to merge.');
      return;
    }
    if (!window.confirm(`Merge ${selected.length} product(s) into this one? This cannot be undone.`)) {
      return;
    }
    setErr(null);
    startTransition(async () => {
      try {
        await mergeProductsAction(winnerId, selected);
        router.push(`/products/${winnerId}`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Merge failed');
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Search for duplicate products and select the losers to fold into this product. Records and
        reviews are repointed; loser products become <code>merged_into</code>.
      </p>

      <form onSubmit={submitSearch} className="flex items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Search candidates
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="name, brand, barcode"
          />
        </label>
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
      </form>

      <ul className="space-y-1">
        {rows.length === 0 && (
          <li className="rounded border p-3 text-sm text-muted-foreground">
            No candidate products. Refine your search above.
          </li>
        )}
        {rows.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded border p-2">
            <input
              type="checkbox"
              aria-label={`Select ${p.name}`}
              checked={selected.includes(p.id)}
              onChange={(e) => toggle(p.id, e.target.checked)}
            />
            <span className="flex-1">
              {p.name}{' '}
              <span className="text-xs text-muted-foreground">{p.brand ?? '—'}</span>
            </span>
            <span className="text-xs text-muted-foreground">{p.barcode ?? '—'}</span>
            <span className="text-xs">{p.reviewCount} reviews</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-end gap-3">
        {err && <span className="text-xs text-destructive">{err}</span>}
        <Button variant="destructive" size="sm" disabled={pending || selected.length === 0} onClick={runMerge}>
          {pending ? 'Merging…' : `Merge ${selected.length} into this product`}
        </Button>
      </div>
    </div>
  );
}
