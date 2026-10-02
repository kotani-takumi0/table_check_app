import { describe, expect, it } from 'vitest';
import { advance, alertOf, lastOrderDue, newSession } from './domain';
import { remainingLabel, remainingOf } from './dial';
import { noticesOf } from './notices';
import { MemoryShopSettingsStore, parseShopSettings, type ShopSettings } from './shopSettings';

const minute = 60_000;
const seated = newSession('s', '12', 0);
const otoshi = advance(seated, 5 * minute);

describe('店全体で時間制限を切る', () => {
  it('L.O.・お席の時間の警告と L.O.の通知を出さない', () => {
    expect(alertOf(otoshi, 100 * minute, true)).toEqual({ level: 'none', reason: null });
    expect(alertOf(otoshi, 130 * minute, true)).toEqual({ level: 'none', reason: null });
    expect(lastOrderDue([otoshi], 100 * minute, true)).toEqual([]);
    expect(noticesOf([otoshi], { toilet_check: 100 * minute, toilet_clean: 100 * minute }, 100 * minute, true)).toEqual([]);
  });
  it('お通しの警告はそのまま出す', () => {
    expect(alertOf(seated, 20 * minute, true)).toEqual({ level: 'now', reason: 'otoshi_missing' });
  });
  it('残り時間の代わりに「時間制限なし」を出す（退店済・開始待ちは出さない）', () => {
    expect(remainingOf(otoshi, 30 * minute, true)).toEqual({ kind: 'no_limit' });
    expect(remainingLabel({ kind: 'no_limit' })).toBe('時間制限なし');
    expect(remainingOf(advance(advance(otoshi, minute), minute), 30 * minute, true)).toBeNull();
    expect(remainingOf(newSession('c', '13', 0, 2, 'drinks'), 30 * minute, true)).toBeNull();
  });
  it('切っていないときは今までどおり', () => {
    expect(alertOf(otoshi, 100 * minute)).toEqual({ level: 'soon', reason: 'last_order' });
    expect(lastOrderDue([otoshi], 100 * minute)).toEqual([otoshi]);
  });
});
describe('店の設定', () => {
  it('壊れた値や無い項目は既定値（時間制限あり）で読む', () => {
    expect(parseShopSettings(undefined)).toEqual({ timeLimitOff: false });
    expect(parseShopSettings({ timeLimitOff: 'yes' })).toEqual({ timeLimitOff: false });
    expect(parseShopSettings({ timeLimitOff: true, other: 1 })).toEqual({ timeLimitOff: true });
  });
  it('メモリの保存先は切り替えを購読者に渡す', async () => {
    const store = new MemoryShopSettingsStore();
    const seen: ShopSettings[] = [];
    store.subscribe(s => seen.push(s));
    await store.setTimeLimitOff(true);
    await store.setTimeLimitOff(false);
    expect(seen.map(s => s.timeLimitOff)).toEqual([false, true, false]);
  });
});
