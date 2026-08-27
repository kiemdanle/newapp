import { serverAdminApi } from '@/lib/admin-api';
import { FlagsForm } from './flags-form';

export const dynamic = 'force-dynamic';

export default async function SettingsFeatureFlagsPage() {
  const [flags, productCreation] = await Promise.all([
    serverAdminApi.settings.featureFlags.get(),
    serverAdminApi.settings.productCreation.get(),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold text-neutral-dark font-display">Feature flags & rollouts</h1>
      <FlagsForm initial={flags} initialProductCreation={productCreation} />
    </div>
  );
}
