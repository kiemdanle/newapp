import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.system.externalApis>>['breakers'][number];

export default async function SystemExternalApisPage() {
  const { breakers } = await serverAdminApi.system.externalApis();

  const columns: Column<Row>[] = [
    { header: 'Service', cell: (b) => <span className="font-medium">{b.name}</span> },
    { header: 'State', cell: (b) => <StatusBadge status={b.state} /> },
    { header: 'Fires', cell: (b) => b.fires.toLocaleString() },
    { header: 'Failures', cell: (b) => b.failures.toLocaleString() },
    { header: 'Successes', cell: (b) => b.successes.toLocaleString() },
    {
      header: 'Last failure',
      cell: (b) => (b.lastFailureAt ? new Date(b.lastFailureAt).toLocaleString() : '—'),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">External APIs</h1>
      <p className="text-sm text-muted-foreground">
        Circuit-breaker state for outbound integrations (OpenFoodFacts, UPCitemdb, Expo Push).
      </p>
      <DataTable data={breakers} columns={columns} empty="No breakers registered." />
    </div>
  );
}
