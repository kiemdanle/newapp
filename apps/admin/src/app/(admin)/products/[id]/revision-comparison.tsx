import { resolveAdminPhotoUrl } from '@/lib/admin-media';
import { Sparkles, Layers, Image as ImageIcon } from 'lucide-react';

interface LiveProductView {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  defaultShelfLifeDays?: number | null | undefined;
  photos: { id: string; thumbnailUrl: string; displayUrl: string }[];
}

interface RevisionView {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  defaultShelfLifeDays?: number | null | undefined;
  notes?: string | null | undefined;
  photos: {
    id: string;
    sourceProductPhotoId?: string | null | undefined;
    retained: boolean;
    thumbnailUrl: string;
    displayUrl: string;
  }[];
}

function formatShelfLife(days: number | null | undefined): string {
  return typeof days === 'number' && days > 0 ? `${days} days` : '—';
}

function FieldRow({ label, live, proposed }: { label: string; live: string; proposed: string }) {
  const changed = live !== proposed;
  return (
    <tr className={`border-b border-neutral-100 transition-colors ${changed ? 'bg-amber-50/50' : 'hover:bg-neutral-50/50'}`}>
      <td className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-neutral-mid font-body">
        {label}
      </td>
      <td className="py-3 px-4 text-sm text-neutral-dark font-medium">
        {live}
      </td>
      <td className="py-3 px-4 text-sm text-neutral-dark font-medium">
        <div className="flex items-center gap-2">
          <span>{proposed}</span>
          {changed && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              Changed
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

export function RevisionComparison({ live, revision }: { live: LiveProductView; revision: RevisionView }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-card space-y-6">
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-neutral-dark font-display">
          Metadata & Photos Comparison
        </h2>
      </div>

      {revision.notes && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
            <Sparkles size={14} className="text-amber-600" />
            <span>Submitter Revision Notes</span>
          </div>
          <p className="mt-1 text-sm text-neutral-dark whitespace-pre-wrap break-words leading-relaxed">
            {revision.notes}
          </p>
        </div>
      )}

      {/* Comparison Table */}
      <div className="rounded-2xl border border-border overflow-hidden bg-white shadow-2xs">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-neutral-light/50 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-mid select-none">
              <th className="py-3 px-4 w-1/4">Field</th>
              <th className="py-3 px-4 w-3/8">Live Catalog State</th>
              <th className="py-3 px-4 w-3/8">Proposed Revision State</th>
            </tr>
          </thead>
          <tbody>
            <FieldRow label="Name" live={live.name} proposed={revision.name} />
            <FieldRow label="Brand" live={live.brand ?? '—'} proposed={revision.brand ?? '—'} />
            <FieldRow label="Category" live={live.category ?? '—'} proposed={revision.category ?? '—'} />
            <FieldRow label="Description" live={live.description ?? '—'} proposed={revision.description ?? '—'} />
            <FieldRow
              label="Shelf Life"
              live={formatShelfLife(live.defaultShelfLifeDays)}
              proposed={formatShelfLife(revision.defaultShelfLifeDays)}
            />
          </tbody>
        </table>
      </div>

      {/* Photos Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Live Photos */}
        <div className="rounded-2xl border border-border bg-neutral-light/30 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-mid flex items-center gap-1.5">
              <ImageIcon size={14} />
              <span>Live Photos ({live.photos.length})</span>
            </h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {live.photos.length === 0 && <p className="text-xs text-neutral-mid">No photos in live catalog.</p>}
            {live.photos.map((p) => {
              const isRetained = revision.photos.some((rp) => rp.retained && (rp.sourceProductPhotoId === p.id || rp.id === p.id));
              return (
                <div key={p.id} className="relative h-20 w-20 rounded-xl overflow-hidden border border-neutral-200 shadow-2xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveAdminPhotoUrl('product', live.id, p, 'thumb')}
                    alt=""
                    className={`h-full w-full object-cover transition-opacity ${!isRetained && revision.photos.length > 0 ? 'opacity-40 grayscale' : ''}`}
                  />
                  <span
                    className={`absolute bottom-1 left-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs ${
                      isRetained ? 'bg-neutral-dark/90' : 'bg-destructive'
                    }`}
                  >
                    {isRetained ? 'Retained' : 'Removed'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Proposed Photos */}
        <div className="rounded-2xl border border-primary/30 bg-primary-light/10 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary-dark flex items-center gap-1.5">
              <Sparkles size={14} />
              <span>Proposed Photo Set ({revision.photos.length})</span>
            </h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {revision.photos.length === 0 && <p className="text-xs text-neutral-mid">No photos submitted in revision.</p>}
            {revision.photos.map((p, idx) => (
              <div key={p.id} className="relative h-20 w-20 rounded-xl overflow-hidden border-2 border-primary/40 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveAdminPhotoUrl(p.retained ? 'product' : 'edit', p.retained ? live.id : revision.id, p, 'thumb')}
                  alt={p.retained ? 'Retained live photo' : 'Newly staged photo'}
                  title={p.retained ? 'Retained live photo' : 'Newly staged photo'}
                  className="h-full w-full object-cover"
                />
                <span
                  className={`absolute bottom-1 left-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs ${
                    p.retained ? 'bg-neutral-dark/90' : 'bg-primary-dark'
                  }`}
                >
                  {idx === 0 ? (p.retained ? 'Cover (Retained)' : 'Cover (New)') : p.retained ? 'Retained' : 'New'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
