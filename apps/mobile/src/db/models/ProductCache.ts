import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export class ProductCacheModel extends Model {
  static override table = 'products_cache';

  @field('server_id') serverId!: string;
  @field('barcode') barcode!: string | null;
  @field('name') name!: string;
  @field('brand') brand!: string | null;
  @field('image_url') imageUrl!: string | null;
  @field('default_shelf_life_days') defaultShelfLifeDays!: number | null;
  @readonly @date('updated_at') updatedAt!: Date;
}
