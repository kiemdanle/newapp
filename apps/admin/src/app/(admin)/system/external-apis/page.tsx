import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { Webhook, Zap, CheckCircle2, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.system.externalApis>>['breakers'][number];

export default async function SystemExternalApisPage() {
  const { breakers } = await serverAdminApi.system.externalApis();

  const columns: Column<Row>[] = [
    {
      header: 'External Integration',
      cell: (b) => (
        <div className="flex items-center gap-2.5">
          <Webhook size={16} className="text-primary shrink-0" />
          <span className="font-semibold text-neutral-dark text-xs">{b.name}</span>
        </div>
      ),
    },
    { header: 'Breaker State', cell: (b) => <StatusBadge status={b.state} /> },
    {
      header: 'Total Calls',
      cell: (b) => (
        <span className="font-mono text-xs font-semibold text-neutral-dark">
          {b.fires.toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Successes',
      cell: (b) => (
        <span className="font-mono text-xs text-emerald-700 font-medium">
          {b.successes.toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Failures',
      cell: (b) => (
        <span
          className={`font-mono text-xs font-bold ${
            b.failures > 0 ? 'text-red-600' : 'text-neutral-mid'
          }`}
        >
          {b.failures.toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Last Failure',
      cell: (b) => (
        <span className="text-xs text-neutral-mid font-mono">
          {b.lastFailureAt ? new Date(b.lastFailureAt).toLocaleString() : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Zap size={14} />
          <span>Circuit Breakers</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          External API Integrations
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Outbound circuit breaker health states for OpenFoodFacts, UPCitemdb, and Firebase Cloud Messaging.
        </p>
      </div>

      <DataTable data={breakers} columns={columns} empty="No external API circuit breakers registered." />
    </div>
  );
}
