import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { NotificationTemplateForm } from './notification-template-form';
import { Bell, CheckCircle, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Row = Awaited<
  ReturnType<typeof serverAdminApi.settings.notificationTemplates.list>
>[number];

export default async function SettingsNotificationTemplatesPage() {
  const templates = await serverAdminApi.settings.notificationTemplates.list();

  const columns: Column<Row>[] = [
    {
      header: 'Template Key',
      cell: (t) => (
        <span className="font-mono text-xs font-semibold text-neutral-dark rounded-md bg-neutral-light px-2 py-0.5 border border-neutral-200">
          {t.key}
        </span>
      ),
    },
    {
      header: 'Notification Title',
      cell: (t) => <span className="font-semibold text-neutral-dark text-xs">{t.title}</span>,
    },
    {
      header: 'Body Template',
      cell: (t) => <span className="text-neutral-mid text-xs max-w-md truncate block">{t.body}</span>,
    },
    {
      header: 'Status',
      cell: (t) =>
        t.enabled ? (
          <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full text-xs font-semibold">
            <CheckCircle size={11} className="text-emerald-600" />
            <span>Active</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-neutral-600 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded-full text-xs font-medium">
            <XCircle size={11} className="text-neutral-400" />
            <span>Disabled</span>
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
          <Bell size={14} />
          <span>Transactional Messaging</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Notification Templates
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Push notification copy templates. Changes apply immediately to subsequent scheduled notification dispatches.
        </p>
      </div>

      <DataTable data={templates} columns={columns} empty="No notification templates configured." />

      <div className="space-y-4 pt-4 border-t border-border">
        <h2 className="text-lg font-bold text-neutral-dark font-display">
          Template Customization
        </h2>
        <div className="space-y-4">
          {templates.map((t) => (
            <NotificationTemplateForm key={t.id} template={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
