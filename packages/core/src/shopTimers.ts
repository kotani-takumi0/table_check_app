import type { SyncState } from './store';

// 卓とは別の、店全体で周期的にやる作業のタイマー。店が設定で決める（No.91。ShopSettings の shopTimers）
// ヘッダーは幅が無いので icon だけ出し、label は読み上げと通知に使う
export type ShopTimerId = string;
export interface ShopTimer { id: ShopTimerId; label: string; icon: string; intervalMin: number }
// 最初の一覧（No.91 より前から使っている id なので変えない。前の版のアプリはこの2つだけを知っている）
export const DEFAULT_SHOP_TIMERS: ShopTimer[] = [
  { id: 'toilet_check', label: 'トイレチェック', icon: '👀', intervalMin: 30 },
  { id: 'toilet_clean', label: 'トイレ清掃', icon: '🧽', intervalMin: 120 },
];
// ヘッダーに並ぶので4つまで。間隔の範囲と1回で動かす分（firestore.rules の shopTimers・shopSettings も同じ）
export const SHOP_TIMER_LIMITS = { timers: 4, label: 12, icon: 8, minInterval: 5, maxInterval: 480, step: 5 } as const;
export type ShopTimerDone = Partial<Record<ShopTimerId, number>>;
const MINUTE = 60_000;

// 一度も済にしていなければ、すぐにやる時間として扱う
export function shopTimerState(intervalMin: number, doneAt: number | undefined, now: number): { due: boolean; dueAt: number; remainingMs: number } {
  const dueAt = doneAt === undefined ? 0 : doneAt + intervalMin * MINUTE;
  return { due: now >= dueAt, dueAt, remainingMs: Math.max(0, dueAt - now) };
}
// id は英小文字・数字・_ の24文字まで（firestore.rules の shopTimers と同じ形）
export function isShopTimerId(id: string): id is ShopTimerId {
  return /^[a-z0-9_]{1,24}$/.test(id);
}
// タイマーを保存する前に確かめる。直すべきことを、お店の人が読める言葉で返す（空なら保存できる）
export function shopTimerProblems(timer: ShopTimer): string[] {
  const problems: string[] = [];
  if (timer.label.trim() === '' || timer.label.length > SHOP_TIMER_LIMITS.label) problems.push(`名前は1〜${SHOP_TIMER_LIMITS.label}文字にしてください`);
  if (timer.icon.trim() === '' || timer.icon.length > SHOP_TIMER_LIMITS.icon) problems.push('アイコン（絵文字1つ）を入れてください');
  if (!Number.isInteger(timer.intervalMin) || timer.intervalMin < SHOP_TIMER_LIMITS.minInterval || timer.intervalMin > SHOP_TIMER_LIMITS.maxInterval) problems.push('間隔が範囲の外です');
  return problems;
}
// タイマーの一覧を読む。壊れたタイマー・同じ id は落とす。一覧そのものが無い・壊れているときは最初の一覧（空の一覧はそのまま）
export function parseShopTimers(value: unknown): ShopTimer[] {
  if (!Array.isArray(value)) return DEFAULT_SHOP_TIMERS;
  const timers: ShopTimer[] = [];
  for (const item of value.slice(0, SHOP_TIMER_LIMITS.timers)) {
    const t = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {};
    const timer = { id: String(t.id ?? ''), label: String(t.label ?? ''), icon: String(t.icon ?? ''), intervalMin: typeof t.intervalMin === 'number' ? t.intervalMin : NaN };
    if (isShopTimerId(timer.id) && !timers.some(other => other.id === timer.id) && shopTimerProblems(timer).length === 0) timers.push(timer);
  }
  return timers;
}
// 間隔を step ずつ変える。範囲の外は null
export function stepInterval(timer: ShopTimer, direction: 1 | -1): ShopTimer | null {
  const intervalMin = timer.intervalMin + direction * SHOP_TIMER_LIMITS.step;
  return intervalMin < SHOP_TIMER_LIMITS.minInterval || intervalMin > SHOP_TIMER_LIMITS.maxInterval ? null : { ...timer, intervalMin };
}
export function newShopTimerId(timers: ShopTimer[], now: number): string {
  for (let n = now; ; n++) { const id = `timer_${n.toString(36)}`; if (!timers.some(timer => timer.id === id)) return id; }
}

export interface ShopTimerStore {
  subscribe(cb: (done: ShopTimerDone) => void): () => void;
  markDone(id: ShopTimerId, at: number): Promise<void>;
  subscribeSync?(cb: (state: SyncState) => void): () => void;
}
// タイマーごとに新しいほうの時刻を残す（別タブの書き込みを消さない）
export function mergeShopTimerDone(a: ShopTimerDone, b: ShopTimerDone): ShopTimerDone {
  const merged: ShopTimerDone = { ...a };
  for (const [id, at] of Object.entries(b) as [ShopTimerId, number][]) merged[id] = Math.max(merged[id] ?? -Infinity, at);
  return merged;
}
export function parseDoneAt(value: string | null): number | undefined {
  const at = value === null ? NaN : Number(value);
  return Number.isFinite(at) && value !== '' ? at : undefined;
}
