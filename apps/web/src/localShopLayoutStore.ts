import { DEFAULT_LAYOUT, parseShopLayout, type ShopLayout, type ShopLayoutStore } from '@table-check/core/shopLayout';

// Firebase の設定が無いときに使う、この端末のブラウザだけの保存先（同じブラウザの別タブにも反映する）
const KEY = 'table-check:shopLayout';
export class LocalShopLayoutStore implements ShopLayoutStore {
  private subscribers = new Set<(layout: ShopLayout) => void>();
  private current: ShopLayout | null = null;
  private read(): ShopLayout {
    try { return parseShopLayout(JSON.parse(window.localStorage.getItem(KEY) ?? 'null')) ?? DEFAULT_LAYOUT; }
    catch { return DEFAULT_LAYOUT; }
  }
  private onStorage = (event: StorageEvent): void => {
    if (event.key !== KEY && event.key !== null) return;
    this.current = this.read();
    this.subscribers.forEach(cb => cb(this.current!));
  };
  subscribe(cb: (layout: ShopLayout) => void): () => void {
    if (this.subscribers.size === 0) window.addEventListener('storage', this.onStorage);
    this.subscribers.add(cb);
    this.current ??= this.read();
    cb(this.current);
    return () => {
      this.subscribers.delete(cb);
      if (this.subscribers.size === 0) window.removeEventListener('storage', this.onStorage);
    };
  }
  async save(layout: ShopLayout): Promise<void> {
    this.current = layout;
    try { window.localStorage.setItem(KEY, JSON.stringify(layout)); } catch { /* 保存できなくてもこのページでは保つ */ }
    this.subscribers.forEach(cb => cb(layout));
  }
}
