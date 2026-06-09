import { describe, expect, it } from 'vitest';
import { roleAllowsManage, canEditRecordHousehold } from '../../src/services/households/permissions.js';

describe('household permission predicates', () => {
  it('only owner may manage members/household', () => {
    expect(roleAllowsManage('owner')).toBe(true);
    expect(roleAllowsManage('member')).toBe(false);
  });

  it('any member may edit a record in their household', () => {
    expect(canEditRecordHousehold({ isMember: true })).toBe(true);
    expect(canEditRecordHousehold({ isMember: false })).toBe(false);
  });
});
