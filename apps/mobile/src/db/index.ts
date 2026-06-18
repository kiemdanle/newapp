import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { mySchema } from './schema';
import { migrations } from './migrations';
import { RecordModel } from './models/Record';
import { ProductCacheModel } from './models/ProductCache';

const adapter = new SQLiteAdapter({
  schema: mySchema,
  migrations,
  jsi: true,
  dbName: 'pantry',
  onSetUpError: (err) => {
    // eslint-disable-next-line no-console
    console.error('watermelon setup error', err);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [RecordModel, ProductCacheModel],
});

export { RecordModel, ProductCacheModel };
