import { serverAdminApi } from '@/lib/admin-api';
import { PantryUnitsForm } from './pantry-units-form';
import { Scale } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SettingsPantryUnitsPage() {
  const pantryUnits = await serverAdminApi.settings.pantryUnits.get();

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Scale size={14} />
          <span>Pantry Configuration</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Default Grocery Units
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Configure the top 4 quick-select unit pills displayed across mobile item creation and editing.
        </p>
      </div>

      <PantryUnitsForm initial={pantryUnits} />
    </div>
  );
}
