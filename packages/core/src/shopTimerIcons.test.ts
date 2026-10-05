import { describe, expect, it } from 'vitest';
import { FALLBACK_SHOP_TIMER_ICON, SHOP_TIMER_ICONS, shopTimerIcon } from './shopTimerIcons';
import { DEFAULT_SHOP_TIMERS, SHOP_TIMER_LIMITS } from './shopTimers';

describe('店のタイマーのアイコン（No.99）', () => {
  it('id で引ける。id は保存できる長さ（8文字まで）で重ならない', () => {
    expect(shopTimerIcon('patrol').name).toBe('見回り');
    for (const icon of SHOP_TIMER_ICONS) expect(icon.id.length).toBeLessThanOrEqual(SHOP_TIMER_LIMITS.icon);
    expect(new Set(SHOP_TIMER_ICONS.map(icon => icon.id)).size).toBe(SHOP_TIMER_ICONS.length);
  });
  it('最初の一覧はアイコンの id を持つ', () => {
    for (const timer of DEFAULT_SHOP_TIMERS) expect(SHOP_TIMER_ICONS.some(icon => icon.id === timer.icon)).toBe(true);
  });
  it('前の版の絵文字は近いアイコンに、知らない値は時計に読み替える', () => {
    expect(shopTimerIcon('👀').id).toBe('patrol');
    expect(shopTimerIcon('🧽').id).toBe('clean');
    expect(shopTimerIcon('🗑️').id).toBe('bag');
    expect(shopTimerIcon('🍺').id).toBe(FALLBACK_SHOP_TIMER_ICON);
    expect(shopTimerIcon('').id).toBe(FALLBACK_SHOP_TIMER_ICON);
  });
});
