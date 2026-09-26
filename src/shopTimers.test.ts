import { describe, expect, it } from 'vitest';
import { parseShopTimerDone, shopTimerState } from './shopTimers';

const minute = 60_000;
describe('店全体のタイマー', () => {
  it('済にしてから周期が経つと時間になる（境界は >=）', () => {
    expect(shopTimerState(30, 0, 30 * minute - 1000)).toEqual({ due: false, dueAt: 30 * minute, remainingMs: 1000 });
    expect(shopTimerState(30, 0, 30 * minute)).toEqual({ due: true, dueAt: 30 * minute, remainingMs: 0 });
  });
  it('一度も済にしていなければすぐに時間', () => {
    expect(shopTimerState(120, undefined, 5).due).toBe(true);
  });
  it('保存データから既知のタイマーの数値だけ取り出す', () => {
    expect(parseShopTimerDone({ toilet_check: 10, toilet_clean: 'x', other: 5, })).toEqual({ toilet_check: 10 });
    for (const bad of [null, 1, 'a', []]) expect(parseShopTimerDone(bad)).toEqual({});
    expect(parseShopTimerDone({ toilet_clean: Infinity })).toEqual({});
  });
});
