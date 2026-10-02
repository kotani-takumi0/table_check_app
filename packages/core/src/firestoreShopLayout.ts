import type { User } from 'firebase/auth';
import { collection, doc, getDocFromServer, getDocsFromServer, onSnapshot, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { now } from './clock';
import { fromSessionDoc } from './firestoreMapping';
import type { Rules } from './domain';
import { DEFAULT_LAYOUT, occupiedSeatIds, parseShopLayout, seatIdsOf, type ShopLayout, type ShopLayoutStore } from './shopLayout';
import { GUEST_BASE, shopPath, type ShopBase } from './shopPath';

// shopLayout/main に席の配置を持ち、全端末で共有する。まだ無い・壊れているときは今までの配置（DEFAULT_LAYOUT）を使う
const SAVE_WAIT_MS = 4000;
export class FirestoreShopLayoutStore implements ShopLayoutStore {
  private ready: Promise<boolean>;
  constructor(private db: Firestore, userReady: Promise<User>, private base: ShopBase = GUEST_BASE) {
    this.ready = userReady.then(() => true, () => false);
  }
  subscribe(cb: (layout: ShopLayout) => void): () => void {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    cb(DEFAULT_LAYOUT);
    void this.ready.then(ready => {
      if (!ready || cancelled) return;
      unsubscribe = onSnapshot(doc(this.db, shopPath(this.base, 'shopLayout'), 'main'), snapshot => cb(parseShopLayout(snapshot.data()) ?? DEFAULT_LAYOUT), error => console.error(error));
    });
    return () => { cancelled = true; unsubscribe?.(); };
  }
  async save(layout: ShopLayout, rules?: Rules): Promise<void> {
    if (!await this.ready) throw new Error('ログインできていないので保存できません');
    let occupied = new Set<string>();
    try {
      // クエリと配置の書き込みは同じトランザクションにできないので、直前にサーバーで確かめる
      const snapshot = await getDocsFromServer(collection(this.db, shopPath(this.base, 'tables')));
      const tables: Record<string, string | null> = Object.fromEntries(snapshot.docs.map(table => {
        const sessionId: unknown = table.data().sessionId;
        return [table.id, typeof sessionId === 'string' && sessionId !== '' ? sessionId : null];
      }));
      const ids = [...new Set(Object.values(tables).filter((id): id is string => id !== null))];
      const documents = await Promise.all(ids.map(id => getDocFromServer(doc(this.db, shopPath(this.base, 'sessions'), id))));
      const sessions = documents.flatMap(document => {
        const session = fromSessionDoc(document.id, document.data());
        return session ? [session] : [];
      });
      occupied = occupiedSeatIds(tables, sessions, now(), rules);
    } catch {
      // オフラインなどで読めないときは手元の確認に任せ、今までどおり書き込みを送信待ちにする
    }
    // 使用中の卓を消すエラーは、読み込み失敗として扱わず保存を止める
    const missing = [...occupied].filter(id => !layout.seats.some(seat => seat.id === id)).sort((a, b) => Number(a) - Number(b));
    if (missing.length) throw new Error(`${missing.join('・')}番にお客さんがいます`);
    // seatIds はルールが「案内できる卓か」を確かめるのに使う。
    // ルールに拒否されたら失敗を返す（編集画面は下書きを残す）。オフラインだと終わらないので、少し待って返事が無ければ送信待ちとして成功にする
    const write = setDoc(doc(this.db, shopPath(this.base, 'shopLayout'), 'main'), { seats: layout.seats, labels: layout.labels, seatIds: seatIdsOf(layout), updatedAt: serverTimestamp() });
    await Promise.race([write, new Promise<void>(resolve => setTimeout(resolve, SAVE_WAIT_MS))]);
  }
}
