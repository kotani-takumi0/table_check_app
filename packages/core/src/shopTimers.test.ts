import { describe, expect, it } from 'vitest';
import { mergeShopTimerDone, parseDoneAt, shopTimerState } from './shopTimers';

const minute = 60_000;
describe('店全体のタイマー', () => {
  it('済にしてから周期が経つと時間になる（境界は >=）', () => {
    expect(shopTimerState(30, 0, 30 * minute - 1000)).toEqual({ due: false, dueAt: 30 * minute, remainingMs: 1000 });
    expect(shopTimerState(30, 0, 30 * minute)).toEqual({ due: true, dueAt: 30 * minute, remainingMs: 0 });
  });
  it('一度も済にしていなければすぐに時間', () => {
    expect(shopTimerState(120, undefined, 5).due).toBe(true);
  });
  it('保存データから有限の数値だけ取り出す', () => {
    expect(parseDoneAt('10')).toBe(10);
    for (const bad of [null, '', 'x', 'Infinity', 'NaN']) expect(parseDoneAt(bad)).toBeUndefined();
  });
});
it('同期状態はいちばん悪いものを出す', async () => {
  const { worstSyncState } = await import('./store');
  expect(worstSyncState(['synced', 'synced'])).toBe('synced');
  expect(worstSyncState(['synced', 'pending'])).toBe('pending');
  expect(worstSyncState(['pending', 'offline'])).toBe('offline');
});
it('別タブの済を消さずに、タイマーごとに新しい時刻を残す', () => {
  expect(mergeShopTimerDone({ toilet_check: 5 }, { toilet_clean: 3 })).toEqual({ toilet_check: 5, toilet_clean: 3 });
  expect(mergeShopTimerDone({ toilet_check: 5 }, { toilet_check: 2 })).toEqual({ toilet_check: 5 });
  expect(mergeShopTimerDone({ toilet_check: 2 }, { toilet_check: 5 })).toEqual({ toilet_check: 5 });
});
