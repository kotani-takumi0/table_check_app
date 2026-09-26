import { describe, expect, it } from 'vitest';
import { mergeShopTimerDone, parseShopTimerDone, shopTimerState } from './shopTimers';

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
describe('LocalShopTimerStore', () => {
  it('保存できなくても、このページでは両方の済を保つ', async () => {
    const { LocalShopTimerStore } = await import('./shopTimers');
    const listeners: string[] = [];
    Object.assign(globalThis, { window: {
      localStorage: { getItem: () => null, setItem: () => { throw new Error('quota'); } },
      addEventListener: (type: string) => listeners.push(type), removeEventListener: () => undefined,
    } });
    const store = new LocalShopTimerStore();
    let latest = {};
    const stop = store.subscribe(done => { latest = done; });
    await store.markDone('toilet_check', 1);
    await store.markDone('toilet_clean', 2);
    expect(latest).toEqual({ toilet_check: 1, toilet_clean: 2 });
    stop();
    Reflect.deleteProperty(globalThis, 'window');
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
