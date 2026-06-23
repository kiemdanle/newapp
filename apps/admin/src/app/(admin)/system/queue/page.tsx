import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.system.queueHealth>>['queues'][number];

export default async function SystemQueuePage() {
  const { queues } = await serverAdminApi.system.queueHealth();

  const columns: Column<Row>[] = [
    { header: 'Queue', cell: (q) => <span className="font-medium">{q.name}</span> },
    { header: 'Waiting', cell: (q) => q.waiting.toLocaleString(), className: 'text-right' },
    { header: 'Active', cell: (q) => q.active.toLocaleString(), className: 'text-right' },
    { header: 'Completed', cell: (q) => q.completed.toLocaleString(), className: 'text-right' },
    { header: 'Failed', cell: (q) => q.failed.toLocaleString(), className: 'text-right' },
    { header: 'Delayed', cell: (q) => q.delayed.toLocaleString(), className: 'text-right' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold text-neutral-dark font-display">Queue health</h1>
      <p className="text-sm text-neutral-mid">
        BullMQ job counts across all registered queues.
      </p>
      <DataTable data={queues} columns={columns} empty="No queues registered." />
    </div>
  );
}
