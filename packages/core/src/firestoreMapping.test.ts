import { describe, expect, it } from 'vitest';
import { advance, newSession } from './domain';
import { fromSessionDoc, resolveSessions, tablesToWrite, toSessionDoc } from './firestoreMapping';
import { dishProgress } from './domain';

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
  it('全卓消去・卓の動き（No.113）を書いて読み戻す。無い古い文書は消していない・動かしていないとして読む', () => {
    const recorded = { ...seated, clearedAt: 90_000, tableLog: [{ at: 50_000, kind: 'move' as const, from: '31', to: '32' }] };
    expect(fromSessionDoc('session', toSessionDoc(recorded))).toEqual(recorded);
    expect(fromSessionDoc('session', data)).toMatchObject({ clearedAt: null, tableLog: [] });
    expect(fromSessionDoc('session', { ...data, clearedAt: 'x' })).toBeNull();
  });
  it('卓の動きの壊れた項目は落として読む', () => {
    const tableLog = [{ at: 1, kind: 'move', from: '1', to: '2' }, { at: 'x', kind: 'move' }, { at: 2, kind: 'jump', from: null, to: null }, null];
    expect(fromSessionDoc('session', { ...data, tableLog })?.tableLog).toEqual([{ at: 1, kind: 'move', from: '1', to: '2' }]);
  });
  it('paidAt が無い古い文書は未払いとして読み、不正な paidAt は拒否する', () => {
    expect(fromSessionDoc('session', data)?.paidAt).toBeNull();
    expect(fromSessionDoc('session', { ...data, paidAt: 50_000 })?.paidAt).toBe(50_000);
    expect(fromSessionDoc('session', { ...data, paidAt: 'x' })).toBeNull();
  });
  it('guests が無い古い文書は人数未入力として読み、不正な guests は拒否する', () => {
    expect(fromSessionDoc('session', data)?.guests).toBeNull();
    expect(fromSessionDoc('session', { ...data, guests: 6 })?.guests).toBe(6);
    for (const bad of [0, 100, 2.5, '6']) expect(fromSessionDoc('session', { ...data, guests: bad })).toBeNull();
  });
  it('人数が未入力でも guests: null を書く（古いアプリの上書きを見分けるため）', () => {
    expect(toSessionDoc(seated)).toHaveProperty('guests', null);
    expect(toSessionDoc({ ...seated, guests: 3 }).guests).toBe(3);
  });
  it('course が無い古い文書は通常として読み、不正な course は拒否する', () => {
    expect(fromSessionDoc('session', data)?.course).toBeNull();
    expect(fromSessionDoc('session', { ...data, course: 'premium_drinks' })?.course).toBe('premium_drinks');
    expect(fromSessionDoc('session', { ...data, course: 'plan_abc' })?.course).toBe('plan_abc');
    for (const bad of ['', 'Course!', 1, true]) expect(fromSessionDoc('session', { ...data, course: bad })).toBeNull();
  });
  it('店が足した区分（No.90）は course を前の版も読める drinks にし、本当の区分は drinkPlan に入れる', () => {
    const custom = { ...seated, course: 'plan_abc' };
    const doc = toSessionDoc(custom);
    expect(doc).toMatchObject({ course: 'drinks', drinkPlan: 'plan_abc' });
    expect(fromSessionDoc('session', doc)?.course).toBe('plan_abc');
    expect(toSessionDoc({ ...seated, course: 'premium_drinks' })).toMatchObject({ course: 'premium_drinks', drinkPlan: 'premium_drinks' });
    // 前の版のアプリは drinkPlan を書かない。通常に戻したら drinkPlan が残っていても通常
    expect(fromSessionDoc('session', { ...data, course: 'drinks' })?.course).toBe('drinks');
    expect(fromSessionDoc('session', { ...doc, course: null })?.course).toBeNull();
    expect(fromSessionDoc('session', { ...doc, drinkPlan: 'Bad!' })).toBeNull();
  });
  it('通常でも course: null を書く（古いアプリの上書きを見分けるため）', () => {
    expect(toSessionDoc(seated)).toHaveProperty('course', null);
    expect(toSessionDoc({ ...seated, course: 'drinks' }).course).toBe('drinks');
  });
  it('menu・dishesServed が無い古い文書はコース未選択・まだ出していないとして読み、不正な値は拒否する', () => {
    const course = { ...data, course: 'drinks' };
    expect(fromSessionDoc('session', course)).toMatchObject({ menu: null, dishesServed: 0 });
    expect(fromSessionDoc('session', { ...course, menu: 'cheese', dishesServed: 3 })).toMatchObject({ menu: 'cheese', dishesServed: 3 });
    for (const bad of [{ menu: 'X!' }, { courseMenu: 'X!' }, { menu: 1 }, { dishesServed: -1 }, { dishesServed: 1.5 }, { dishesServed: '1' }]) {
      expect(fromSessionDoc('session', { ...course, ...bad })).toBeNull();
    }
  });
  it('通常の卓のメニューは読まず、出した品数はメニューの品数までに収める（収めるのは dishProgress）', () => {
    expect(fromSessionDoc('session', { ...data, menu: 'cheese', dishesServed: 3 })).toMatchObject({ menu: null, dishesServed: 0 });
    expect(dishProgress(fromSessionDoc('session', { ...data, course: 'drinks', menu: 'nijikai', dishesServed: 20 })!)?.served).toBe(5);
  });
  it('店が作ったコース（No.89）は menu を前の版も読める null にし、本当のコースは courseMenu に入れる', () => {
    const custom = { ...seated, course: 'drinks', menu: 'menu_abc', dishesServed: 2 };
    const doc = toSessionDoc(custom);
    expect(doc).toMatchObject({ menu: null, courseMenu: 'menu_abc', dishesServed: 2 });
    expect(fromSessionDoc('session', doc)).toMatchObject({ menu: 'menu_abc', dishesServed: 2 });
    expect(toSessionDoc({ ...custom, menu: 'cheese' })).toMatchObject({ menu: 'cheese', courseMenu: 'cheese' });
    // 前の版のアプリは courseMenu を書かない
    expect(fromSessionDoc('session', { ...data, course: 'drinks', menu: 'cheese', dishesServed: 1 })).toMatchObject({ menu: 'cheese' });
  });
  it('未選択でも menu: null と dishesServed を書く（古いアプリの上書きを見分けるため）', () => {
    expect(toSessionDoc(seated)).toMatchObject({ menu: null, dishesServed: 0 });
  });
  it('料理を出した時刻（No.131）を書いて読む。無い古い文書は空、品数より後の時刻は落とし、壊れた値は null', () => {
    const served = { ...seated, course: 'drinks', menu: 'cheese', dishesServed: 2, dishServedAt: [30_000, 40_000] };
    expect(toSessionDoc(served).dishServedAt).toEqual([30_000, 40_000]);
    expect(toSessionDoc(seated).dishServedAt).toEqual([]);
    const course = { ...data, course: 'drinks', menu: 'cheese', dishesServed: 2 };
    expect(fromSessionDoc('session', course)?.dishServedAt).toEqual([]);
    expect(fromSessionDoc('session', { ...course, dishServedAt: [30_000, 40_000, 50_000] })?.dishServedAt).toEqual([30_000, 40_000]);
    expect(fromSessionDoc('session', { ...course, dishServedAt: ['x', 40_000] })?.dishServedAt).toEqual([null, 40_000]);
    expect(fromSessionDoc('session', { ...data, dishServedAt: [30_000] })?.dishServedAt).toEqual([]);
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
  it('移動元の卓の古い参照は、セッションの tableIds に無いので空席として扱う', () => {
    const moved = { ...seated, tableIds: ['15'] };
    expect(resolveSessions({ '31': seated.id, '15': seated.id }, [moved])).toEqual([moved]);
    expect(resolveSessions({ '31': seated.id }, [moved])).toEqual([]);
  });
  it('同時操作で他の客に取られた卓は団体の tableIds から外す', () => {
    const group = { ...seated, tableIds: ['11', '12'] };
    const other12 = newSession('other12', '12', 30_000);
    expect(resolveSessions({ '11': seated.id, '12': other12.id }, [group, other12]))
      .toEqual([{ ...group, tableIds: ['11'] }, other12]);
  });
  it('tablesToWrite は tableIds をそのまま返す', () => {
    expect(tablesToWrite(seated)).toBe(seated.tableIds);
  });
});
