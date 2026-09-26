import type { User } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, where, writeBatch, type Firestore, type SnapshotMetadata } from 'firebase/firestore';
import { now } from './clock';
import type { Session } from './domain';
import { fromSessionDoc, resolveSessions, tablesToWrite, toSessionDoc } from './firestoreMapping';
import type { SessionStore, SyncState } from './store';

export class FirestoreSessionStore implements SessionStore {
  private tables: Record<string, string | null> = {};
  private sessions: Session[] = [];
  private subscribers = new Set<(sessions: Session[]) => void>();
  private syncSubscribers = new Set<(state: SyncState) => void>();
  private metadata: [SnapshotMetadata | null, SnapshotMetadata | null] = [null, null];
  private stop: (() => void) | null = null;
  private ready: Promise<boolean>;

  constructor(private db: Firestore, userReady: Promise<User>) {
    this.ready = userReady.then(() => true, error => { console.error(error); return false; });
  }
  private syncState(): SyncState {
    if (this.metadata.some(meta => !meta || meta.fromCache)) return 'offline';
    if (this.metadata.some(meta => meta?.hasPendingWrites)) return 'pending';
    return 'synced';
  }
  private notify(): void {
    if (this.metadata.every(Boolean)) {
      const sessions = resolveSessions(this.tables, this.sessions);
      this.subscribers.forEach(cb => cb(sessions));
    }
    this.syncSubscribers.forEach(cb => cb(this.syncState()));
  }
  private start(): void {
    if (this.stop) return;
    let cancelled = false;
    const unsubscribes: (() => void)[] = [];
    this.metadata = [null, null];
    this.stop = () => { cancelled = true; unsubscribes.forEach(unsubscribe => unsubscribe()); };
    void this.ready.then(ready => {
      if (!ready || cancelled) return;
      const cutoff = now() - 12 * 60 * 60_000;
      unsubscribes.push(onSnapshot(collection(this.db, 'tables'), { includeMetadataChanges: true }, snapshot => {
        this.tables = Object.fromEntries(snapshot.docs.map(item => [item.id, item.data().sessionId as string | null]));
        this.metadata[0] = snapshot.metadata;
        this.notify();
      }, error => { console.error(error); this.metadata[0] = null; this.notify(); }));
      unsubscribes.push(onSnapshot(query(collection(this.db, 'sessions'), where('seatedAt', '>=', cutoff)), { includeMetadataChanges: true }, snapshot => {
        this.sessions = snapshot.docs.map(item => fromSessionDoc(item.id, item.data())).filter((s): s is Session => s !== null);
        this.metadata[1] = snapshot.metadata;
        this.notify();
      }, error => { console.error(error); this.metadata[1] = null; this.notify(); }));
    });
  }
  private stopIfUnused(): void {
    if (this.subscribers.size || this.syncSubscribers.size) return;
    this.stop?.();
    this.stop = null;
    this.metadata = [null, null];
  }
  subscribe(cb: (sessions: Session[]) => void): () => void {
    this.subscribers.add(cb);
    this.start();
    if (this.metadata.every(Boolean)) cb(resolveSessions(this.tables, this.sessions));
    return () => { this.subscribers.delete(cb); this.stopIfUnused(); };
  }
  subscribeSync(cb: (state: SyncState) => void): () => void {
    this.syncSubscribers.add(cb);
    this.start();
    cb(this.syncState());
    return () => { this.syncSubscribers.delete(cb); this.stopIfUnused(); };
  }
  async put(session: Session): Promise<void> {
    if (!await this.ready) return;
    const batch = writeBatch(this.db);
    batch.set(doc(this.db, 'sessions', session.id), { ...toSessionDoc(session), updatedAt: serverTimestamp() });
    for (const tableId of tablesToWrite(session)) {
      batch.set(doc(this.db, 'tables', tableId), { sessionId: session.id, updatedAt: serverTimestamp() });
    }
    void batch.commit().catch(error => console.error(error));
  }
  async remove(id: string): Promise<void> {
    if (!await this.ready) return;
    // 卓の参照は消さない（消えたセッションを指す卓は resolveSessions で空席になる）
    void deleteDoc(doc(this.db, 'sessions', id)).catch(error => console.error(error));
  }

}
