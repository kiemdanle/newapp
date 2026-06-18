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
    <div className="flex gap-1">
      {ranges.map((r) => (
        <Link
          key={r}
          href={`${basePath}?range=${r}`}
          className={cn(
            'rounded-md border px-3 py-1 text-sm',
            r === active
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-foreground hover:bg-muted',
          )}
        >
          {r}
        </Link>
      ))}
    </div>
  );
}
