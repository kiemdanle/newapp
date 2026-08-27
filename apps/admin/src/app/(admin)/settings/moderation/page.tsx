import { serverAdminApi } from '@/lib/admin-api';
import { ModerationForm } from './moderation-form';
import { Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SettingsModerationPage() {
  const moderation = await serverAdminApi.settings.moderation.get();

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Shield size={14} />
          <span>Automated Filters</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Moderation Rules & Sensitivity
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Configure community report auto-hide thresholds and profanity-filter detection sensitivity.
        </p>
      </div>

      <ModerationForm initial={moderation} />
    </div>
  );
}
