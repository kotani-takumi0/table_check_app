import type { SyncState } from './store';

// 店全体の設定。全端末で共有する（Firestore の shopSettings/main）
export interface ShopSettings {
  // 空いている日などに、L.O.・お席の時間の通知と色を止める（経過の時間・お通しの警告はそのまま）。
  // 空いているかどうかは日によって違うので、自動では切り替えず、人がオン・オフする
  timeLimitOff: boolean;
}
export const DEFAULT_SHOP_SETTINGS: ShopSettings = { timeLimitOff: false };
// 保存された値を読む。壊れた値や無い項目は既定値にする
export function parseShopSettings(data: unknown): ShopSettings {
  const d = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
  return { timeLimitOff: d.timeLimitOff === true };
}
export interface ShopSettingsStore {
  subscribe(cb: (settings: ShopSettings) => void): () => void;
  setTimeLimitOff(off: boolean): Promise<void>;
  subscribeSync?(cb: (state: SyncState) => void): () => void;
}
// Firebase につながずに試すときの保存先。アプリを開いている間だけ覚える
export class MemoryShopSettingsStore implements ShopSettingsStore {
  private settings = DEFAULT_SHOP_SETTINGS;
  private subscribers = new Set<(settings: ShopSettings) => void>();
  subscribe(cb: (settings: ShopSettings) => void): () => void {
    this.subscribers.add(cb);
    cb(this.settings);
    return () => { this.subscribers.delete(cb); };
  }
  async setTimeLimitOff(off: boolean): Promise<void> {
    this.settings = { ...this.settings, timeLimitOff: off };
    this.subscribers.forEach(cb => cb(this.settings));
  }
}
