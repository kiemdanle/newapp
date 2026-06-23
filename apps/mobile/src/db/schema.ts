import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const mySchema = appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'records',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'client_id', type: 'string', isIndexed: true },
        { name: 'product_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'custom_name', type: 'string', isOptional: true },
        { name: 'category', type: 'string', isOptional: true },
        { name: 'expiry_date', type: 'string' }, // ISO yyyy-mm-dd
        { name: 'purchase_date', type: 'string', isOptional: true },
        { name: 'quantity', type: 'number' },
        { name: 'unit', type: 'string' },
        { name: 'price', type: 'number', isOptional: true },
        { name: 'store', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'photo_url', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'notify_at_json', type: 'string' }, // JSON array of ISO ts
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'consumed_at', type: 'number', isOptional: true },
        { name: 'pending_sync', type: 'boolean', isIndexed: true },
        { name: 'pending_delete', type: 'boolean', isIndexed: true },
        { name: 'household_id', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'products_cache',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'barcode', type: 'string', isOptional: true, isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'brand', type: 'string', isOptional: true },
        { name: 'image_url', type: 'string', isOptional: true },
        { name: 'default_shelf_life_days', type: 'number', isOptional: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
