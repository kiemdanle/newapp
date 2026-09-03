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
  ],
});
