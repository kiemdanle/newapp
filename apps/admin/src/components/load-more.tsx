import Link from 'next/link';
import { Button } from '@/components/ui/button';

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
    <div className="flex justify-center pt-4">
      <Button asChild variant="outline">
        <Link href={`${basePath}?${sp.toString()}`}>Load more</Link>
      </Button>
    </div>
  );
}
