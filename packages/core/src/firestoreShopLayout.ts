import type { User } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { DEFAULT_LAYOUT, parseShopLayout, seatIdsOf, type ShopLayout, type ShopLayoutStore } from './shopLayout';

// shopLayout/main に席の配置を持ち、全端末で共有する。まだ無い・壊れているときは今までの配置（DEFAULT_LAYOUT）を使う
export class FirestoreShopLayoutStore implements ShopLayoutStore {
  private ready: Promise<boolean>;
  constructor(private db: Firestore, userReady: Promise<User>) {
    this.ready = userReady.then(() => true, () => false);
  }
  subscribe(cb: (layout: ShopLayout) => void): () => void {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    cb(DEFAULT_LAYOUT);
    void this.ready.then(ready => {
      if (!ready || cancelled) return;
      unsubscribe = onSnapshot(doc(this.db, 'shopLayout', 'main'), snapshot => cb(parseShopLayout(snapshot.data()) ?? DEFAULT_LAYOUT), error => console.error(error));
    });
    return () => { cancelled = true; unsubscribe?.(); };
  }
  async save(layout: ShopLayout): Promise<void> {
    if (!await this.ready) return;
    // seatIds はルールが「案内できる卓か」を確かめるのに使う
    void setDoc(doc(this.db, 'shopLayout', 'main'), { seats: layout.seats, labels: layout.labels, seatIds: seatIdsOf(layout), updatedAt: serverTimestamp() }).catch(error => console.error(error));
  }
}
