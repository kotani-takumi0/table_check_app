import { parseShopSettings, type ShopSettings, type ShopSettingsStore } from '@table-check/core/shopSettings';

// Firebase の設定が無いときに使う、この端末のブラウザだけの保存先（同じブラウザの別タブにも反映する）
const KEY = 'table-check:shopSettings';
export class LocalShopSettingsStore implements ShopSettingsStore {
  private subscribers = new Set<(settings: ShopSettings) => void>();
  // 保存できない環境でも、このページの中では切り替えた結果を保つ
  private current: ShopSettings | null = null;
  private read(): ShopSettings {
    try { return parseShopSettings(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')); }
    catch { return parseShopSettings(null); }
  }
  private onStorage = (event: StorageEvent): void => {
    if (event.key !== KEY && event.key !== null) return;
    this.current = this.read();
    this.subscribers.forEach(cb => cb(this.current!));
  };
  subscribe(cb: (settings: ShopSettings) => void): () => void {
    if (this.subscribers.size === 0) window.addEventListener('storage', this.onStorage);
    this.subscribers.add(cb);
    this.current ??= this.read();
    cb(this.current);
    return () => {
      this.subscribers.delete(cb);
      if (this.subscribers.size === 0) window.removeEventListener('storage', this.onStorage);
    };
  }
  async setTimeLimitOff(off: boolean): Promise<void> {
    this.current = { ...(this.current ?? this.read()), timeLimitOff: off };
    try { window.localStorage.setItem(KEY, JSON.stringify(this.current)); } catch { /* 保存できなくてもこのページでは保つ */ }
    this.subscribers.forEach(cb => cb(this.current!));
  }
}
