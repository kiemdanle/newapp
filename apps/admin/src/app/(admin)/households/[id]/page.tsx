import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverAdminApi } from '@/lib/admin-api';
import { apiServerFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

async function loadHousehold(id: string) {
  const households = await serverAdminApi.households.list({ limit: 100 });
  return households.items.find((h: { id: string }) => h.id === id);
}

async function loadHouseholdMembers(id: string) {
  // Read members through the admin-bypassing public API (we need member details).
  // The admin API returns list only; for members we fetch directly.
  // Since admin sessions don't carry user membership, use the admin internal fetch.
  const data = await apiServerFetch(`/v1/households/${id}`);
  return data;
}

export default async function HouseholdDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const household = await loadHousehold(params.id);
  if (!household) return <p className="text-neutral-mid py-8 text-center">Household not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/households" className="text-sm text-neutral-mid hover:underline">
            ← Households
          </Link>
          <h1 className="text-[28px] font-semibold text-neutral-dark font-display mt-1">{household.name}</h1>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-neutral-mid">Owner</span>
            <p>
              {household.ownerFirstName}{' '}
              <span className="text-neutral-mid">{household.ownerEmail}</span>
            </p>
          </div>
          <div>
            <span className="text-neutral-mid">Members</span>
            <p>{household.memberCount}</p>
          </div>
          <div>
            <span className="text-neutral-mid">Created</span>
            <p>{new Date(household.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <DissolveButton householdId={params.id} householdName={household.name} />
    </div>
  );
}

function DissolveButton({
  householdId,
  householdName,
}: {
  householdId: string;
  householdName: string;
}) {
  // Server action for dissolve
  async function dissolveAction() {
    'use server';
    await serverAdminApi.households.dissolve(householdId);
    redirect('/households');
  }

  return (
    <form action={dissolveAction}>
      <button
        type="submit"
        className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        aria-label={`Dissolve ${householdName}`}
      >
        Dissolve Household
      </button>
    </form>
  );
}
