import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { NotificationTemplateForm } from './notification-template-form';

export const dynamic = 'force-dynamic';

type Row = Awaited<
  ReturnType<typeof serverAdminApi.settings.notificationTemplates.list>
>[number];

export default async function SettingsNotificationTemplatesPage() {
  const templates = await serverAdminApi.settings.notificationTemplates.list();

  const columns: Column<Row>[] = [
    { header: 'Key', cell: (t) => <span className="font-mono text-xs">{t.key}</span> },
    { header: 'Title', cell: (t) => t.title },
    { header: 'Body', cell: (t) => <span className="text-neutral-mid">{t.body}</span> },
    {
      header: 'Enabled',
      cell: (t) => (t.enabled ? 'Yes' : 'No'),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold text-neutral-dark font-display">Notification templates</h1>
      <p className="text-sm text-neutral-mid">
        Push-notification templates editable by admins. Changes take effect on the next scheduled send.
      </p>
      <DataTable data={templates} columns={columns} empty="No templates configured." />
      <div className="space-y-4">
        {templates.map((t) => (
          <NotificationTemplateForm key={t.id} template={t} />
        ))}
      </div>
    </div>
  );
}
