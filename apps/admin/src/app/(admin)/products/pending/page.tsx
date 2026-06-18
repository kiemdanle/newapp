import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { LoadMore } from '@/components/load-more';
import { PendingActions } from './pending-actions';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.products.pending>>['items'][number];

export default async function ProductsPendingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = { cursor: sp.cursor };
  const { items, nextCursor } = await serverAdminApi.products.pending(query);

  const columns: Column<Row>[] = [
    { header: 'Product', cell: (e) => <span className="font-mono text-xs">{e.productId}</span> },
    {
      header: 'Proposed',
      cell: (e) => (
        <pre className="max-w-md overflow-x-auto text-xs">
          {JSON.stringify(e.proposed, null, 2)}
        </pre>
      ),
    },
    { header: 'Submitted', cell: (e) => new Date(e.createdAt).toLocaleString() },
    { header: '', cell: (e) => <PendingActions id={e.id} /> },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Pending product edits</h1>
      <DataTable data={items} columns={columns} empty="No pending edits." />
      <LoadMore basePath="/products/pending" params={query} nextCursor={nextCursor} />
    </div>
  );
}
