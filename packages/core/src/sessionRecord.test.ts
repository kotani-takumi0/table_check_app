import { describe, expect, it } from 'vitest';
import { DEFAULT_COURSE_MENUS } from './courseMenus';
import { newSession } from './domain';
import { recordFromDoc, sessionRecord } from './sessionRecord';
import { DEFAULT_SHOP_SETTINGS } from './shopSettings';

const app = { platform: 'web', version: '2.4.0' } as const;
const at = new Date(2026, 9, 11, 1, 30).getTime();   // 10/11 の 1:30 は 10/10 の営業日
const menu = DEFAULT_COURSE_MENUS[1];
describe('記録に写すもの（No.113）', () => {
  it('通常の組：営業日・店の時間のルール・書いた端末を写し、区分とコースは null', () => {
    expect(sessionRecord(newSession('a', '12', at), DEFAULT_SHOP_SETTINGS, app)).toEqual({
      businessDay: '2026-10-10', timeRules: { lastOrderMin: 90, seatLimitMin: 120, timeLimitOff: false },
      platform: 'web', appVersion: '2.4.0', drinkPlanName: null, courseName: null,
    });
  });
  it('コースの組：そのときの区分・コースの名前と、コースの時間のルールを写す', () => {
    const settings = { ...DEFAULT_SHOP_SETTINGS, timeLimitOff: true, courseMenus: [{ ...menu, lastOrderMin: 100, seatLimitMin: 150 }] };
    expect(sessionRecord(newSession('a', '12', at, 4, 'drinks', menu.id), settings, app)).toMatchObject({
      drinkPlanName: '飲み放題', courseName: menu.name, timeRules: { lastOrderMin: 100, seatLimitMin: 150, timeLimitOff: true },
    });
  });
  it('設定で消した区分・コースは名前を書かない（前に写した名前を残す）', () => {
    const record = sessionRecord(newSession('a', '12', at, null, 'drinks', menu.id), { ...DEFAULT_SHOP_SETTINGS, drinkPlans: [], courseMenus: [] }, app);
    expect(record).not.toHaveProperty('drinkPlanName');
    expect(record).not.toHaveProperty('courseName');
  });
  it('コースを選んでいなければコースの名前は null', () => {
    expect(sessionRecord(newSession('a', '12', at, null, 'drinks'), DEFAULT_SHOP_SETTINGS, app).courseName).toBeNull();
  });
  it('保存した記録を読み戻す。壊れた項目は入れない', () => {
    const record = sessionRecord(newSession('a', '12', at, 4, 'drinks', menu.id), DEFAULT_SHOP_SETTINGS, app);
    expect(recordFromDoc({ ...record, updatedAt: 1 })).toEqual(record);
    expect(recordFromDoc({ businessDay: 1, platform: 'android', timeRules: { lastOrderMin: 90 } })).toEqual({});
  });
});
