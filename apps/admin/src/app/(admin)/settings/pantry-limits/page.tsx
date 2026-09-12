import { serverAdminApi } from '@/lib/admin-api';
import { PantryLimitsForm } from './pantry-limits-form';
import { Layers, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SettingsPantryLimitsPage() {
  let pantryLimits;
  let loadError: string | null = null;

  try {
    pantryLimits = await serverAdminApi.settings.pantryLimits.get();
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Failed to load pantry limits from API server';
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Layers size={14} />
          <span>Inventory & Capacity</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Pantry Item Limits
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Configure the maximum number of active pantry items each user can hold in their personal and shared pantries.
        </p>
      </div>

      {loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-neutral-dark max-w-2xl space-y-4 shadow-sm" role="alert">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h2 className="font-semibold text-red-900 text-sm">Failed to Load Authoritative Settings</h2>
              <p className="text-xs text-red-700 mt-1">
                {loadError}. To prevent accidental overwrites of existing production limits with default values, the editing form has been disabled.
              </p>
            </div>
          </div>
          <div className="pt-2">
            <Link
              href="/settings/pantry-limits"
              className="inline-flex items-center gap-2 text-xs font-medium bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
            >
              <RefreshCw size={14} />
              <span>Retry Connection</span>
            </Link>
          </div>
        </div>
      ) : pantryLimits ? (
        <PantryLimitsForm initial={pantryLimits} />
      ) : null}
    </div>
  );
}
