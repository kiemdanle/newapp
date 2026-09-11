import { serverAdminApi } from '@/lib/admin-api';
import { PhotoLimitsForm } from './photo-limits-form';
import { Camera } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SettingsPhotoLimitsPage() {
  const photoLimits = await serverAdminApi.settings.photoLimits.get();

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Camera size={14} />
          <span>Media & Storage</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-dark font-display tracking-tight mt-1">
          Photo Upload Limits
        </h1>
        <p className="text-sm text-neutral-mid mt-0.5">
          Configure the maximum number of photos users can upload when creating or editing products and pantry items.
        </p>
      </div>

      <PhotoLimitsForm initial={photoLimits} />
    </div>
  );
}
