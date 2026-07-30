import { describe, expect, it } from 'vitest';
import { writeAuditLog } from '../../src/services/audit/log.js';
import { getPrisma } from '../../src/db.js';
import { makeUser } from '../helpers/factories.js';

describe('writeAuditLog', () => {
  it('inserts a row with all provided fields', async () => {
    const admin = await makeUser({ role: 'admin' });

    await writeAuditLog({
      adminId: admin.id,
      action: 'user.suspend',
      targetType: 'user',
      targetId: 'target-uuid',
      diff: { before: { status: 'active' }, after: { status: 'suspended' } },
      requestId: 'req-123',
      ip: '203.0.113.7',
    });

    const rows = await getPrisma().adminAuditLog.findMany({ where: { adminId: admin.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe('user.suspend');
    expect(rows[0]?.targetType).toBe('user');
    expect(rows[0]?.targetId).toBe('target-uuid');
    expect(rows[0]?.requestId).toBe('req-123');
    expect(rows[0]?.ip).toBe('203.0.113.7');
    expect(rows[0]?.diff).toEqual({
      before: { status: 'active' },
      after: { status: 'suspended' },
    });
  });

  it('accepts an optional diff and null-ish request metadata', async () => {
    const admin = await makeUser({ role: 'admin' });

    await writeAuditLog({
      adminId: admin.id,
      action: 'product.merge',
      targetType: 'product',
      targetId: 'p-1',
    });

    const row = await getPrisma().adminAuditLog.findFirstOrThrow({
      where: { adminId: admin.id },
    });
    expect(row.diff).toBeNull();
    expect(row.requestId).toBeNull();
    expect(row.ip).toBeNull();
  });

  it('throws if adminId is missing', async () => {
    await expect(
      writeAuditLog({
        adminId: '',
        action: 'noop',
        targetType: 'user',
        targetId: 'x',
      }),
    ).rejects.toThrow(/adminId/);
  });

  it('accepts a transaction client so the row commits atomically with the state change it records', async () => {
    const admin = await makeUser({ role: 'admin' });
    const prisma = getPrisma();

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: admin.id }, data: { firstName: 'Audited' } });
      await writeAuditLog(
        { adminId: admin.id, action: 'user.update', targetType: 'user', targetId: admin.id },
        tx,
      );
    });

    const row = await prisma.adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, action: 'user.update' } });
    expect(row).toBeTruthy();
    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(updatedUser.firstName).toBe('Audited');
  });

  it('rolls back the audit row together with the rest of the transaction on failure', async () => {
    const admin = await makeUser({ role: 'admin' });
    const prisma = getPrisma();

    await expect(
      prisma.$transaction(async (tx) => {
        await writeAuditLog(
          { adminId: admin.id, action: 'user.update', targetType: 'user', targetId: admin.id },
          tx,
        );
        throw new Error('forced rollback');
      }),
    ).rejects.toThrow('forced rollback');

    const rows = await prisma.adminAuditLog.findMany({ where: { adminId: admin.id, action: 'user.update' } });
    expect(rows).toHaveLength(0);
  });
});
