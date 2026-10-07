import { expect, it } from 'vitest';
import { advance, clearSession, newSession, revert } from './domain';
import { MemoryShopTimerStore } from './memoryStores';
import type { ShopTimerDone } from './shopTimers';
import { backUndo, checkUndo, nextUndo, shopTimerUndo } from './undo';

const minute = 60_000;
const seated = newSession('a', '5', 0, 3);
it('案内を取り消したあと、卓が空いていれば戻せる。別のお客さんを案内していたら戻さない', () => {
  const undo = backUndo(seated, null);
  expect(undo.message).toBe('5番の案内を取り消しました');
  expect(checkUndo(undo, [], {})).toBe('ok');
  expect(checkUndo(undo, [newSession('b', '5', minute)], {})).toBe('taken');
  // 退店済みの表示だけなら置き換えてよい
  const exited = advance(advance(advance(newSession('c', '5', 0), minute), 2 * minute), 3 * minute);
  expect(checkUndo(undo, [exited], {})).toBe('ok');
  // 別の卓のお客さんは関係ない
  expect(checkUndo(undo, [newSession('d', '6', minute)], {})).toBe('ok');
});
it('1つ戻したあと、ほかの端末で進めていたら戻さない', () => {
  const otoshi = advance(seated, 10 * minute);
  const reverted = revert(otoshi)!;
  const undo = backUndo(otoshi, reverted);
  expect(undo.message).toBe('5番を「ご案内済み」に戻しました');
  expect(checkUndo(undo, [reverted], {})).toBe('ok');
  expect(checkUndo(undo, [advance(reverted, 12 * minute)], {})).toBe('changed');
  expect(checkUndo(undo, [], {})).toBe('changed');
});
it('通知で L.O.確認済みにしたのを戻せる。コースの卓でも段階名は同じ', () => {
  const otoshi = advance(seated, 10 * minute);
  const done = advance(otoshi, 90 * minute);
  const undo = nextUndo(otoshi, done);
  expect(undo.message).toBe('5番を「L.O.確認済み」にしました');
  expect(checkUndo(undo, [done], {})).toBe('ok');
});
it('タイマーの済は、そのあとほかの端末で済にしていなければ戻せる', () => {
  const undo = shopTimerUndo('toilet_check', 'トイレチェック', 10 * minute, 40 * minute);
  expect(undo.message).toBe('トイレチェックを済にしました');
  expect(checkUndo(undo, [], { toilet_check: 40 * minute })).toBe('ok');
  expect(checkUndo(undo, [], { toilet_check: 45 * minute })).toBe('changed');
});
it('メモリのタイマーは、済にする前の時刻（一度もなければ未実施）に戻る', async () => {
  const store = new MemoryShopTimerStore();
  let done: ShopTimerDone = {};
  store.subscribe(next => { done = next; });
  await store.markDone('toilet_check', 40 * minute);
  await store.undoDone('toilet_check', 40 * minute, undefined);
  expect(done.toilet_check).toBeUndefined();
  await store.markDone('toilet_check', 10 * minute);
  await store.markDone('toilet_check', 40 * minute);
  // 今の時刻が違えば（ほかで済にした）何もしない
  await store.undoDone('toilet_check', 30 * minute, 10 * minute);
  expect(done.toilet_check).toBe(40 * minute);
  await store.undoDone('toilet_check', 40 * minute, 10 * minute);
  expect(done.toilet_check).toBe(10 * minute);
});
it('詳細の大きいボタンで退店済みにしたのも戻せる（No.122）', () => {
  const lo = advance(advance(seated, 10 * minute), 60 * minute);
  const exited = advance(lo, 90 * minute);
  const undo = nextUndo(lo, exited);
  expect(undo.message).toBe('5番を「退店済み」にしました');
  expect(checkUndo(undo, [exited], {})).toBe('ok');
});
it('全卓消去したあとは戻さない。消したお客さんは卓を取っていないとみなす（No.113）', () => {
  const next = advance(seated, minute);
  expect(checkUndo(nextUndo(seated, next), [clearSession(next, 2 * minute)], {})).toBe('changed');
  expect(checkUndo(backUndo(seated, null), [clearSession(newSession('b', '5', minute), 2 * minute)], {})).toBe('ok');
});
