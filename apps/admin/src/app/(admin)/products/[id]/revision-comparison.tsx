import { resolveAdminPhotoUrl } from '@/lib/admin-media';

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
    <tr className={changed ? 'bg-accent-light/40' : undefined}>
      <td className="py-1 pr-3 text-xs font-medium text-neutral-mid">{label}</td>
      <td className="py-1 pr-3 text-sm">{live}</td>
      <td className="py-1 text-sm font-medium">{proposed}</td>
    </tr>
  );
}

/**
 * Before/after comparison for a single revision: live metadata vs proposed, and
 * the complete desired photo order side by side. Every photo renders through the
 * same-origin proxy resolver — an approved/retained photo's URL is already an
 * absolute public CDN URL and passes through unchanged; anything else (a staged
 * or not-yet-approved live photo) is routed through `/api/admin-product-media/...`.
 */
export function RevisionComparison({ live, revision }: { live: LiveProductView; revision: RevisionView }) {
  return (
    <div className="space-y-4">
      {revision.notes && (
        <div className="rounded-lg border border-accent/30 bg-accent-light/20 p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-dark">
            <span>💡 Submitter Reason / Notes</span>
          </div>
          <p className="mt-1 text-sm text-neutral-dark whitespace-pre-wrap break-words">{revision.notes}</p>
        </div>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-xs text-neutral-mid">
            <th className="py-1 pr-3 font-medium">Field</th>
            <th className="py-1 pr-3 font-medium">Live</th>
            <th className="py-1 font-medium">Proposed</th>
          </tr>
        </thead>
        <tbody>
          <FieldRow label="Name" live={live.name} proposed={revision.name} />
          <FieldRow label="Brand" live={live.brand ?? '—'} proposed={revision.brand ?? '—'} />
          <FieldRow label="Category" live={live.category ?? '—'} proposed={revision.category ?? '—'} />
          <FieldRow label="Description" live={live.description ?? '—'} proposed={revision.description ?? '—'} />
          <FieldRow
            label="Default shelf life"
            live={formatShelfLife(live.defaultShelfLifeDays)}
            proposed={formatShelfLife(revision.defaultShelfLifeDays)}
          />
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="mb-2 text-xs font-semibold text-neutral-mid">Live photos ({live.photos.length})</h3>
          <div className="flex flex-wrap gap-2">
            {live.photos.length === 0 && <p className="text-xs text-muted-foreground">No photos.</p>}
            {live.photos.map((p) => {
              const isRetained = revision.photos.some((rp) => rp.retained && (rp.sourceProductPhotoId === p.id || rp.id === p.id));
              return (
                <div key={p.id} className="relative h-16 w-16">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveAdminPhotoUrl('product', live.id, p, 'thumb')}
                    alt=""
                    className={`h-16 w-16 rounded border object-cover ${!isRetained && revision.photos.length > 0 ? 'opacity-60' : ''}`}
                  />
                  <span
                    className={`absolute bottom-0.5 left-0.5 rounded px-1 py-0.2 text-[9px] font-semibold text-white ${
                      isRetained ? 'bg-neutral-dark/80' : 'bg-destructive/90'
                    }`}
                  >
                    {isRetained ? 'Retained' : 'Removed'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold text-neutral-mid">Proposed photos ({revision.photos.length})</h3>
          <div className="flex flex-wrap gap-2">
            {revision.photos.length === 0 && <p className="text-xs text-muted-foreground">No photos.</p>}
            {revision.photos.map((p, idx) => (
              <div key={p.id} className="relative h-16 w-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveAdminPhotoUrl(p.retained ? 'product' : 'edit', p.retained ? live.id : revision.id, p, 'thumb')}
                  alt={p.retained ? 'Retained live photo' : 'Newly staged photo'}
                  title={p.retained ? 'Retained live photo' : 'Newly staged photo'}
                  className="h-16 w-16 rounded border object-cover"
                />
                <span
                  className={`absolute bottom-0.5 left-0.5 rounded px-1 py-0.2 text-[9px] font-semibold text-white ${
                    p.retained ? 'bg-neutral-dark/80' : 'bg-primary-dark'
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
