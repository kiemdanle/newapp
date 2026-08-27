import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Range selector for analytics pages. Server-rendered links that set the
 * `range` query param; the active range is highlighted.
 */
export function RangeTabs({
  basePath,
  active,
  ranges = ['7d', '30d', '90d'],
}: {
  basePath: string;
  active: string;
  ranges?: string[];
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-neutral-light/50 p-1 shadow-2xs">
      {ranges.map((r) => {
        const isSelected = r === active;
        return (
          <Link
            key={r}
            href={`${basePath}?range=${r}`}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all select-none',
              isSelected
                ? 'bg-white text-primary-dark shadow-xs border border-neutral-200/80'
                : 'text-neutral-mid hover:text-neutral-dark hover:bg-neutral-200/40',
            )}
          >
            {r}
          </Link>
        );
      })}
    </div>
  );
}
