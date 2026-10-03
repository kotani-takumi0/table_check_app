import { menuOf, priceLabel } from './courseMenus';
import { drinkPlanName, formatClock, STATUS_LABEL, type Session } from './domain';
import type { ShopSettings } from './shopSettings';

// 履歴（No.34）。その日のお客さんを CSV で書き出し、営業のあとに店長などが表計算や AI に渡して見返せるようにする。
// 「その日」は朝4時で区切る（深夜まで営業する店で、0時をまたいだお客さんを同じ日に入れる）。時刻はその端末の時間帯で数える
export const DAY_START_HOUR = 4;
const pad = (n: number) => String(n).padStart(2, '0');
// その時刻が入る営業日（"YYYY-MM-DD"）。4時より前は前の日
export function businessDayOf(at: number): string {
  const date = new Date(at);
  if (date.getHours() < DAY_START_HOUR) date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
// 営業日の始まり（その日の4時）と終わり（次の日の4時）。日付の形が違えば null
export function businessDayRange(day: string): { start: number; end: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const start = new Date(y, m, d, DAY_START_HOUR);
  if (start.getFullYear() !== y || start.getMonth() !== m || start.getDate() !== d) return null;
  return { start: start.getTime(), end: new Date(y, m, d + 1, DAY_START_HOUR).getTime() };
}
// 表計算で開いても崩れないよう、カンマ・引用符・改行を含む欄は引用符で囲む
function field(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export const CSV_HEADER = ['営業日', '卓', '人数', '区分', 'コース', '案内', 'お通し・ファーストドリンク', 'L.O.確認', '退店', '滞在（分）', 'お会計', '最後の状態'];
// その日のお客さんを案内の順に1行ずつ。Excel で文字化けしないよう、先頭に BOM を付ける
export function sessionsCsv(sessions: Session[], settings: Pick<ShopSettings, 'drinkPlans' | 'courseMenus'>): string {
  const clock = (at: number | null) => at === null ? '' : formatClock(at);
  const rows = [...sessions].sort((a, b) => a.seatedAt - b.seatedAt).map(session => {
    const menu = session.course === null ? null : menuOf(session.menu, settings.courseMenus);
    return [
      businessDayOf(session.seatedAt),
      session.tableIds.join('・'),
      session.guests ?? '',
      session.course === null ? '通常' : drinkPlanName(settings.drinkPlans, session.course),
      session.course === null ? '' : menu ? `${priceLabel(menu)} ${menu.name}` : session.menu === null ? '未定' : '消したコース',
      clock(session.seatedAt),
      clock(session.otoshiAt),
      clock(session.loDoneAt),
      clock(session.exitedAt),
      session.exitedAt === null ? '' : Math.round((session.exitedAt - session.seatedAt) / 60_000),
      session.paidAt === null ? '未払い' : `会計済（${formatClock(session.paidAt)}）`,
      STATUS_LABEL[session.status],
    ];
  });
  return '﻿' + [CSV_HEADER, ...rows].map(row => row.map(field).join(',')).join('\r\n') + '\r\n';
}
// 書き出すファイルの名前
export function csvFileName(day: string): string {
  return `minopal-${day}.csv`;
}
