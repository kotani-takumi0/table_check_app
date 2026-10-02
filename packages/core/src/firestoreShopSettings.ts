import type { User } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { DEFAULT_SHOP_SETTINGS, parseShopSettings, type ShopSettings, type ShopSettingsStore } from './shopSettings';
import type { SyncState } from './store';

// shopSettings/main に店全体の設定を持ち、全端末で共有する（FirestoreShopTimerStore と同じ購読の仕方）
export class FirestoreShopSettingsStore implements ShopSettingsStore {
  private ready: Promise<boolean>;
  private settings: ShopSettings = DEFAULT_SHOP_SETTINGS;
  private syncState: SyncState = 'offline';
  private subscribers = new Set<(settings: ShopSettings) => void>();
  private syncSubscribers = new Set<(state: SyncState) => void>();
  private stop: (() => void) | null = null;
  constructor(private db: Firestore, userReady: Promise<User>) {
    this.ready = userReady.then(() => true, () => false);
  }
  private start(): void {
    if (this.stop) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    this.stop = () => { cancelled = true; unsubscribe?.(); };
    void this.ready.then(ready => {
      if (!ready || cancelled) return;
      unsubscribe = onSnapshot(doc(this.db, 'shopSettings', 'main'), { includeMetadataChanges: true }, snapshot => {
        this.settings = parseShopSettings(snapshot.data());
        this.syncState = snapshot.metadata.fromCache ? 'offline' : snapshot.metadata.hasPendingWrites ? 'pending' : 'synced';
        this.subscribers.forEach(cb => cb(this.settings));
        this.syncSubscribers.forEach(cb => cb(this.syncState));
      }, error => {
        console.error(error);
        this.syncState = 'offline';
        this.syncSubscribers.forEach(cb => cb(this.syncState));
      });
    });
  }
  private stopIfUnused(): void {
    if (this.subscribers.size || this.syncSubscribers.size) return;
    this.stop?.();
    this.stop = null;
    this.syncState = 'offline';
  }
  subscribe(cb: (settings: ShopSettings) => void): () => void {
    this.subscribers.add(cb);
    this.start();
    cb(this.settings);
    return () => { this.subscribers.delete(cb); this.stopIfUnused(); };
  }
  subscribeSync(cb: (state: SyncState) => void): () => void {
    this.syncSubscribers.add(cb);
    this.start();
    cb(this.syncState);
    return () => { this.syncSubscribers.delete(cb); this.stopIfUnused(); };
  }
  async update(change: Partial<ShopSettings>): Promise<void> {
    if (!await this.ready) return;
    // 変えた項目だけを書き、ほかの項目は残す（merge）。オフラインだと commit が終わらないので待たない
    void setDoc(doc(this.db, 'shopSettings', 'main'), { ...change, updatedAt: serverTimestamp() }, { merge: true }).catch(error => console.error(error));
  }
}
