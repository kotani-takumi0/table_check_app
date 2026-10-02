import { menuOf } from './courseMenus';

export type Status = 'seated' | 'otoshi' | 'lo_done' | 'exited';
// コースは通常の「ご案内済み」「お通し提供済み」の位置に「開始待ち」「ファーストドリンク提供済み」が入る。
// 状態の値は同じものを使い、表示（名前・色）だけ変える。L.O.確認済み以降は通常と同じ
export type Display = Status | 'course_wait' | 'first_drink';
export const STATUS_LABEL: Record<Display, string> = {
  seated: 'ご案内済み', otoshi: 'お通し提供済み', lo_done: 'L.O.確認済み', exited: '退店済み',
  course_wait: '開始待ち', first_drink: 'ファーストドリンク提供済み',
};
// 卓カードの状態名・次へのボタン。「ファーストドリンク提供済み」はカードに入らないので縮める（詳細パネルは正式名）
export const STATUS_CARD: Record<Display, string> = { ...STATUS_LABEL, first_drink: 'ファースト済み' };
export const STATUS_SHORT: Record<Display, string> = {
  seated: '案内済', otoshi: 'お通し済', lo_done: 'L.O.済', exited: '退店済',
  course_wait: '開始待', first_drink: 'FD済',
};
// 飲み放題の区分。飲み放題の中でも出せるドリンクが違うので分けて持つ。区分を選ぶとその卓はコースになる（null は通常）。
// 区分の一覧は店が設定で決める（No.90。ShopSettings の drinkPlans）。セッションには区分の id を保存する
export type Course = string;
export interface DrinkPlan { id: string; name: string }
// 最初の一覧（No.90 より前から使っている id なので変えない）
export const DEFAULT_DRINK_PLANS: DrinkPlan[] = [
  { id: 'no_drinks', name: '飲み放題なし' }, { id: 'drinks', name: '飲み放題' }, { id: 'premium_drinks', name: 'プレミアム飲み放題' },
];
// id は英小文字・数字・_ の24文字まで（firestore.rules の isCourseOrNull と同じ）
export function isCourse(value: unknown): value is Course {
  return typeof value === 'string' && /^[a-z0-9_]{1,24}$/.test(value);
}
// 区分の名前。設定で消した区分を使っている卓は「消した区分」と出す
export function drinkPlanName(plans: DrinkPlan[], id: Course): string {
  return plans.find(plan => plan.id === id)?.name ?? '消した区分';
}
// お通しを出さない店（rules.otoshi が false）は、2段目を「ファーストドリンク提供済み」と呼ぶ（段はそのまま残す。No.14）
export function displayOf(status: Status, course: Course | null, rules: Rules = RULES): Display {
  if (course === null) return !rules.otoshi && status === 'otoshi' ? 'first_drink' : status;
  return status === 'seated' ? 'course_wait' : status === 'otoshi' ? 'first_drink' : status;
}
export interface Session {
  id: string;
  tableIds: string[];
  status: Status;
  seatedAt: number;
  otoshiAt: number | null;
  loDoneAt: number | null;
  exitedAt: number | null;
  paidAt: number | null;   // お会計済みの時刻。状態の進み・戻しとは独立
  guests: number | null;   // 人数（団体は全員の合計）。null は未入力
  course: Course | null;   // null は通常。コースは otoshiAt にファーストドリンクの時刻を入れる
  menu: string | null;     // どのコースか（courseMenus の id）。コースのときだけ。null は未選択
  dishesServed: number;    // コースの料理を何品目まで出したか（メニューの順に数える）
  leaveAt: number | null;  // この卓だけ早めに決めた退店の時刻（お席の終わり）。null はふつう（数え始めから120分）。L.O.はその30分前
}
// 店ごとに決める時間のルール（No.14。設定の「時間のルール」で変え、全端末で共有する）。RULES はふだんの値
export interface Rules {
  otoshiWarnMin: number;   // お通し未提供の警告（案内から）
  lastOrderMin: number;    // L.O.（数え始めから）
  seatLimitMin: number;    // お席の時間（数え始めから）
  exitedKeepMin: number;   // 退店済みを卓に残す時間
  otoshi: boolean;         // お通しを出す店か。出さない店は「お通し未提供」の警告を出さない
  timeLimitOff: boolean;   // 店全体で時間制限を切っている（L.O.・お席の時間の警告を出さない。お通しの警告はそのまま）
}
export const RULES: Rules = { otoshiWarnMin: 15, lastOrderMin: 90, seatLimitMin: 120, exitedKeepMin: 5, otoshi: true, timeLimitOff: false };
export type Alert = 'none' | 'soon' | 'now';
export type AlertReason = 'otoshi_missing' | 'last_order' | 'seat_limit' | null;
// 警告の理由の名前（卓カードの札・詳細パネルで同じものを使う）
export const REASON_LABEL: Record<Exclude<AlertReason, null>, string> = { otoshi_missing: 'お通し未提供', last_order: 'L.O.の時間', seat_limit: 'お席の時間' };
const MINUTE = 60_000;
export function newSession(id: string, tableId: string, at: number, guests: number | null = null, course: Course | null = null, menu: string | null = null): Session {
  return { id, tableIds: [tableId], status: 'seated', seatedAt: at, otoshiAt: null, loDoneAt: null, exitedAt: null, paidAt: null, guests, course,
    menu: course !== null && menuOf(menu) ? menu : null, dishesServed: 0, leaveAt: null };
}
export const GUESTS_MAX = 99;
export function isGuestCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= GUESTS_MAX;
}
export function setGuests(session: Session, guests: number | null): Session | null {
  return guests === null || isGuestCount(guests) ? { ...session, guests } : null;
}
// 案内のあとで通常とコースを直す。時刻はそのまま（コースにするとお通しの時刻をファーストドリンクとして読む）。
// 通常に戻したら、どのコースか・料理の進みも消す
export function setCourse(session: Session, course: Course | null): Session | null {
  if (course === null) return { ...session, course, menu: null, dishesServed: 0 };
  return isCourse(course) ? { ...session, course } : null;
}
// どのコースかを選び直す。選び間違いを直すときのために、出した品数はそのまま（新しいメニューの品数までに収める）
export function setMenu(session: Session, menu: string | null): Session | null {
  if (menu === null) return { ...session, menu, dishesServed: 0 };
  const chosen = menuOf(menu);
  if (session.course === null || !chosen) return null;
  return { ...session, menu, dishesServed: Math.min(session.dishesServed, chosen.dishes.length) };
}
// コースの料理の進み。served 品目まで出していて、next が次に出す料理（全部出したら null）
export function dishProgress(session: Session): { served: number; total: number; next: string | null } | null {
  const menu = session.course === null ? null : menuOf(session.menu);
  if (!menu) return null;
  const served = Math.min(session.dishesServed, menu.dishes.length);
  return { served, total: menu.dishes.length, next: menu.dishes[served] ?? null };
}
// 料理はメニューの順に1品ずつ進める・戻す
export function serveDish(session: Session): Session | null {
  const progress = dishProgress(session);
  return progress && progress.next !== null ? { ...session, dishesServed: progress.served + 1 } : null;
}
export function unserveDish(session: Session): Session | null {
  const progress = dishProgress(session);
  return progress && progress.served > 0 ? { ...session, dishesServed: progress.served - 1 } : null;
}
export function nextStatus(s: Status): Status | null {
  return { seated: 'otoshi', otoshi: 'lo_done', lo_done: 'exited', exited: null }[s] as Status | null;
}
export function advance(session: Session, at: number): Session {
  switch (session.status) {
    case 'seated': return { ...session, status: 'otoshi', otoshiAt: at };
    case 'otoshi': return { ...session, status: 'lo_done', loDoneAt: at };
    case 'lo_done': return { ...session, status: 'exited', exitedAt: at };
    case 'exited': return session;
  }
}
export function revert(session: Session): Session | null {
  switch (session.status) {
    case 'seated': return null;
    case 'otoshi': return { ...session, status: 'seated', otoshiAt: null };
    case 'lo_done': return { ...session, status: 'otoshi', loDoneAt: null };
    case 'exited': return { ...session, status: 'lo_done', exitedAt: null };
  }
}
// L.O.・お席の時間を数え始める時刻。通常は案内、コースはファーストドリンク（全員が揃うまでは数えない）
export function startOf(session: Session): number | null {
  return session.course === null ? session.seatedAt : session.otoshiAt;
}
// 退店までは startOf から通しで数える。コースの開始待ちは null（タイマーを進めない）
export function timerOf(session: Session, now: number): { label: string; elapsedMs: number | null } {
  if (session.status === 'exited') return { label: '退店から', elapsedMs: Math.max(0, now - (session.exitedAt ?? now)) };
  const start = startOf(session);
  return { label: session.course === null ? '案内から' : 'ファーストドリンクから', elapsedMs: start === null ? null : Math.max(0, now - start) };
}
// お席の終わり（退店の時刻）と L.O. の時刻。ふつうは数え始めからお席の時間（120分）・L.O.（90分）。
// 退店の時刻を決めた卓（leaveAt）はその時刻と、その「お席の時間 − L.O.」（30分）前。コースの開始待ちは数えないので null
export function limitsOf(session: Session, rules: Rules = RULES): { lastOrderAt: number; seatEndAt: number } | null {
  const start = startOf(session);
  if (start === null) return null;
  const seatEndAt = session.leaveAt ?? start + rules.seatLimitMin * MINUTE;
  return { lastOrderAt: seatEndAt - (rules.seatLimitMin - rules.lastOrderMin) * MINUTE, seatEndAt };
}
export function alertOf(session: Session, now: number, rules: Rules = RULES): { level: Alert; reason: AlertReason } {
  const { timeLimitOff } = rules;
  const start = startOf(session);
  const limits = limitsOf(session, rules);
  if (session.status === 'exited' || start === null || limits === null) return { level: 'none', reason: null };
  if (!timeLimitOff && now >= limits.seatEndAt) return { level: 'now', reason: 'seat_limit' };
  // コース・お通しを出さない店は「お通し未提供」を出さない
  if (rules.otoshi && session.status === 'seated' && session.course === null && now - start >= rules.otoshiWarnMin * MINUTE) return { level: 'now', reason: 'otoshi_missing' };
  if (!timeLimitOff && session.status === 'otoshi' && now >= limits.lastOrderAt) return { level: 'soon', reason: 'last_order' };
  return { level: 'none', reason: null };
}
// この卓だけ退店の時刻を決める・ふつうに戻す（null）。案内より前の時刻は null
export function setLeaveAt(session: Session, at: number | null): Session | null {
  return at === null || at > session.seatedAt ? { ...session, leaveAt: at } : null;
}
// L.O. の時間を過ぎても L.O.確認済みにしていないセッション（数え始めが古い順）
// お通し前の卓は「お通し未提供」で警告済みで、通知の「L.O.確認済みにする」では状態が合わないので出さない
// （コースはファーストドリンクから数えるので、開始待ちの卓はそもそも時間が来ない）
// 店全体で時間制限を切っているときは出さない
export function lastOrderDue(sessions: Session[], now: number, rules: Rules = RULES): Session[] {
  if (rules.timeLimitOff) return [];
  return sessions
    .flatMap(s => { const start = startOf(s); const limits = limitsOf(s, rules); return s.status === 'otoshi' && start !== null && limits !== null && now >= limits.lastOrderAt ? [{ s, start }] : []; })
    .sort((a, b) => a.start - b.start)
    .map(({ s }) => s);
}
// 卓の付け替え・追加・外す。卓番は数値順に並べる（どの端末でも同じ表示にする）
const byNumber = (ids: string[]) => [...new Set(ids)].sort((a, b) => Number(a) - Number(b));
export function moveTable(session: Session, from: string, to: string): Session | null {
  if (!session.tableIds.includes(from) || session.tableIds.includes(to)) return null;
  return { ...session, tableIds: byNumber(session.tableIds.map(id => id === from ? to : id)) };
}
export function addTable(session: Session, tableId: string): Session | null {
  if (session.tableIds.includes(tableId)) return null;
  return { ...session, tableIds: byNumber([...session.tableIds, tableId]) };
}
export function removeTable(session: Session, tableId: string): Session | null {
  if (!session.tableIds.includes(tableId) || session.tableIds.length <= 1) return null;
  return { ...session, tableIds: session.tableIds.filter(id => id !== tableId) };
}
export function togglePaid(session: Session, at: number): Session {
  return { ...session, paidAt: session.paidAt === null ? at : null };
}
export function isVisible(session: Session, now: number, rules: Rules = RULES): boolean {
  return session.status !== 'exited' || (session.exitedAt !== null && now - session.exitedAt < rules.exitedKeepMin * MINUTE);
}
// 卓に出すお客さん：その卓を含む表示中のセッションのうち、最後に案内したもの
export function occupantOf(sessions: Session[], tableId: string, now: number, rules: Rules = RULES): Session | undefined {
  return sessions.filter(s => s.tableIds.includes(tableId) && isVisible(s, now, rules))
    .reduce<Session | undefined>((latest, s) => !latest || s.seatedAt > latest.seatedAt ? s : latest, undefined);
}
// 全卓消去の警告用：まだお店にいて会計していない客の卓数（退店済は数えない）
export function unpaidTableCount(sessions: Session[], now: number, rules: Rules = RULES): number {
  return sessions.filter(s => isVisible(s, now, rules) && s.status !== 'exited' && s.paidAt === null)
    .reduce((count, s) => count + s.tableIds.length, 0);
}
export function formatElapsed(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(seconds / 60);
  const tail = `${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return minutes < 60 ? tail : `${Math.floor(minutes / 60)}:${tail}`;
}
export function formatClock(ms: number): string {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
// "HH:MM" を near に最も近い日付の時刻にする（日付をまたぐ営業に対応）
export function clockTimeNear(hhmm: string, near: number): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  const candidates = [-1, 0, 1].map(offset => {
    const date = new Date(near);
    date.setDate(date.getDate() + offset);
    date.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return date.getTime();
  });
  return candidates.reduce((best, c) => Math.abs(c - near) < Math.abs(best - near) ? c : best);
}
export type EditableTime = 'seatedAt' | 'otoshiAt';
// 案内 ≤ お通し ≤ L.O.確認・退店・現在 の順を崩す修正は null
export function editTime(session: Session, field: EditableTime, at: number, now: number): Session | null {
  if (field === 'otoshiAt' && session.otoshiAt === null) return null;
  const edited = { ...session, [field]: at };
  const upper = Math.min(now, edited.loDoneAt ?? Infinity, edited.exitedAt ?? Infinity);
  const otoshiAt = edited.otoshiAt ?? edited.seatedAt;
  return edited.seatedAt <= otoshiAt && otoshiAt <= upper ? edited : null;
}
