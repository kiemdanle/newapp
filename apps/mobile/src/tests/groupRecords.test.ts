import { groupRecords } from '../features/records/groupRecords';

const r = (id: string, expiryDate: string) => ({
  id,
  clientId: id,
  serverId: null,
  productId: null,
  customName: id,
  category: null,
  expiryDate,
  quantity: 1,
  unit: 'pcs',
  price: null,
  store: null,
  notes: null,
  photoUrl: null,
  status: 'active',
  notifyAt: [],
});

describe('groupRecords', () => {
  it('groups into expired, today, this week, later', () => {
    const today = new Date('2026-05-24T12:00:00Z');
    const groups = groupRecords(
      [
        r('a', '2026-05-20'), // expired
        r('b', '2026-05-24'), // today
        r('c', '2026-05-28'), // this week
        r('d', '2026-06-30'), // later
      ],
      today,
    );
    expect(groups.expired.map((x) => x.id)).toEqual(['a']);
    expect(groups.today.map((x) => x.id)).toEqual(['b']);
    expect(groups.thisWeek.map((x) => x.id)).toEqual(['c']);
    expect(groups.later.map((x) => x.id)).toEqual(['d']);
  });

  it('sorts within each group by expiry ascending', () => {
    const today = new Date('2026-05-24T12:00:00Z');
    const groups = groupRecords(
      [r('b', '2026-06-30'), r('a', '2026-05-30')],
      today,
    );
    expect(groups.thisWeek.length + groups.later.length).toBe(2);
    expect(groups.thisWeek[0]?.id).toBe('a');
    expect(groups.later[0]?.id).toBe('b');
  });
});
