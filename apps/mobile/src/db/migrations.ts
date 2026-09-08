import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      // v1 → v2: add household_id to records for household sharing
      toVersion: 2,
      steps: [
        {
          type: 'add_columns' as const,
          table: 'records',
          columns: [
            { name: 'household_id', type: 'string', isOptional: true },
          ],
        },
      ],
    },
    {
      // v2 → v3: add user_id to records to track creator ownership
      toVersion: 3,
      steps: [
        {
          type: 'add_columns' as const,
          table: 'records',
          columns: [
            { name: 'user_id', type: 'string', isOptional: true },
          ],
        },
      ],
    },
    {
      // v3 → v4: add discarded_at and discard_reason to records
      toVersion: 4,
      steps: [
        {
          type: 'add_columns' as const,
          table: 'records',
          columns: [
            { name: 'discarded_at', type: 'number', isOptional: true },
            { name: 'discard_reason', type: 'string', isOptional: true },
          ],
        },
      ],
    },
    {
      // v4 → v5: add location and location_dirty to records
      toVersion: 5,
      steps: [
        {
          type: 'add_columns' as const,
          table: 'records',
          columns: [
            { name: 'location', type: 'string', isOptional: true },
            { name: 'location_dirty', type: 'boolean', isOptional: true },
          ],
        },
      ],
    },
    {
      // v5 → v6: add brand to records
      toVersion: 6,
      steps: [
        {
          type: 'add_columns' as const,
          table: 'records',
          columns: [
            { name: 'brand', type: 'string', isOptional: true },
          ],
        },
      ],
    },
  ],
});
