import type { User } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { now } from './clock';
import { EDITING_HEARTBEAT_MS, EDITING_STALE_MS, type EditingMark, type EditingStore } from './editing';
import { GUEST_BASE, shopPath, type ShopBase } from './shopPath';

// editing/{端末ID} に、その端末が詳細を開いているお客さんを持つ。端末ID はアプリを開くたびに作る（保存しない）
export class FirestoreEditingStore implements EditingStore {
  private ready: Promise<boolean>;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private current: string | null = null;
  // 消しに行った古い印（同じ文書を何度も消しに行かない）
  private removing = new Set<string>();
  constructor(private db: Firestore, userReady: Promise<User>, private deviceId: string, private base: ShopBase = GUEST_BASE) {
    this.ready = userReady.then(() => true, () => false);
  }
  subscribe(cb: (marks: EditingMark[]) => void): () => void {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    cb([]);
    void this.ready.then(ready => {
      if (!ready || cancelled) return;
      unsubscribe = onSnapshot(collection(this.db, shopPath(this.base, 'editing')), snapshot => {
        cb(snapshot.docs.flatMap(item => {
          const data = item.data({ serverTimestamps: 'estimate' });
          const at: unknown = data.updatedAt?.toMillis?.();
          if (item.id === this.deviceId) return [];
          // 閉じずに落ちた端末の古い印は消す。消えると次の snapshot から外れる
          if (typeof at === 'number' && now() - at > EDITING_STALE_MS && !this.removing.has(item.id)) {
            this.removing.add(item.id);
            void deleteDoc(item.ref).catch(error => console.error(error));
          }
          return typeof data.sessionId === 'string' && typeof at === 'number' ? [{ sessionId: data.sessionId, at }] : [];
        }));
      }, error => console.error(error));
    });
    return () => { cancelled = true; unsubscribe?.(); };
  }
  setEditing(sessionId: string | null): void {
    if (sessionId === this.current) return;
    this.current = sessionId;
    if (this.heartbeat !== null) clearInterval(this.heartbeat);
    this.heartbeat = null;
    const ref = doc(this.db, shopPath(this.base, 'editing'), this.deviceId);
    void this.ready.then(ready => {
      if (!ready || this.current !== sessionId) return;
      // オフラインだと commit が終わらないので待たない
      if (sessionId === null) { void deleteDoc(ref).catch(error => console.error(error)); return; }
      const write = () => { void setDoc(ref, { sessionId, updatedAt: serverTimestamp() }).catch(error => console.error(error)); };
      write();
      this.heartbeat = setInterval(write, EDITING_HEARTBEAT_MS);
    });
  }
}
// 端末ID：アプリを開くたびに作る。時刻と乱数で十分（ほかの端末とぶつからなければよい）
export function newDeviceId(): string {
  return `${now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
