import { serverAdminApi } from '@/lib/admin-api';
import { GiveawayDistanceForm } from './giveaway-distance-form';
import { MapPin, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SettingsGiveawaysPage() {
  let settings;
  let loadError: string | null = null;

  try {
    settings = await serverAdminApi.settings.giveaways.get();
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Failed to load giveaway distance settings';
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <MapPin size={14} />
          <span>Community & Giveaways</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Giveaway Distance Circle
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Configure the default geographic search radius for community giveaways and manage strict distance filtering rules.
        </p>
      </div>

      {loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-neutral-dark max-w-2xl space-y-4 shadow-sm" role="alert">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h2 className="font-semibold text-red-900 text-sm">Failed to Load Settings</h2>
              <p className="text-xs text-red-700 mt-1">{loadError}</p>
            </div>
          </div>
          <div className="pt-2">
            <Link
              href="/settings/giveaways"
              className="inline-flex items-center gap-2 text-xs font-medium bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
            >
              <RefreshCw size={14} />
              <span>Retry</span>
            </Link>
          </div>
        </div>
      ) : settings ? (
        <GiveawayDistanceForm initial={settings} />
      ) : null}
    </div>
  );
}
