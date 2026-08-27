import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { AdminInviteForm } from './admin-invite-form';
import { RevokeAdminButton } from './revoke-admin-button';
import { RevokeDeviceButton } from './revoke-device-button';
import type { AdminRow, AdminTrustedDeviceRow } from '@expyrico/shared';

export const dynamic = 'force-dynamic';

type Row = AdminRow;
type DeviceRow = AdminTrustedDeviceRow;

export default async function SettingsAdminsPage() {
  const [admins, devicesRes] = await Promise.all([
    serverAdminApi.settings.admins.list(),
    serverAdminApi.trustedDevices.list().catch(() => ({ devices: [] })),
  ]);
  const devices = devicesRes.devices;

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

  const deviceColumns: Column<DeviceRow>[] = [
    {
      header: 'Device / Client',
      cell: (d) => {
        const ua = d.deviceInfo as { userAgent?: string } | null;
        return ua?.userAgent ?? 'Unknown Browser';
      },
    },
    { header: 'IP', cell: (d) => d.ip ?? '—' },
    { header: 'Last Used', cell: (d) => (d.lastUsedAt ? new Date(d.lastUsedAt).toLocaleString() : 'Never') },
    { header: 'Expires', cell: (d) => new Date(d.expiresAt).toLocaleDateString() },
    {
      header: 'Actions',
      cell: (d) => <RevokeDeviceButton id={d.id} />,
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold text-neutral-dark font-display">Admins</h1>
          <p className="text-sm text-neutral-mid">
            Invite or revoke admin access. Revoked users become regular users.
          </p>
        </div>
        <DataTable data={admins} columns={columns} empty="No admins found." />
        <AdminInviteForm />
      </div>

      <div className="space-y-6 border-t pt-8">
        <div>
          <h2 className="text-xl font-semibold text-neutral-dark font-display">Remembered Devices (60 Days)</h2>
          <p className="text-sm text-neutral-mid">
            Devices that bypass 2FA authenticator verification during sign-in. Revoke any unrecognized or old devices.
          </p>
        </div>
        <DataTable data={devices} columns={deviceColumns} empty="No remembered devices found for this account." />
      </div>
    </div>
  );
}
