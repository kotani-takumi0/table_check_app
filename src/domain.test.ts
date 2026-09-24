import { describe, expect, it } from 'vitest';
import { advance, alertOf, formatElapsed, isVisible, newSession, nextStatus, revert, timerOf } from './domain';
const seated = newSession('session', '31', 10_000);
const otoshi = advance(seated, 20_000);
const loDone = advance(otoshi, 30_000);
const exited = advance(loDone, 40_000);
const minute = 60_000;
describe('状態遷移', () => {
  it('初期状態と各状態の時刻を記録し、引数を変更しない', () => {
    expect(seated).toEqual({ id: 'session', tableIds: ['31'], status: 'seated', seatedAt: 10_000, otoshiAt: null, loDoneAt: null, exitedAt: null });
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
