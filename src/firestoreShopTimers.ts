import type { User } from 'firebase/auth';
import { collection, doc, onSnapshot, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { isShopTimerId, type ShopTimerDone, type ShopTimerId, type ShopTimerStore } from './shopTimers';

// shopTimers/{タイマーID} に最後に済にした時刻を持ち、全端末で共有する
export class FirestoreShopTimerStore implements ShopTimerStore {
  private ready: Promise<boolean>;
  constructor(private db: Firestore, userReady: Promise<User>) {
    this.ready = userReady.then(() => true, () => false);
  }
  subscribe(cb: (done: ShopTimerDone) => void): () => void {
    let stop: (() => void) | null = null;
    let cancelled = false;
    void this.ready.then(ready => {
      if (!ready || cancelled) return;
      stop = onSnapshot(collection(this.db, 'shopTimers'), snapshot => {
        const done: ShopTimerDone = {};
        for (const item of snapshot.docs) {
          const doneAt: unknown = item.data().doneAt;
          if (isShopTimerId(item.id) && typeof doneAt === 'number' && Number.isFinite(doneAt)) done[item.id] = doneAt;
        }
        cb(done);
      }, error => console.error(error));
    });
    return () => { cancelled = true; stop?.(); };
  }
  async markDone(id: ShopTimerId, at: number): Promise<void> {
    if (!await this.ready) return;
    // オフラインだと commit が終わらないので待たない
    void setDoc(doc(this.db, 'shopTimers', id), { doneAt: at, updatedAt: serverTimestamp() }).catch(error => console.error(error));
  }
}
