import { describe, expect, it } from 'vitest';
import { DEFAULT_SHOP_TIMERS, isShopTimerId, mergeShopTimerDone, newShopTimerId, parseDoneAt, parseShopTimers, shopTimerState, stepInterval } from './shopTimers';
import { noticesOf } from './notices';

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
describe('店が決めるタイマー（No.91）', () => {
  const timer = { id: 'timer_a', label: 'ゴミ出し', icon: '🗑️', intervalMin: 60 };
  it('無い・壊れた一覧は最初の一覧、壊れたタイマーと同じ id は落とし、空の一覧はそのまま読む', () => {
    expect(parseShopTimers(undefined)).toEqual(DEFAULT_SHOP_TIMERS);
    expect(parseShopTimers([])).toEqual([]);
    expect(parseShopTimers([timer, { ...timer, label: '重複' }, { ...timer, id: 'Bad' }, { ...timer, id: 'b', intervalMin: 3 }, { ...timer, id: 'c', icon: '' }])).toEqual([timer]);
    expect(parseShopTimers(Array.from({ length: 6 }, (_, i) => ({ ...timer, id: `t${i}` })))).toHaveLength(4);
  });
  it('間隔は5分ずつ、5〜480分の中で変える', () => {
    expect(stepInterval(timer, 1)?.intervalMin).toBe(65);
    expect(stepInterval({ ...timer, intervalMin: 5 }, -1)).toBeNull();
    expect(stepInterval({ ...timer, intervalMin: 480 }, 1)).toBeNull();
  });
  it('新しいタイマーの id は形が正しく、既存と重ならない', () => {
    const id = newShopTimerId([], 1000);
    expect(isShopTimerId(id)).toBe(true);
    expect(newShopTimerId([{ ...timer, id }], 1000)).not.toBe(id);
  });
  it('通知は店のタイマーで出す', () => {
    expect(noticesOf([], {}, 0, undefined, [timer]).map(notice => notice.message)).toEqual(['ゴミ出しの時間です']);
  });
});
