import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, layoutProblems } from './shopLayout';
import { DEFAULT_SHOP_SETTINGS, parseShopSettings } from './shopSettings';
import { BLANK_LAYOUT, BLANK_SETTINGS, SHOP_TEMPLATES } from './shopTemplates';

describe('最初のページのテンプレート（No.087）', () => {
  it('今は「居酒屋・21卓」の1つ。配置はこの店の21卓で、そのまま保存できる', () => {
    expect(SHOP_TEMPLATES.map(t => t.name)).toEqual(['居酒屋・21卓（カウンターあり）']);
    const [izakaya] = SHOP_TEMPLATES;
    expect(izakaya.layout).toEqual(DEFAULT_LAYOUT);
    expect(izakaya.layout.seats).toHaveLength(21);
    expect(layoutProblems(izakaya.layout)).toEqual([]);
  });
  it('設定一式（コース・区分・店のタイマー・時間のルール）を入れ、店名は入れない', () => {
    const [izakaya] = SHOP_TEMPLATES;
    expect(izakaya.settings).not.toHaveProperty('shopName');
    expect(parseShopSettings(izakaya.settings)).toEqual(DEFAULT_SHOP_SETTINGS);
  });
  it('自分で作る：コース・区分・店のタイマーは空、時間のルールはふつうの値。配置は空なので卓を置くまで保存できない', () => {
    const parsed = parseShopSettings(BLANK_SETTINGS);
    expect([parsed.drinkPlans, parsed.courseMenus, parsed.shopTimers]).toEqual([[], [], []]);
    expect([parsed.lastOrderMin, parsed.seatLimitMin]).toEqual([90, 120]);
    expect(layoutProblems(BLANK_LAYOUT)).toContain('卓が1つもありません');
  });
});
