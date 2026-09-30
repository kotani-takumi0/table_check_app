import type { User } from 'firebase/auth';
import { collection, doc, onSnapshot, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { isShopTimerId, type ShopTimerDone, type ShopTimerId, type ShopTimerStore } from './shopTimers';
import type { SyncState } from './store';

// shopTimers/{タイマーID} に最後に済にした時刻を持ち、全端末で共有する
export class FirestoreShopTimerStore implements ShopTimerStore {
  private ready: Promise<boolean>;
  private done: ShopTimerDone = {};
  private syncState: SyncState = 'offline';
  private subscribers = new Set<(done: ShopTimerDone) => void>();
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
      unsubscribe = onSnapshot(collection(this.db, 'shopTimers'), { includeMetadataChanges: true }, snapshot => {
        const done: ShopTimerDone = {};
        for (const item of snapshot.docs) {
          const doneAt: unknown = item.data().doneAt;
          if (isShopTimerId(item.id) && typeof doneAt === 'number' && Number.isFinite(doneAt)) done[item.id] = doneAt;
        }
        this.done = done;
        this.syncState = snapshot.metadata.fromCache ? 'offline' : snapshot.metadata.hasPendingWrites ? 'pending' : 'synced';
        this.subscribers.forEach(cb => cb(done));
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
  subscribe(cb: (done: ShopTimerDone) => void): () => void {
    this.subscribers.add(cb);
    this.start();
    cb(this.done);
    return () => { this.subscribers.delete(cb); this.stopIfUnused(); };
  }
  subscribeSync(cb: (state: SyncState) => void): () => void {
    this.syncSubscribers.add(cb);
    this.start();
    cb(this.syncState);
    return () => { this.syncSubscribers.delete(cb); this.stopIfUnused(); };
  }
  async markDone(id: ShopTimerId, at: number): Promise<void> {
    if (!await this.ready) return;
    // オフラインだと commit が終わらないので待たない。古い時刻の書き込みはルールで拒否され、画面はサーバの値に戻る
    void setDoc(doc(this.db, 'shopTimers', id), { doneAt: at, updatedAt: serverTimestamp() }).catch(error => console.error(error));
  }
}
