import type { User } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { DEFAULT_LAYOUT, parseShopLayout, seatIdsOf, type ShopLayout, type ShopLayoutStore } from './shopLayout';

// shopLayout/main に席の配置を持ち、全端末で共有する。まだ無い・壊れているときは今までの配置（DEFAULT_LAYOUT）を使う
const SAVE_WAIT_MS = 4000;
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
    if (!await this.ready) throw new Error('ログインできていないので保存できません');
    // seatIds はルールが「案内できる卓か」を確かめるのに使う。
    // ルールに拒否されたら失敗を返す（編集画面は下書きを残す）。オフラインだと終わらないので、少し待って返事が無ければ送信待ちとして成功にする
    const write = setDoc(doc(this.db, 'shopLayout', 'main'), { seats: layout.seats, labels: layout.labels, seatIds: seatIdsOf(layout), updatedAt: serverTimestamp() });
    await Promise.race([write, new Promise<void>(resolve => setTimeout(resolve, SAVE_WAIT_MS))]);
  }
}
