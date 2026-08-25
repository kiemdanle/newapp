import { Platform } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { mySchema } from './schema';
import { migrations } from './migrations';
import { RecordModel } from './models/Record';
import { ProductCacheModel } from './models/ProductCache';

// Android + New Architecture: WatermelonDB 0.28's JSI install
// (`WMDatabaseJSIBridge.install`, a blocking sync @ReactMethod) runs before
// the TurboModule runtime hands JS a valid JavaScriptContextHolder, so
// writes reach SQLite but their JS promises never settle — the record is
// added yet AddRecordForm stays stuck on "Saving…". The async NativeModule
// dispatcher goes through New Arch's legacy-module interop and resolves
// promises correctly. iOS keeps JSI (its install path is unaffected).
const adapter = new SQLiteAdapter({
  schema: mySchema,
  migrations,
  jsi: Platform.OS === 'ios',
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
