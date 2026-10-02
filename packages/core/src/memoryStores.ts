import type { Session } from './domain';
import { mergeShopTimerDone, type ShopTimerDone, type ShopTimerId, type ShopTimerStore } from './shopTimers';
import type { SessionStore } from './store';

// Firebase につながずに試すときの保存先。アプリを開いている間だけ覚え、ほかの端末とは同期しない
export class MemorySessionStore implements SessionStore {
  private sessions: Session[] = [];
  private subscribers = new Set<(sessions: Session[]) => void>();
  subscribe(cb: (sessions: Session[]) => void): () => void {
    this.subscribers.add(cb);
    cb(this.sessions);
    return () => { this.subscribers.delete(cb); };
  }
  private write(sessions: Session[]): void {
    this.sessions = sessions;
    this.subscribers.forEach(cb => cb(sessions));
  }
  async put(session: Session): Promise<void> {
    this.write([...this.sessions.filter(s => s.id !== session.id), session]);
  }
  async remove(id: string): Promise<void> {
    this.write(this.sessions.filter(s => s.id !== id));
  }
}
export class MemoryShopTimerStore implements ShopTimerStore {
  private done: ShopTimerDone = {};
  private subscribers = new Set<(done: ShopTimerDone) => void>();
  subscribe(cb: (done: ShopTimerDone) => void): () => void {
    this.subscribers.add(cb);
    cb(this.done);
    return () => { this.subscribers.delete(cb); };
  }
  async markDone(id: ShopTimerId, at: number): Promise<void> {
    this.done = mergeShopTimerDone(this.done, { [id]: at });
    this.subscribers.forEach(cb => cb(this.done));
  }
}
