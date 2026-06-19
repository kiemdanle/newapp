import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      // v1 → v2: add household_id to records for M8 household sharing
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
  ],
});
