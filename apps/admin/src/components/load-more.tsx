import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

/**
 * Cursor pagination control. Builds a link to the same page with the next
 * cursor appended, preserving existing filters. Server-rendered — no client JS.
 */
export function LoadMore({
  basePath,
  params,
  nextCursor,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  nextCursor: string | null;
}) {
  if (!nextCursor) return null;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && k !== 'cursor') sp.set(k, v);
  }
  sp.set('cursor', nextCursor);
  return (
    <div className="flex justify-center pt-6 pb-2">
      <Button
        asChild
        variant="outline"
        className="h-10 px-5 rounded-xl border-neutral-300 bg-white text-sm font-semibold text-neutral-dark shadow-xs hover:border-primary hover:text-primary hover:bg-primary-light/10 transition-all gap-2"
      >
        <Link href={`${basePath}?${sp.toString()}`}>
          <span>Load more records</span>
          <ChevronDown size={16} />
        </Link>
      </Button>
    </div>
  );
}
