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
const KEY = 'table-check:shopTimers';
export function parseShopTimerDone(value: unknown): ShopTimerDone {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, at]) => isShopTimerId(id) && typeof at === 'number' && Number.isFinite(at)));
}
export class LocalShopTimerStore implements ShopTimerStore {
  private subscribers = new Set<(done: ShopTimerDone) => void>();
  // 保存できない環境でも、このページの中では済にした結果を保つ
  private current: ShopTimerDone | null = null;
  private read(): ShopTimerDone {
    try { return parseShopTimerDone(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')); }
    catch { return {}; }
  }
  private state(): ShopTimerDone {
    this.current ??= this.read();
    return this.current;
  }
  private onStorage = (event: StorageEvent): void => {
    if (event.key !== KEY && event.key !== null) return;
    this.current = this.read();
    this.subscribers.forEach(cb => cb(this.state()));
  };
  subscribe(cb: (done: ShopTimerDone) => void): () => void {
    if (this.subscribers.size === 0) window.addEventListener('storage', this.onStorage);
    this.subscribers.add(cb);
    cb(this.state());
    return () => {
      this.subscribers.delete(cb);
      if (this.subscribers.size === 0) window.removeEventListener('storage', this.onStorage);
    };
  }
  async markDone(id: ShopTimerId, at: number): Promise<void> {
    this.current = { ...this.state(), [id]: at };
    try { window.localStorage.setItem(KEY, JSON.stringify(this.current)); } catch { /* 保存できなくてもこのページでは保つ */ }
    this.subscribers.forEach(cb => cb(this.state()));
  }
}
