'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mergeProductsAction } from '@/lib/actions';
import { actionErrorMessage, isConflictCode } from '@/lib/action-result';
import { Search, Merge, RefreshCw, Package } from 'lucide-react';

type Candidate = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  reviewCount: number;
};

export function MergeTool({
  winnerId,
  winnerVersion,
  candidates,
  query,
}: {
  winnerId: string;
  winnerVersion: number;
  candidates: Candidate[];
  query: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(query);
  const [selected, setSelected] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const rows = useMemo(() => candidates.filter((c) => c.id !== winnerId), [candidates, winnerId]);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    router.push(`/products/${winnerId}/merge${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  }

  function runMerge() {
    if (selected.length === 0) return;
    const count = selected.length;
    if (
      !window.confirm(
        `Merge ${count} product${count > 1 ? 's' : ''} into the target? Records will be moved and source entries will point to this canonical product.`,
      )
    ) {
      return;
    }
    setErr(null);
    setConflict(false);
    startTransition(async () => {
      const res = await mergeProductsAction(winnerId, selected, winnerVersion);
      if (res.ok) {
        router.push(`/products/${winnerId}`);
        router.refresh();
        return;
      }
      setErr(actionErrorMessage(res));
      if (isConflictCode(res.code)) setConflict(true);
    });
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <form onSubmit={submitSearch} className="rounded-3xl border border-border bg-card p-6 shadow-card space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-mid">
          Search candidate products to merge
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-neutral-mid/70" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product name, brand, or barcode…"
              className="h-11 rounded-xl pl-10"
            />
          </div>
          <Button type="submit" className="h-11 rounded-xl px-5 gap-1.5 shadow-xs">
            <Search size={15} />
            <span>Search</span>
          </Button>
        </div>
      </form>

      {/* Results Selection List */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-dark">
            Candidates ({rows.length})
          </h2>
          {selected.length > 0 && (
            <span className="rounded-full bg-primary-light/50 px-2.5 py-0.5 text-xs font-bold text-primary-dark">
              {selected.length} selected for merge
            </span>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-mid border border-dashed border-neutral-200 rounded-2xl">
            {query ? 'No matching products found for this search.' : 'Search above to find duplicate items to merge.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            {rows.map((c) => {
              const isChecked = selected.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4 transition-all ${
                    isChecked
                      ? 'border-primary bg-primary-light/10 shadow-xs'
                      : 'border-neutral-200/80 bg-white hover:bg-neutral-50/70'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => toggle(c.id, e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-neutral-300 text-primary focus:ring-2 focus:ring-primary/20 accent-primary"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-neutral-dark truncate">{c.name}</p>
                      <p className="text-xs text-neutral-mid">
                        {c.brand && <span>{c.brand} · </span>}
                        {c.barcode && <span className="font-mono">barcode: {c.barcode} · </span>}
                        <span>{c.reviewCount} reviews</span>
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-neutral-mid/70 hidden sm:inline truncate max-w-[120px]">
                    {c.id}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-neutral-100">
          <Button
            size="default"
            disabled={pending || selected.length === 0}
            onClick={runMerge}
            className="h-11 rounded-xl px-6 gap-2 shadow-xs"
          >
            <Merge size={16} />
            <span>{pending ? 'Merging…' : `Merge ${selected.length} Selected into Target`}</span>
          </Button>

          {err && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-red-50 p-2.5 rounded-xl border border-red-200">
              <span>{err}</span>
              {conflict && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.refresh()}
                  className="h-7 text-xs rounded-lg"
                >
                  <RefreshCw size={12} className="mr-1" />
                  <span>Refresh</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
