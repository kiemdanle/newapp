import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { RangeTabs } from '@/components/range-tabs';
import { AlertTriangle } from 'lucide-react';

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
    {
      header: 'HTTP Method',
      cell: (r) => {
        const m = r.method.toUpperCase();
        return (
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-bold ${
              m === 'GET'
                ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                : m === 'POST'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                  : m === 'PATCH' || m === 'PUT'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                    : 'bg-red-50 text-red-700 border border-red-200/80'
            }`}
          >
            {m}
          </span>
        );
      },
    },
    {
      header: 'Endpoint Route',
      cell: (r) => (
        <span className="font-mono text-xs font-medium text-neutral-dark">
          {r.route}
        </span>
      ),
    },
    {
      header: 'HTTP Status',
      cell: (r) => (
        <span
          className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
            r.status >= 500
              ? 'bg-red-50 text-red-700 border border-red-200/80'
              : 'bg-amber-50 text-amber-700 border border-amber-200/80'
          }`}
        >
          {r.status}
        </span>
      ),
    },
    {
      header: 'Error Frequency',
      cell: (r) => (
        <span className="font-mono text-xs font-bold text-neutral-dark">
          {r.count.toLocaleString()} <span className="font-normal text-neutral-mid">occurrences</span>
        </span>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header & Range Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <AlertTriangle size={14} />
            <span>Diagnostics</span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
            API Error Diagnostics
          </h1>
          <p className="text-sm text-neutral-mid mt-0.5">
            Aggregated HTTP 4xx and 5xx exception telemetry and endpoint failure counts.
          </p>
        </div>

        <RangeTabs basePath="/system/api-errors" active={range} ranges={[...RANGES]} />
      </div>

      <DataTable data={rows} columns={columns} empty="No API errors recorded in this time range." />
    </div>
  );
}
