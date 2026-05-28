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
});
