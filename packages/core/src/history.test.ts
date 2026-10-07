import { describe, expect, it } from 'vitest';
import { DEFAULT_COURSE_MENUS, priceLabel } from './courseMenus';
import { DEFAULT_DRINK_PLANS, newSession, type Session } from './domain';
import { businessDayOf, businessDayRange, businessDaysRange, csvFileName, CSV_HEADER, sessionsCsv } from './history';

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
const settings = { drinkPlans: DEFAULT_DRINK_PLANS, courseMenus: DEFAULT_COURSE_MENUS };
const lines = (csv: string) => csv.replace(/^﻿/, '').trimEnd().split('\r\n');

describe('営業日は朝4時で区切る', () => {
  it('4時より前は前の日、4時からはその日', () => {
    expect(businessDayOf(at(3, 3, 59))).toBe('2026-10-02');
    expect(businessDayOf(at(3, 4))).toBe('2026-10-03');
    expect(businessDayOf(at(3, 23, 30))).toBe('2026-10-03');
  });
  it('その日の4時から次の日の4時まで', () => {
    expect(businessDayRange('2026-10-03')).toEqual({ start: at(3, 4), end: at(4, 4) });
    expect(businessDayRange('2026-10-31')).toEqual({ start: at(31, 4), end: new Date(2026, 10, 1, 4).getTime() });
  });
  it('期間は、はじめの日の4時からおわりの日の次の日の4時まで（No.113）', () => {
    expect(businessDaysRange('2026-10-03', '2026-10-05')).toEqual({ start: at(3, 4), end: at(6, 4) });
    expect(businessDaysRange('2026-10-03', '2026-10-03')).toEqual(businessDayRange('2026-10-03'));
    expect(businessDaysRange('2026-10-05', '2026-10-03')).toBeNull();
    expect(businessDaysRange('2026-10-03', '')).toBeNull();
    expect(csvFileName('2026-10-03', '2026-10-05')).toBe('minopal-2026-10-03_2026-10-05.csv');
    expect(csvFileName('2026-10-03', '2026-10-03')).toBe('minopal-2026-10-03.csv');
  });
  it('日付の形が違えば null', () => {
    for (const bad of ['', '2026-1-3', '2026-02-30', 'きょう']) expect(businessDayRange(bad)).toBeNull();
  });
});
describe('CSV', () => {
  const plain: Session = { ...newSession('a', '12', at(3, 18, 5), 4), status: 'exited', otoshiAt: at(3, 18, 10), loDoneAt: at(3, 19, 40), exitedAt: at(3, 20, 5), paidAt: at(3, 20, 0) };
  const course: Session = { ...newSession('b', '11', at(3, 18, 0), null, 'drinks', DEFAULT_COURSE_MENUS[1].id), tableIds: ['11', '13'] };
  it('見出しと、案内の順に1行ずつ。先頭に BOM、改行は CRLF', () => {
    const csv = sessionsCsv([plain, course], settings);
    expect(csv.startsWith('﻿')).toBe(true);
    const [head, first, second] = lines(csv);
    expect(head).toBe(CSV_HEADER.join(','));
    expect(first.startsWith('2026-10-03,11・13,,飲み放題,')).toBe(true);
    expect(first.endsWith(',18:00,,,,,未払い,ご案内済み,,')).toBe(true);
    expect(second).toBe('2026-10-03,12,4,通常,,18:05,18:10,19:40,20:05,120,会計済（20:00）,退店済み,,');
  });
  it('どのコースか未定なら「未定」、消したコースは「消したコース」', () => {
    const [, undecided] = lines(sessionsCsv([{ ...course, menu: null }], settings));
    expect(undecided.split(',')[4]).toBe('未定');
    const [, removed] = lines(sessionsCsv([course], { ...settings, courseMenus: [] }));
    expect(removed.split(',')[4]).toBe('消したコース');
  });
  it('カンマや引用符を含む欄は引用符で囲む', () => {
    const menus = [{ ...DEFAULT_COURSE_MENUS[1], name: 'お肉, "特上"' }];
    const [, row] = lines(sessionsCsv([course], { ...settings, courseMenus: menus }));
    expect(row).toContain('"3,000円 お肉, ""特上"""');
  });
  it('全卓消去の時刻と卓の動きを出す（No.113）', () => {
    const moved: Session = { ...plain, clearedAt: at(3, 23, 0), tableLog: [{ at: at(3, 18, 30), kind: 'move', from: '12', to: '13' }, { at: at(3, 19, 0), kind: 'add', from: null, to: '14' }] };
    const cells = lines(sessionsCsv([moved], settings))[1].split(',');
    expect(cells.slice(-2)).toEqual(['23:00', '18:30 12→13番に移動 / 19:00 14番を足す']);
  });
  it('名前を変えた区分・コースも、記録に写したそのときの名前で出す（No.113）', () => {
    const recorded = { ...course, record: { drinkPlanName: '前の名前', courseName: '前のコース名' } };
    const cells = lines(sessionsCsv([recorded], settings))[1].split(',');
    expect(cells[3]).toBe('前の名前');
    expect(lines(sessionsCsv([recorded], settings))[1]).toContain(`"${priceLabel(DEFAULT_COURSE_MENUS[1])} 前のコース名"`);
  });
  it('設定で消した区分・コースは、記録に写した名前で出す（No.113）', () => {
    const recorded = { ...course, record: { drinkPlanName: '昔の飲み放題', courseName: '昔のコース' } };
    const cells = lines(sessionsCsv([recorded], { drinkPlans: [], courseMenus: [] }))[1].split(',');
    expect(cells[3]).toBe('昔の飲み放題');
    expect(cells[4]).toBe('昔のコース');
  });
});
