import { FilterBar, SelectFilter } from '@/components/filter-bar';

/**
 * Filters for the unified moderation queue (new-product submissions merged with
 * active-product revisions). `type` narrows which upstream source(s) are shown;
 * `status` only has meaning for the new-product source (revisions are always
 * `pending` — the API's `/products/pending` list only ever returns that status);
 * `age` buckets are applied client-side against the already-fetched page (the API
 * has no age-range query param), so it never costs an extra request.
 */
export function ModerationFilters({
  type,
  status,
  age,
}: {
  type?: string | undefined;
  status?: string | undefined;
  age?: string | undefined;
}) {
  return (
    <FilterBar action="/products/pending">
      <SelectFilter
        name="type"
        label="Type"
        value={type}
        options={[
          { value: 'new', label: 'New products' },
          { value: 'revision', label: 'Revisions' },
        ]}
      />
      <SelectFilter
        name="status"
        label="New-product status"
        value={status}
        options={[
          { value: 'pending', label: 'Pending' },
          { value: 'changes_required', label: 'Changes requested' },
        ]}
      />
      <SelectFilter
        name="age"
        label="Age"
        value={age}
        options={[
          { value: '24h', label: 'Older than 24h' },
          { value: '72h', label: 'Older than 72h' },
          { value: '7d', label: 'Older than 7d' },
        ]}
      />
    </FilterBar>
  );
}
