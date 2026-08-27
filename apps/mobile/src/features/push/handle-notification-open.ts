import { Linking } from 'react-native';
import Config from 'react-native-config';
import { navigate } from '../../navigation/navigationRef';
type ModerationNotificationData = {
  type?: unknown;
  url?: unknown;
  batchId?: unknown;
  [key: string]: unknown;
};

export function registerModerationNotificationBatch(batchId: unknown, openedBatchIds: Set<string>): boolean {
  if (typeof batchId !== 'string' || batchId.length === 0) return true;
  if (openedBatchIds.has(batchId)) return false;
  openedBatchIds.add(batchId);
  return true;
}

function configuredAdminOrigin(): string | null {
  const raw = Config.MOBILE_ADMIN_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.hash ||
      url.search ||
      (url.pathname !== '/' && url.pathname !== '')
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Handles only the dedicated moderation message type and constructs the target
 * from the mobile build's independent trust anchor. The incoming `url` is used
 * solely as an equality check — never passed directly to Linking — so a forged
 * notification cannot open arbitrary content or smuggle credentials/fragments.
 */
export async function handleModerationNotificationOpen(data: ModerationNotificationData | undefined): Promise<boolean> {
  if (!data || data.type !== 'moderation_queue' || typeof data.url !== 'string') return false;
  const origin = configuredAdminOrigin();
  if (!origin) return false;
  try {
    const incoming = new URL(data.url);
    if (
      incoming.origin !== origin ||
      incoming.protocol !== 'https:' ||
      incoming.username ||
      incoming.password ||
      incoming.hash ||
      incoming.search ||
      incoming.pathname !== '/products/pending'
    ) {
      return false;
    }
  } catch {
    return false;
  }
  const target = `${origin}/products/pending`;
  await Linking.openURL(target);
  return true;
}

export async function handleNotificationTap(data: Record<string, unknown> | undefined): Promise<boolean> {
  if (!data) return false;
  if (data.type === 'moderation_queue') {
    return handleModerationNotificationOpen(data as ModerationNotificationData);
  }
  if (data.type === 'expiry' && typeof data.recordId === 'string' && data.recordId.length > 0) {
    navigate('Record', { id: data.recordId });
    return true;
  }
  if (typeof data.type === 'string' && data.type.startsWith('giveaway_') && typeof data.giveawayId === 'string') {
    if (data.type === 'giveaway_new_claim') {
      navigate('GiveawayManage', { id: data.giveawayId });
    } else {
      navigate('Giveaway', { id: data.giveawayId });
    }
    return true;
  }
  if ((data.type === 'product_edit_approved' || data.type === 'product_approved') && typeof data.productId === 'string' && data.productId.length > 0) {
    navigate('Product', { id: data.productId });
    return true;
  }
  if (data.type === 'product_edit_changes_required' || data.type === 'product_changes_required') {
    navigate('ProductDrafts', undefined);
    return true;
  }
  return false;
}
