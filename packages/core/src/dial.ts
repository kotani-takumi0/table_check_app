import { limitsOf, RULES, startOf, type Session } from './domain';

const MINUTE = 60_000;
// 卓カードの文字盤。案内（コースはファーストドリンク）から数えた経過を、120分（お席の時間）で一周する弧にする
export const DIAL_MIN = RULES.seatLimitMin;
// 文字盤の縁に出す「L.O. から退席まで」の帯（90〜120分）
export const DIAL_BAND = { fromMin: RULES.lastOrderMin, toMin: RULES.seatLimitMin } as const;
export interface Dial {
  elapsedMin: number | null;  // 経過（分、切り捨て）。コースの開始待ちは null
  progress: number;           // 弧の長さ 0〜1（120分で1。超えたら1のまま）
  over: boolean;              // お席の時間（120分）を過ぎている
}
// 経過は timerOf・alertOf と同じ基準（startOf から。退店済は退店の時刻で止める）
export function dialOf(session: Session, now: number): Dial {
  const start = startOf(session);
  if (start === null) return { elapsedMin: null, progress: 0, over: false };
  const end = session.status === 'exited' ? session.exitedAt ?? now : now;
  const elapsedMin = Math.floor(Math.max(0, end - start) / MINUTE);
  const seatEndAt = limitsOf(session)?.seatEndAt ?? start + DIAL_MIN * MINUTE;
  return { elapsedMin, progress: Math.min(1, elapsedMin / DIAL_MIN), over: end >= seatEndAt };
}
// 文字盤の縁の「L.O. から退席まで」の帯（0〜1）。退店の時刻を決めた卓は、その時刻に合わせて前にずらす
export function bandOf(session: Session): { from: number; to: number } {
  const start = startOf(session);
  const limits = limitsOf(session);
  if (start === null || limits === null) return { from: DIAL_BAND.fromMin / DIAL_MIN, to: DIAL_BAND.toMin / DIAL_MIN };
  const at = (time: number) => Math.min(1, Math.max(0, (time - start) / MINUTE / DIAL_MIN));
  return { from: at(limits.lastOrderAt), to: at(limits.seatEndAt) };
}
export type Remaining =
  | { kind: 'last_order'; minutes: number }  // L.O.まで N分
  | { kind: 'seat_limit'; minutes: number }  // 退席まで N分
  | { kind: 'over' }                         // お席の時間を過ぎている
  | { kind: 'no_limit' };                    // 店全体で時間制限を切っている
// 卓カードの右下に出す残り時間。L.O.確認済みにするまでは L.O.まで、そのあと（または L.O. の時間を過ぎたら）退席まで。
// 分は切り上げ（残り30秒なら「1分」）。退店済・コースの開始待ちは出さない
export function remainingOf(session: Session, now: number, timeLimitOff = false): Remaining | null {
  const limits = limitsOf(session);
  if (session.status === 'exited' || limits === null) return null;
  if (timeLimitOff) return { kind: 'no_limit' };
  if (now >= limits.seatEndAt) return { kind: 'over' };
  const loLeft = limits.lastOrderAt - now;
  if (session.status !== 'lo_done' && loLeft > 0) return { kind: 'last_order', minutes: Math.ceil(loLeft / MINUTE) };
  return { kind: 'seat_limit', minutes: Math.ceil((limits.seatEndAt - now) / MINUTE) };
}
export function remainingLabel(remaining: Remaining): string {
  switch (remaining.kind) {
    case 'last_order': return `L.O.まで${remaining.minutes}分`;
    case 'seat_limit': return `退席まで${remaining.minutes}分`;
    case 'over': return 'お席の時間を過ぎています';
    case 'no_limit': return '時間制限なし';
  }
}
// 時:分（1:05、0:35）。フロアは秒を出さず1分ごとに動かす
export function formatHourMinute(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}
// 読み上げ：「経過35分、L.O.まで55分」
export function dialLabel(dial: Dial, remaining: Remaining | null): string {
  const elapsed = dial.elapsedMin === null ? '開始前' : `経過${dial.elapsedMin}分`;
  return remaining ? `${elapsed}、${remainingLabel(remaining)}` : elapsed;
}
// 弧・帯を描くための点。12時を0として時計回り、中心 (cx, cy)・半径 r
export function dialPoint(fraction: number, cx: number, cy: number, r: number): { x: number; y: number } {
  const angle = 2 * Math.PI * fraction - Math.PI / 2;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}
// SVG の円弧（from〜to は 0〜1）。一周は2つに分けて描く
export function arcPath(from: number, to: number, cx: number, cy: number, r: number): string {
  if (to - from <= 0) return '';
  if (to - from >= 1) return `${arcPath(0, 0.5, cx, cy, r)} ${arcPath(0.5, 1, cx, cy, r)}`;
  const a = dialPoint(from, cx, cy, r), b = dialPoint(to, cx, cy, r);
  const f = (n: number) => Math.round(n * 1000) / 1000;
  return `M ${f(a.x)} ${f(a.y)} A ${r} ${r} 0 ${to - from > 0.5 ? 1 : 0} 1 ${f(b.x)} ${f(b.y)}`;
}
