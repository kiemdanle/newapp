import { serverAdminApi } from '@/lib/admin-api';
import { ModerationForm } from './moderation-form';

export const dynamic = 'force-dynamic';

export default async function SettingsModerationPage() {
  const moderation = await serverAdminApi.settings.moderation.get();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Moderation settings</h1>
      <p className="text-sm text-muted-foreground">
        Configure auto-hide thresholds and profanity-filter sensitivity.
      </p>
      <ModerationForm initial={moderation} />
    </div>
  );
}
