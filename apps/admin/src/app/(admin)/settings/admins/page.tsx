import { serverAdminApi } from '@/lib/admin-api';
import { DataTable, type Column } from '@/components/data-table';
import { AdminInviteForm } from './admin-invite-form';
import { RevokeAdminButton } from './revoke-admin-button';
import { RevokeDeviceButton } from './revoke-device-button';
import type { AdminRow, AdminTrustedDeviceRow } from '@expyrico/shared';
import { ShieldCheck, Smartphone, CheckCircle, AlertCircle, Laptop } from 'lucide-react';

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
    {
      header: 'Admin Account',
      cell: (a) => (
        <div className="text-xs">
          <span className="font-semibold text-neutral-dark">{a.email}</span>
          <span className="text-neutral-mid block text-[11px] font-medium">{`${a.firstName} ${a.lastName}`}</span>
        </div>
      ),
    },
    {
      header: '2FA / TOTP Security',
      cell: (a) =>
        a.totpEnabledAt ? (
          <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <CheckCircle size={11} className="text-emerald-600" />
            <span>2FA Active</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <AlertCircle size={11} className="text-amber-600" />
            <span>Enrollment pending</span>
          </span>
        ),
    },
    {
      header: 'Granted At',
      cell: (a) => (
        <span className="text-xs text-neutral-mid font-mono">
          {new Date(a.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Action',
      cell: (a) => <RevokeAdminButton id={a.id} />,
      className: 'text-right',
    },
  ];

  const deviceColumns: Column<DeviceRow>[] = [
    {
      header: 'Device & User Agent',
      cell: (d) => {
        const ua = d.deviceInfo as { userAgent?: string } | null;
        return (
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-dark">
            <Laptop size={14} className="text-neutral-mid shrink-0" />
            <span className="truncate max-w-sm">{ua?.userAgent ?? 'Standard Browser Session'}</span>
          </div>
        );
      },
    },
    {
      header: 'IP Address',
      cell: (d) => (
        <span className="font-mono text-xs font-medium text-neutral-dark">
          {d.ip ?? '—'}
        </span>
      ),
    },
    {
      header: 'Last Active',
      cell: (d) => (
        <span className="text-xs text-neutral-mid font-mono">
          {d.lastUsedAt ? new Date(d.lastUsedAt).toLocaleDateString() : 'Never'}
        </span>
      ),
    },
    {
      header: 'Expires',
      cell: (d) => (
        <span className="text-xs text-neutral-mid font-mono">
          {new Date(d.expiresAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Action',
      cell: (d) => <RevokeDeviceButton id={d.id} />,
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-10">
      {/* Admins Header & Directory */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <ShieldCheck size={14} />
            <span>Access Control</span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
            Administrators
          </h1>
          <p className="text-sm text-neutral-mid mt-0.5">
            Manage administrative members, invite team members, and enforce 2FA verification.
          </p>
        </div>

        <DataTable data={admins} columns={columns} empty="No administrators found." />
        <AdminInviteForm />
      </div>

      {/* Trusted Devices Section */}
      <div className="space-y-6 border-t border-border pt-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <Smartphone size={14} />
            <span>Trusted Hardware</span>
          </div>
          <h2 className="text-2xl font-bold text-neutral-dark font-display tracking-tight mt-1">
            Remembered Devices (60-Day Bypass)
          </h2>
          <p className="text-sm text-neutral-mid mt-0.5">
            Browsers and devices that skip 2FA code challenges during sign-in. Revoke any unrecognized sessions.
          </p>
        </div>

        <DataTable data={devices} columns={deviceColumns} empty="No remembered devices registered for this account." />
      </div>
    </div>
  );
}
