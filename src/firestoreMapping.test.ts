import { describe, expect, it } from 'vitest';
import { advance, newSession } from './domain';
import { fromSessionDoc, resolveSessions, tablesToClear, tablesToRelease, tablesToWrite, toSessionDoc } from './firestoreMapping';

const seated = newSession('session', '31', 10_000);
const data = { tableIds: ['31'], status: 'seated', seatedAt: 10_000, otoshiAt: null, loDoneAt: null, exitedAt: null, paidAt: null };
describe('Firestore document mapping', () => {
  it('正しい形を Session に変換し、監査用フィールドを除く', () => {
    expect(fromSessionDoc('session', { ...data, updatedAt: 123 })).toEqual(seated);
  });
  it.each([
    null, [], { ...data, status: 'invalid' }, { ...data, seatedAt: undefined },
    { ...data, tableIds: [] }, { ...data, tableIds: [31] },
    { ...data, seatedAt: Infinity }, { ...data, otoshiAt: NaN },
    { ...data, loDoneAt: undefined }, { ...data, status: 'otoshi' },
    { ...data, status: 'lo_done', otoshiAt: 20_000 },
    { ...data, status: 'exited', otoshiAt: 20_000, loDoneAt: 30_000 },
  ])('不正な形を拒否する: %j', value => {
    expect(fromSessionDoc('session', value)).toBeNull();
  });
  it('paidAt が無い古い文書は未払いとして読み、不正な paidAt は拒否する', () => {
    expect(fromSessionDoc('session', data)?.paidAt).toBeNull();
    expect(fromSessionDoc('session', { ...data, paidAt: 50_000 })?.paidAt).toBe(50_000);
    expect(fromSessionDoc('session', { ...data, paidAt: 'x' })).toBeNull();
  });
  it('複数卓を許可する', () => {
    expect(fromSessionDoc('session', { ...data, tableIds: ['31', '33'] })?.tableIds).toEqual(['31', '33']);
  });
  it('全状態で往復でき、id と updatedAt を文書に含めない', () => {
    const otoshi = advance(seated, 20_000);
    const loDone = advance(otoshi, 30_000);
    for (const session of [seated, otoshi, loDone, advance(loDone, 40_000)]) {
      const document = toSessionDoc(session);
      expect(document).not.toHaveProperty('id');
      expect(document).not.toHaveProperty('updatedAt');
      expect(fromSessionDoc(session.id, document)).toEqual(session);
    }
  });
});
describe('卓参照による表示', () => {
  const other = newSession('other', '33', 20_000);
  it('指されていないセッションは返さない', () => {
    expect(resolveSessions({ '31': seated.id, '33': null }, [seated, other])).toEqual([seated]);
  });
  it('同時案内で負けたセッションは新しい時刻でも返さない', () => {
    const loser = newSession('loser', '31', 30_000);
    expect(resolveSessions({ '31': seated.id }, [loser, seated])).toEqual([seated]);
  });
  it('複数卓から指されても一度だけ返す', () => {
    expect(resolveSessions({ '31': seated.id, '33': seated.id }, [seated])).toEqual([seated]);
  });
  it('存在しない id を無視する', () => {
    expect(resolveSessions({ '31': 'missing' }, [seated])).toEqual([]);
  });
  it('tablesToClear は現在該当する卓だけを返す', () => {
    expect(tablesToClear(seated.id, { '31': seated.id, '33': other.id, '34': null, '36': seated.id })).toEqual(['31', '36']);
    expect(tablesToClear('missing', { '31': seated.id })).toEqual([]);
  });
  it('tablesToWrite は tableIds をそのまま返す', () => {
    expect(tablesToWrite(seated)).toBe(seated.tableIds);
  });
});
it('移動・外した卓だけを解放し、他のセッションの卓や使っている卓は触らない', () => {
  const moved = { ...newSession('s', '15', 0), tableIds: ['15', '12'] };
  expect(tablesToRelease(moved, { '11': 's', '12': 's', '15': null, '13': 'other' })).toEqual(['11']);
  expect(tablesToRelease(moved, { '12': 's', '15': 's' })).toEqual([]);
});
