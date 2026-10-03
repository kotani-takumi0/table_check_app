import { describe, expect, it } from 'vitest';
import { DEFAULT_COURSE_MENUS } from './courseMenus';
import { DEFAULT_DRINK_PLANS, newSession, type Session } from './domain';
import { businessDayOf, businessDayRange, CSV_HEADER, sessionsCsv } from './history';

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
    expect(first.endsWith(',18:00,,,,,未払い,ご案内済み')).toBe(true);
    expect(second).toBe('2026-10-03,12,4,通常,,18:05,18:10,19:40,20:05,120,会計済（20:00）,退店済み');
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
});
