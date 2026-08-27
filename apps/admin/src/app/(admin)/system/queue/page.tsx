import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { Server, Activity, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.system.queueHealth>>['queues'][number];

export default async function SystemQueuePage() {
  const { queues } = await serverAdminApi.system.queueHealth();

  const columns: Column<Row>[] = [
    {
      header: 'Queue Worker',
      cell: (q) => (
        <div className="flex items-center gap-2.5">
          <Server size={16} className="text-primary shrink-0" />
          <span className="font-semibold text-neutral-dark font-mono text-xs">{q.name}</span>
        </div>
      ),
    },
    {
      header: 'Waiting',
      cell: (q) => (
        <span className="font-mono text-xs font-semibold text-neutral-dark">
          {q.waiting.toLocaleString()}
        </span>
      ),
      className: 'text-right',
    },
    {
      header: 'Active',
      cell: (q) => (
        <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-primary">
          <Activity size={11} className="animate-pulse" />
          <span>{q.active.toLocaleString()}</span>
        </span>
      ),
      className: 'text-right',
    },
    {
      header: 'Completed',
      cell: (q) => (
        <span className="font-mono text-xs text-emerald-700 font-medium">
          {q.completed.toLocaleString()}
        </span>
      ),
      className: 'text-right',
    },
    {
      header: 'Failed',
      cell: (q) => (
        <span
          className={`font-mono text-xs font-bold ${
            q.failed > 0 ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200' : 'text-neutral-mid'
          }`}
        >
          {q.failed.toLocaleString()}
        </span>
      ),
      className: 'text-right',
    },
    {
      header: 'Delayed',
      cell: (q) => (
        <span className="font-mono text-xs text-neutral-mid">
          {q.delayed.toLocaleString()}
        </span>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Server size={14} />
          <span>Background Workers</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Queue Health & Workers
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Real-time BullMQ background job statistics, worker execution state, and failed task counters.
        </p>
      </div>

      <DataTable data={queues} columns={columns} empty="No background job queues registered." />
    </div>
  );
}
