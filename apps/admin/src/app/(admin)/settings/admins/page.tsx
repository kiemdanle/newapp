import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { AdminInviteForm } from './admin-invite-form';
import { RevokeAdminButton } from './revoke-admin-button';

export const dynamic = 'force-dynamic';

type Row = Awaited<ReturnType<typeof serverAdminApi.settings.admins.list>>[number];

export default async function SettingsAdminsPage() {
  const admins = await serverAdminApi.settings.admins.list();

  const columns: Column<Row>[] = [
    { header: 'Email', cell: (a) => <span className="font-medium">{a.email}</span> },
    { header: 'Name', cell: (a) => `${a.firstName} ${a.lastName}` },
    {
      header: 'TOTP',
      cell: (a) => (a.totpEnabledAt ? 'Enabled' : 'Not enabled'),
    },
    {
      header: 'Created',
      cell: (a) => new Date(a.createdAt).toLocaleString(),
    },
    {
      header: 'Actions',
      cell: (a) => <RevokeAdminButton id={a.id} />,
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Admins</h1>
      <p className="text-sm text-muted-foreground">
        Invite or revoke admin access. Revoked users become regular users.
      </p>
      <DataTable data={admins} columns={columns} empty="No admins found." />
      <AdminInviteForm />
    </div>
  );
}
