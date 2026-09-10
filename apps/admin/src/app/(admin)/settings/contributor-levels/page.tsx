import { serverAdminApi } from '@/lib/admin-api';
import { LevelsEditorForm } from './levels-editor-form';
import { Award } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SettingsContributorLevelsPage() {
  const contributorLevels = await serverAdminApi.settings.contributorLevels.get();

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Award size={14} />
          <span>Gamification & Ranks</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Contributor Levels & Ranking
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Configure gamified contributor tiers, point requirements, badge icons, and profile visibility for the community.
        </p>
      </div>

      <LevelsEditorForm initial={contributorLevels} />
    </div>
  );
}
