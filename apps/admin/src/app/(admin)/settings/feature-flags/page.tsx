import { serverAdminApi } from '@/lib/admin-api';
import { FlagsForm } from './flags-form';

export const dynamic = 'force-dynamic';

export default async function SettingsFeatureFlagsPage() {
  const flags = await serverAdminApi.settings.featureFlags.get();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Feature flags</h1>
      <FlagsForm initial={flags} />
    </div>
  );
}
