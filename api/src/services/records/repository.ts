import type { Record as PrismaRecord } from '@prisma/client';
import type { Record as ApiRecord } from '@expyrico/shared';

export function toApiRecord(r: PrismaRecord): ApiRecord {
  return {
    id: r.id,
    clientId: r.clientId,
    userId: r.userId,
    productId: r.productId,
    householdId: r.householdId,
    customName: r.customName,
    expiryDate: r.expiryDate.toISOString().slice(0, 10),
    purchaseDate: r.purchaseDate ? r.purchaseDate.toISOString().slice(0, 10) : null,
    quantity: Number(r.quantity),
    unit: r.unit,
    notes: r.notes,
    photoUrl: r.photoUrl,
    status: r.status,
    notifyAt: Array.isArray(r.notifyAt) ? (r.notifyAt as string[]) : [],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    consumedAt: r.consumedAt ? r.consumedAt.toISOString() : null,
  };
}
