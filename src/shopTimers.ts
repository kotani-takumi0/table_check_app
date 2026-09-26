import type { SyncState } from './store';

// 卓とは別の、店全体で周期的にやる作業のタイマー
export const SHOP_TIMERS = [
  { id: 'toilet_check', label: 'トイレチェック', intervalMin: 30 },
  { id: 'toilet_clean', label: 'トイレ清掃', intervalMin: 120 },
] as const;
export type ShopTimerId = typeof SHOP_TIMERS[number]['id'];
export type ShopTimerDone = Partial<Record<ShopTimerId, number>>;
const MINUTE = 60_000;

// 一度も済にしていなければ、すぐにやる時間として扱う
export function shopTimerState(intervalMin: number, doneAt: number | undefined, now: number): { due: boolean; dueAt: number; remainingMs: number } {
  const dueAt = doneAt === undefined ? 0 : doneAt + intervalMin * MINUTE;
  return { due: now >= dueAt, dueAt, remainingMs: Math.max(0, dueAt - now) };
}
export function isShopTimerId(id: string): id is ShopTimerId {
  return SHOP_TIMERS.some(timer => timer.id === id);
}

export interface ShopTimerStore {
  subscribe(cb: (done: ShopTimerDone) => void): () => void;
  markDone(id: ShopTimerId, at: number): Promise<void>;
  subscribeSync?(cb: (state: SyncState) => void): () => void;
}
// タイマーごとに別のキーへ保存し、別タブが別のタイマーを済にしても上書きし合わない
const PREFIX = 'table-check:shopTimer:';
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
export class LocalShopTimerStore implements ShopTimerStore {
  private subscribers = new Set<(done: ShopTimerDone) => void>();
  // 保存できない環境でも、このページの中では済にした結果を保つ
  private current: ShopTimerDone = {};
  private read(): ShopTimerDone {
    const done: ShopTimerDone = {};
    for (const timer of SHOP_TIMERS) {
      try {
        const at = parseDoneAt(window.localStorage.getItem(PREFIX + timer.id));
        if (at !== undefined) done[timer.id] = at;
      } catch { /* 読めないタイマーは未実施として扱う */ }
    }
    return done;
  }
  private sync(): ShopTimerDone {
    this.current = mergeShopTimerDone(this.current, this.read());
    return this.current;
  }
  private onStorage = (event: StorageEvent): void => {
    if (event.key !== null && !event.key.startsWith(PREFIX)) return;
    const done = this.sync();
    this.subscribers.forEach(cb => cb(done));
  };
  subscribe(cb: (done: ShopTimerDone) => void): () => void {
    if (this.subscribers.size === 0) window.addEventListener('storage', this.onStorage);
    this.subscribers.add(cb);
    cb(this.sync());
    return () => {
      this.subscribers.delete(cb);
      if (this.subscribers.size === 0) window.removeEventListener('storage', this.onStorage);
    };
  }
  async markDone(id: ShopTimerId, at: number): Promise<void> {
    const done = mergeShopTimerDone(this.sync(), { [id]: at });
    this.current = done;
    try { window.localStorage.setItem(PREFIX + id, String(done[id])); } catch { /* 保存できなくてもこのページでは保つ */ }
    this.subscribers.forEach(cb => cb(done));
  }
}
