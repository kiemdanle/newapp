import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export class RecordModel extends Model {
  static override table = 'records';

  @field('server_id') serverId!: string | null;
  @field('client_id') clientId!: string;
  @field('product_id') productId!: string | null;
  @field('custom_name') customName!: string | null;
  @field('category') category!: string | null;
  @field('expiry_date') expiryDate!: string;
  @field('purchase_date') purchaseDate!: string | null;
  @field('quantity') quantity!: number;
  @field('unit') unit!: string;
  @field('price') price!: number | null;
  @field('store') store!: string | null;
  @field('notes') notes!: string | null;
  @field('photo_url') photoUrl!: string | null;
  @field('status') status!: string;
  @field('notify_at_json') notifyAtJson!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
  @date('consumed_at') consumedAt!: Date | null;
  @field('pending_sync') pendingSync!: boolean;
  @field('pending_delete') pendingDelete!: boolean;
}
