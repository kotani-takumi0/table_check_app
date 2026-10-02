import { DEFAULT_SHOP_TIMERS, mergeShopTimerDone, parseDoneAt, type ShopTimerDone, type ShopTimerId, type ShopTimerStore } from '@table-check/core/shopTimers';

// タイマーごとに別のキーへ保存し、別タブが別のタイマーを済にしても上書きし合わない
const PREFIX = 'table-check:shopTimer:';
export class LocalShopTimerStore implements ShopTimerStore {
  private subscribers = new Set<(done: ShopTimerDone) => void>();
  // 保存できない環境でも、このページの中では済にした結果を保つ
  private current: ShopTimerDone = {};
  private read(): ShopTimerDone {
    const done: ShopTimerDone = {};
    // 店が設定で足したタイマー（No.91）も読むよう、保存されているキーを探す（最初の2つは必ず見る）
    const ids = new Set(DEFAULT_SHOP_TIMERS.map(timer => timer.id));
    try {
      for (let i = 0; i < (window.localStorage.length ?? 0); i++) {
        const key = window.localStorage.key(i);
        if (key?.startsWith(PREFIX)) ids.add(key.slice(PREFIX.length));
      }
    } catch { /* 探せないときは最初の2つだけ読む */ }
    for (const id of ids) {
      try {
        const at = parseDoneAt(window.localStorage.getItem(PREFIX + id));
        if (at !== undefined) done[id] = at;
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
