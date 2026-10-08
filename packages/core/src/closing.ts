import { businessDayOf, businessDayRange, DAY_START_HOUR } from './history';
import type { Session } from './domain';

// 閉店時刻（No.129）。閉店が近づくとアプリを触らなくなるので、閉店時刻を過ぎても退店していない卓は、閉店で退店にして記録を閉じる。
// 閉店時刻は 0時からの分（例 23:30 は 1410）。朝4時より前（0〜3時台）は、その営業日の深夜（次の日の日付）として扱う
export const CLOSING_STEP_MIN = 15;
export function isClosingMin(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < 24 * 60 && (value as number) % CLOSING_STEP_MIN === 0;
}
// 選べる閉店時刻：朝4時から次の日の3:45まで、営業日の順に並べる
export const CLOSING_CHOICES: number[] = Array.from({ length: 24 * 60 / CLOSING_STEP_MIN },
  (_, i) => (DAY_START_HOUR * 60 + i * CLOSING_STEP_MIN) % (24 * 60));
// 表示（例「23:30」「深夜1:00」）
export function closingLabel(closingMin: number): string {
  const h = Math.floor(closingMin / 60), m = String(closingMin % 60).padStart(2, '0');
  return h < DAY_START_HOUR ? `深夜${h}:${m}` : `${h}:${m}`;
}
// その営業日の閉店の時刻
export function closingAtOf(day: string, closingMin: number): number | null {
  const range = businessDayRange(day);
  if (!range) return null;
  const date = new Date(range.start);
  date.setHours(0, closingMin, 0, 0);
  if (Math.floor(closingMin / 60) < DAY_START_HOUR) date.setDate(date.getDate() + 1);
  return date.getTime();
}
// このお客さんを閉店で退店にする時刻。案内した営業日の閉店時刻。閉店時刻より後に案内したお客さんは、その営業日の終わり（朝4時）
export function closeOutAtOf(session: Session, closingMin: number): number | null {
  const day = businessDayOf(session.seatedAt);
  const closingAt = closingAtOf(day, closingMin);
  if (closingAt === null) return null;
  return session.seatedAt < closingAt ? closingAt : businessDayRange(day)?.end ?? null;
}
// 閉店で退店にするお客さん（退店していない・全卓消去していない・閉店で退店にする時刻を過ぎた）と、退店にしたあとの中身
export function closeOuts(sessions: Session[], now: number, closingMin: number | null): Session[] {
  if (closingMin === null) return [];
  return sessions.flatMap(session => {
    if (session.status === 'exited' || session.clearedAt !== null) return [];
    const at = closeOutAtOf(session, closingMin);
    return at !== null && now >= at ? [{ ...session, status: 'exited' as const, exitedAt: at, exitedByClosing: true }] : [];
  });
}
