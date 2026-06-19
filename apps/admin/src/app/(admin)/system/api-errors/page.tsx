import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { RangeTabs } from '@/components/range-tabs';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.system.apiErrors>>['rows'][number];

const RANGES = ['24h', '7d', '30d'] as const;
type Range = (typeof RANGES)[number];

export default async function SystemApiErrorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const range: Range = RANGES.includes(sp.range as Range) ? (sp.range as Range) : '24h';
  const { rows } = await serverAdminApi.system.apiErrors(range);

  const columns: Column<Row>[] = [
    { header: 'Method', cell: (r) => r.method },
    { header: 'Route', cell: (r) => <span className="font-mono text-xs">{r.route}</span> },
    { header: 'Status', cell: (r) => r.status },
    { header: 'Count', cell: (r) => r.count.toLocaleString(), className: 'text-right' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold text-neutral-dark font-display">API errors</h1>
      <RangeTabs basePath="/system/api-errors" active={range} ranges={[...RANGES]} />
      <DataTable data={rows} columns={columns} empty="No errors recorded in this range." />
    </div>
  );
}
