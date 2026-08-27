import { serverAdminApi } from '@/lib/admin-api';
import { FlagsForm } from './flags-form';
import { ToggleRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SettingsFeatureFlagsPage() {
  const [flags, productCreation] = await Promise.all([
    serverAdminApi.settings.featureFlags.get(),
    serverAdminApi.settings.productCreation.get(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <ToggleRight size={14} />
          <span>Platform Toggles</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Feature Flags & Rollouts
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Enable and disable platform subsystems, community product creation rollout modes, and maintenance notices.
        </p>
      </div>

      <FlagsForm initial={flags} initialProductCreation={productCreation} />
    </div>
  );
}
