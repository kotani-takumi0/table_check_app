import { describe, expect, it } from 'vitest';
import { advance, alertOf, displayOf, isVisible, lastOrderDue, limitsOf, newSession, RULES } from './domain';
import { bandOf, dialOf, remainingLabel, remainingOf } from './dial';
import { noticesOf } from './notices';
import { DEFAULT_SHOP_SETTINGS, MemoryShopSettingsStore, newDrinkPlanId, parseShopSettings, stepMinutes, type ShopSettings } from './shopSettings';

const minute = 60_000;
const seated = newSession('s', '12', 0);
const otoshi = advance(seated, 5 * minute);
const off = { ...RULES, timeLimitOff: true };

describe('店全体で時間制限を切る', () => {
  it('L.O.・お席の時間の警告と L.O.の通知を出さない', () => {
    expect(alertOf(otoshi, 100 * minute, off)).toEqual({ level: 'none', reason: null });
    expect(alertOf(otoshi, 130 * minute, off)).toEqual({ level: 'none', reason: null });
    expect(lastOrderDue([otoshi], 100 * minute, off)).toEqual([]);
    expect(noticesOf([otoshi], { toilet_check: 100 * minute, toilet_clean: 100 * minute }, 100 * minute, off)).toEqual([]);
  });
  it('お通しの警告はそのまま出す', () => {
    expect(alertOf(seated, 20 * minute, off)).toEqual({ level: 'now', reason: 'otoshi_missing' });
  });
  it('残り時間の代わりに「時間制限なし」を出す（退店済・開始待ちは出さない）', () => {
    expect(remainingOf(otoshi, 30 * minute, off)).toEqual({ kind: 'no_limit' });
    expect(remainingLabel({ kind: 'no_limit' })).toBe('時間制限なし');
    expect(remainingOf(advance(advance(otoshi, minute), minute), 30 * minute, off)).toBeNull();
    expect(remainingOf(newSession('c', '13', 0, 2, 'drinks'), 30 * minute, off)).toBeNull();
  });
  it('切っていないときは今までどおり', () => {
    expect(alertOf(otoshi, 100 * minute)).toEqual({ level: 'soon', reason: 'last_order' });
    expect(lastOrderDue([otoshi], 100 * minute)).toEqual([otoshi]);
  });
});
describe('店の設定', () => {
  it('壊れた値や無い項目は既定値（時間制限あり）で読む', () => {
    expect(parseShopSettings(undefined)).toEqual(DEFAULT_SHOP_SETTINGS);
    expect(parseShopSettings({ timeLimitOff: 'yes' })).toEqual(DEFAULT_SHOP_SETTINGS);
    expect(parseShopSettings({ timeLimitOff: true, other: 1 })).toEqual({ ...DEFAULT_SHOP_SETTINGS, timeLimitOff: true });
    expect(parseShopSettings({ lastOrderMin: 60, seatLimitMin: 90, otoshiWarnMin: 10, exitedKeepMin: 3, otoshi: false, shopName: 'ミノパル' }))
      .toEqual({ ...DEFAULT_SHOP_SETTINGS, lastOrderMin: 60, seatLimitMin: 90, otoshiWarnMin: 10, exitedKeepMin: 3, otoshi: false, shopName: 'ミノパル' });
  });
  it('範囲の外の分は既定値、L.O. がお席の時間に届くなら両方とも既定値で読む', () => {
    expect(parseShopSettings({ otoshiWarnMin: 0, exitedKeepMin: 1.5, seatLimitMin: 999 })).toEqual(DEFAULT_SHOP_SETTINGS);
    expect(parseShopSettings({ lastOrderMin: 120, seatLimitMin: 120 })).toEqual(DEFAULT_SHOP_SETTINGS);
    expect(parseShopSettings({ shopName: 'あ'.repeat(31) }).shopName).toBe('');
  });
  it('メモリの保存先は切り替えを購読者に渡す', async () => {
    const store = new MemoryShopSettingsStore();
    const seen: ShopSettings[] = [];
    store.subscribe(s => seen.push(s));
    await store.update({ timeLimitOff: true });
    await store.update({ lastOrderMin: 60 });
    await store.update({ timeLimitOff: false });
    expect(seen.map(s => [s.timeLimitOff, s.lastOrderMin])).toEqual([[false, 90], [true, 90], [true, 60], [false, 60]]);
  });
  it('分は step ずつ変え、範囲の外や L.O. がお席の時間に届く変更はしない', () => {
    expect(stepMinutes(DEFAULT_SHOP_SETTINGS, 'lastOrderMin', 1)).toEqual({ lastOrderMin: 95 });
    expect(stepMinutes(DEFAULT_SHOP_SETTINGS, 'exitedKeepMin', -1)).toEqual({ exitedKeepMin: 4 });
    expect(stepMinutes({ ...DEFAULT_SHOP_SETTINGS, lastOrderMin: 115 }, 'lastOrderMin', 1)).toBeNull();
    expect(stepMinutes({ ...DEFAULT_SHOP_SETTINGS, lastOrderMin: 115 }, 'seatLimitMin', -1)).toBeNull();
    expect(stepMinutes({ ...DEFAULT_SHOP_SETTINGS, otoshiWarnMin: 5 }, 'otoshiWarnMin', -1)).toBeNull();
  });
});
describe('店ごとの時間のルール（No.14）', () => {
  const rules = { ...RULES, otoshiWarnMin: 10, lastOrderMin: 60, seatLimitMin: 90, exitedKeepMin: 2 };
  it('L.O.・お席の時間・お通しの警告をその分で出す', () => {
    expect(limitsOf(otoshi, rules)).toEqual({ lastOrderAt: 60 * minute, seatEndAt: 90 * minute });
    expect(alertOf(otoshi, 60 * minute, rules)).toEqual({ level: 'soon', reason: 'last_order' });
    expect(alertOf(otoshi, 90 * minute, rules)).toEqual({ level: 'now', reason: 'seat_limit' });
    expect(alertOf(seated, 10 * minute, rules)).toEqual({ level: 'now', reason: 'otoshi_missing' });
    expect(lastOrderDue([otoshi], 60 * minute, rules)).toEqual([otoshi]);
  });
  it('L.O.・お席の時間を変えたら、閉じた L.O. の通知も別の通知として出し直す（ふつうの値なら key は今までどおり）', () => {
    const key = (r: typeof RULES) => noticesOf([otoshi], { toilet_check: 200 * minute, toilet_clean: 200 * minute }, 130 * minute, r)[0].key;
    expect(key(RULES)).toBe(`lo:s:0`);
    expect(key(rules)).not.toBe(key({ ...rules, lastOrderMin: 65 }));
  });
  it('退店の時刻を決めた卓は、その「お席の時間 − L.O.」前を L.O. にする', () => {
    expect(limitsOf({ ...otoshi, leaveAt: 80 * minute }, rules)).toEqual({ lastOrderAt: 50 * minute, seatEndAt: 80 * minute });
  });
  it('文字盤はお席の時間で一周し、帯は L.O. からお席の時間まで', () => {
    expect(dialOf(otoshi, 45 * minute, rules)).toEqual({ elapsedMin: 45, progress: 0.5, over: false, limitMin: 90 });
    expect(bandOf(otoshi, rules)).toEqual({ from: 60 / 90, to: 1 });
  });
  it('退店済みはその分だけ残す', () => {
    const exited = { ...otoshi, status: 'exited' as const, exitedAt: 50 * minute };
    expect(isVisible(exited, 51 * minute, rules)).toBe(true);
    expect(isVisible(exited, 52 * minute, rules)).toBe(false);
  });
  it('お通しを出さない店は、お通し未提供の警告を出さず、2段目をファーストドリンク提供済みと呼ぶ', () => {
    const noOtoshi = { ...RULES, otoshi: false };
    expect(alertOf(seated, 30 * minute, noOtoshi)).toEqual({ level: 'none', reason: null });
    expect(displayOf('otoshi', null, noOtoshi)).toBe('first_drink');
    expect(displayOf('seated', null, noOtoshi)).toBe('seated');
    expect(displayOf('otoshi', null)).toBe('otoshi');
  });
});
describe('飲み放題の区分（No.90）', () => {
  it('無い・壊れた一覧は最初の一覧、壊れた項目と同じ id は落とし、空の一覧はそのまま読む', () => {
    expect(parseShopSettings({}).drinkPlans).toEqual(DEFAULT_SHOP_SETTINGS.drinkPlans);
    expect(parseShopSettings({ drinkPlans: 'x' }).drinkPlans).toEqual(DEFAULT_SHOP_SETTINGS.drinkPlans);
    expect(parseShopSettings({ drinkPlans: [] }).drinkPlans).toEqual([]);
    expect(parseShopSettings({ drinkPlans: [{ id: 'plan_a', name: '2時間' }, { id: 'plan_a', name: '重複' }, { id: 'Bad-id', name: 'x' }, { id: 'plan_b', name: '' }, null] }).drinkPlans)
      .toEqual([{ id: 'plan_a', name: '2時間' }]);
  });
  it('新しい区分の id は既存と重ならない', () => {
    const id = newDrinkPlanId([], 1000);
    expect(id).toMatch(/^plan_[a-z0-9]+$/);
    expect(newDrinkPlanId([{ id, name: 'a' }], 1000)).not.toBe(id);
  });
});
