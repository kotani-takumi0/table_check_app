import { describe, expect, it } from 'vitest';
import { addTable, advance, alertOf, clockTimeNear, lastOrderDue, moveTable, removeTable, togglePaid, editTime, formatClock, formatElapsed, isVisible, newSession, nextStatus, revert, timerOf } from './domain';
const seated = newSession('session', '31', 10_000);
const otoshi = advance(seated, 20_000);
const loDone = advance(otoshi, 30_000);
const exited = advance(loDone, 40_000);
const minute = 60_000;
describe('状態遷移', () => {
  it('初期状態と各状態の時刻を記録し、引数を変更しない', () => {
    expect(seated).toEqual({ id: 'session', tableIds: ['31'], status: 'seated', seatedAt: 10_000, otoshiAt: null, loDoneAt: null, exitedAt: null, paidAt: null });
    expect(otoshi).toEqual({ ...seated, status: 'otoshi', otoshiAt: 20_000 });
    expect(loDone).toEqual({ ...otoshi, status: 'lo_done', loDoneAt: 30_000 });
    expect(exited).toEqual({ ...loDone, status: 'exited', exitedAt: 40_000 });
    expect(advance(exited, 50_000)).toEqual(exited);
    expect(['seated', 'otoshi', 'lo_done', 'exited'].map(s => nextStatus(s as typeof seated.status))).toEqual(['otoshi', 'lo_done', 'exited', null]);
  });
  it('戻した状態の時刻だけ取り消す', () => {
    expect(revert(exited)).toEqual(loDone);
    expect(revert(loDone)).toEqual(otoshi);
    expect(revert(otoshi)).toEqual(seated);
    expect(revert(seated)).toBeNull();
    expect(exited.exitedAt).toBe(40_000);
  });
});
describe('警告の境界', () => {
  it.each([
    [seated, seated.seatedAt + 15 * minute - 1000, 'none', null],
    [seated, seated.seatedAt + 15 * minute, 'now', 'otoshi_missing'],
    [otoshi, 20_000 + 90 * minute - 1000, 'none', null],
    [otoshi, 20_000 + 90 * minute, 'soon', 'last_order'],
    [otoshi, 20_000 + 120 * minute, 'now', 'seat_limit'],
    [loDone, 20_000 + 120 * minute - 1000, 'none', null],
    [loDone, 20_000 + 120 * minute, 'now', 'seat_limit'],
    [exited, 40_000, 'none', null],
    [exited, 40_000 + 1000 * minute, 'none', null],
  ])('%s at %i', (session, time, level, reason) => {
    expect(alertOf(session, time)).toEqual({ level, reason });
  });
});
it('退店から5分で非表示にする', () => {
  expect(isVisible(exited, 40_000 + 5 * minute - 1000)).toBe(true);
  expect(isVisible(exited, 40_000 + 5 * minute)).toBe(false);
  for (const session of [seated, otoshi, loDone]) expect(isVisible(session, 1e12)).toBe(true);
});
it('タイマーは状態ごとの基準時刻から計算し、負にならない', () => {
  expect(timerOf(seated, 50_000)).toEqual({ label: '案内から', elapsedMs: 40_000 });
  for (const session of [otoshi, loDone]) expect(timerOf(session, 50_000)).toEqual({ label: 'お通しから', elapsedMs: 30_000 });
  expect(timerOf(exited, 50_000)).toEqual({ label: '退店から', elapsedMs: 10_000 });
  for (const session of [seated, otoshi, loDone, exited]) expect(timerOf(session, 0).elapsedMs).toBe(0);
});
it.each([[0, '00:00'], [3_599_000, '59:59'], [3_600_000, '1:00:00'], [3_661_000, '1:01:01'], [-1000, '00:00']])('formatElapsed(%i)', (ms, expected) => {
  expect(formatElapsed(ms)).toBe(expected);
});
describe('時刻の修正', () => {
  const at = (h: number, m: number, day = 26) => new Date(2026, 8, day, h, m).getTime();
  it('formatClock は HH:MM', () => {
    expect(formatClock(at(9, 5))).toBe('09:05');
  });
  it('clockTimeNear は基準に最も近い日付の時刻を返す', () => {
    expect(clockTimeNear('19:20', at(19, 10))).toBe(at(19, 20));
    expect(clockTimeNear('23:50', at(0, 10, 27))).toBe(at(23, 50, 26));
    expect(clockTimeNear('00:10', at(23, 50))).toBe(at(0, 10, 27));
    for (const bad of ['24:00', '12:60', '1:00', '']) expect(clockTimeNear(bad, at(12, 0))).toBeNull();
  });
  const s = { ...newSession('s', '11', at(19, 0)), status: 'lo_done' as const, otoshiAt: at(19, 20), loDoneAt: at(20, 50) };
  const current = at(21, 0);
  it('案内・お通しを前後関係を保つ範囲で修正できる', () => {
    expect(editTime(s, 'otoshiAt', at(19, 10), current)).toEqual({ ...s, otoshiAt: at(19, 10) });
    expect(editTime(s, 'seatedAt', at(19, 20), current)).toEqual({ ...s, seatedAt: at(19, 20) });
    expect(editTime(s, 'otoshiAt', at(18, 59), current)).toBeNull();
    expect(editTime(s, 'otoshiAt', at(20, 51), current)).toBeNull();
    expect(editTime(s, 'seatedAt', at(19, 21), current)).toBeNull();
  });
  it('未提供のお通しは修正できず、案内は現在時刻より後にできない', () => {
    expect(editTime(seated, 'otoshiAt', 10_000, 20_000)).toBeNull();
    expect(editTime(seated, 'seatedAt', 15_000, 20_000)).toEqual({ ...seated, seatedAt: 15_000 });
    expect(editTime(seated, 'seatedAt', 20_001, 20_000)).toBeNull();
  });
});
it('L.O.の時間を過ぎて未確認のセッションを、お通しが古い順に返す', () => {
  const late = { ...advance(newSession('late', '12', 0), 5 * minute) };
  const early = { ...advance(newSession('early', '11', 0), 1 * minute) };
  expect(lastOrderDue([late, early], 5 * minute + 90 * minute - 1000).map(s => s.id)).toEqual(['early']);
  expect(lastOrderDue([late, early], 5 * minute + 90 * minute).map(s => s.id)).toEqual(['early', 'late']);
  expect(lastOrderDue([late, early], 200 * minute).map(s => s.id)).toEqual(['early', 'late']);
  expect(lastOrderDue([advance(early, 2 * minute), seated], 200 * minute)).toEqual([]);
});
it('お会計は状態とは独立に切り替えられ、進める・戻すでは変わらない', () => {
  const paid = togglePaid(otoshi, 70_000);
  expect(paid).toEqual({ ...otoshi, paidAt: 70_000 });
  expect(togglePaid(paid, 80_000)).toEqual(otoshi);
  expect(advance(paid, 90_000).paidAt).toBe(70_000);
  expect(revert(paid)?.paidAt).toBe(70_000);
});
describe('卓の移動・団体', () => {
  const group = { ...otoshi, tableIds: ['11', '12'] };
  it('移動は指定した卓だけ付け替え、状態・時刻・会計は引き継ぐ', () => {
    expect(moveTable(otoshi, '31', '15')).toEqual({ ...otoshi, tableIds: ['15'] });
    expect(moveTable(group, '12', '21')).toEqual({ ...group, tableIds: ['11', '21'] });
    expect(moveTable(group, '11', '3')).toEqual({ ...group, tableIds: ['3', '12'] });
  });
  it('持っていない卓からの移動・すでに持っている卓への移動はしない', () => {
    expect(moveTable(group, '13', '14')).toBeNull();
    expect(moveTable(group, '11', '12')).toBeNull();
  });
  it('追加は数値順に並べ、重複は追加しない', () => {
    expect(addTable(otoshi, '5')).toEqual({ ...otoshi, tableIds: ['5', '31'] });
    expect(addTable(group, '12')).toBeNull();
  });
  it('外すのは2卓以上のときだけ', () => {
    expect(removeTable(group, '11')).toEqual({ ...group, tableIds: ['12'] });
    expect(removeTable(otoshi, '31')).toBeNull();
    expect(removeTable(group, '13')).toBeNull();
  });
});
