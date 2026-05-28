import { Queue } from 'bullmq';
import { getQueueConnection } from './index.js';

export interface ProductLookupJob {
  barcode: string;
  requestedByUserId: string;
}

export const PRODUCT_LOOKUP_QUEUE = 'product-lookup';

let _q: Queue<ProductLookupJob> | undefined;
export function productLookupQueue(): Queue<ProductLookupJob> {
  if (!_q) {
    _q = new Queue<ProductLookupJob>(PRODUCT_LOOKUP_QUEUE, { connection: getQueueConnection() });
  }
  return _q;
}
