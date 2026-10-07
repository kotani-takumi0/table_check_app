import { menuOf } from './courseMenus';
import { sessionRules, type Session } from './domain';
import { businessDayOf } from './history';
import type { ShopSettings } from './shopSettings';

// 店の毎日の記録（No.113）。1組＝1文書の sessions を記録の本体にして溜め、あとで分析する。
// 分析で困らないよう、書くたびにそのときの名前・時間のルール・書いた端末を文書に写す（設定をあとで変えても、その日の値が残る）
export type Platform = 'web' | 'ios';
export interface AppInfo { platform: Platform; version: string }
export interface TimeRules { lastOrderMin: number; seatLimitMin: number; timeLimitOff: boolean }
export interface SessionRecord {
  businessDay: string;          // 営業日（朝4時で区切る。例 2026-10-10）
  drinkPlanName: string | null; // そのときの飲み放題の区分の名前（通常は null）
  courseName: string | null;    // そのときのコースの名前（値段は写さない。コースを選んでいなければ null）
  timeRules: TimeRules;         // その組に使った L.O.・お席の時間（分）と、時間制限なしか
  platform: Platform;           // 最後に書いた端末の種類と版
  appVersion: string;
}
// 書く中身。区分・コースを設定で消したあとは名前が分からないので、その項目を書かずに前に写した名前を残す
export function sessionRecord(session: Session, settings: ShopSettings, app: AppInfo): Partial<SessionRecord> {
  const rules = sessionRules(settings, session, settings.courseMenus);
  const record: Partial<SessionRecord> = {
    businessDay: businessDayOf(session.seatedAt),
    timeRules: { lastOrderMin: rules.lastOrderMin, seatLimitMin: rules.seatLimitMin, timeLimitOff: rules.timeLimitOff },
    platform: app.platform, appVersion: app.version,
  };
  const plan = session.course === null ? null : settings.drinkPlans.find(p => p.id === session.course);
  if (session.course === null) record.drinkPlanName = null;
  else if (plan) record.drinkPlanName = plan.name;
  const menu = session.course === null || session.menu === null ? null : menuOf(session.menu, settings.courseMenus);
  if (session.course === null || session.menu === null) record.courseName = null;
  else if (menu) record.courseName = menu.name;
  return record;
}
// 保存した記録を読む（書き出しで使う）。無い・壊れた項目は入れない
export function recordFromDoc(data: unknown): Partial<SessionRecord> {
  const d = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
  const record: Partial<SessionRecord> = {};
  if (typeof d.businessDay === 'string') record.businessDay = d.businessDay;
  if (typeof d.drinkPlanName === 'string' || d.drinkPlanName === null) record.drinkPlanName = d.drinkPlanName;
  if (typeof d.courseName === 'string' || d.courseName === null) record.courseName = d.courseName;
  const r = typeof d.timeRules === 'object' && d.timeRules !== null ? d.timeRules as Record<string, unknown> : null;
  if (r && typeof r.lastOrderMin === 'number' && typeof r.seatLimitMin === 'number' && typeof r.timeLimitOff === 'boolean') {
    record.timeRules = { lastOrderMin: r.lastOrderMin, seatLimitMin: r.seatLimitMin, timeLimitOff: r.timeLimitOff };
  }
  if (d.platform === 'web' || d.platform === 'ios') record.platform = d.platform;
  if (typeof d.appVersion === 'string') record.appVersion = d.appVersion;
  return record;
}
// 書き出しで読む1組：お客さんの中身と、写しておいた記録
export interface RecordedSession extends Session { record: Partial<SessionRecord> }
