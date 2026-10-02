import { isMenuId } from '@table-check/core/courseMenus';
import { isCourse, isGuestCount, type Session } from '@table-check/core/domain';
import { withDefaults } from '@table-check/core/firestoreMapping';
import type { SessionStore } from '@table-check/core/store';

// Firebase の設定が無いときに使う、この端末のブラウザだけの保存先
const KEY = 'table-check:sessions';
function validSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  const timestamp = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  return typeof s.id === 'string' && Array.isArray(s.tableIds) && s.tableIds.length >= 1
    && s.tableIds.every(id => typeof id === 'string') && new Set(s.tableIds).size === s.tableIds.length
    && ['seated', 'otoshi', 'lo_done', 'exited'].includes(String(s.status))
    && timestamp(s.seatedAt)
    && [s.otoshiAt, s.loDoneAt, s.exitedAt].every(v => v === null || timestamp(v))
    && (s.paidAt === undefined || s.paidAt === null || timestamp(s.paidAt))
    && (s.guests === undefined || s.guests === null || isGuestCount(s.guests))
    && (s.course === undefined || s.course === null || isCourse(s.course))
    && (s.menu === undefined || s.menu === null || isMenuId(s.menu))
    && (s.dishesServed === undefined || (Number.isInteger(s.dishesServed) && (s.dishesServed as number) >= 0))
    && (s.leaveAt === undefined || s.leaveAt === null || timestamp(s.leaveAt))
    && (s.status === 'seated' || timestamp(s.otoshiAt))
    && (!['lo_done', 'exited'].includes(String(s.status)) || timestamp(s.loDoneAt))
    && (s.status !== 'exited' || timestamp(s.exitedAt));
}
export class LocalSessionStore implements SessionStore {
  private subscribers = new Set<(sessions: Session[]) => void>();
  private read(): Session[] {
    try {
      const value: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
      // お会計・人数・コース・料理を入れる前に保存したデータには無い項目があるので、Firestore と同じく補って読む
      return Array.isArray(value) ? value.filter(validSession).map(s => withDefaults(s as unknown as Record<string, unknown>)) : [];
    } catch { return []; }
  }
  private notify(sessions: Session[]): void {
    this.subscribers.forEach(cb => cb(sessions));
  }
  private onStorage = (event: StorageEvent): void => {
    if (event.key === KEY || event.key === null) this.notify(this.read());
  };
  subscribe(cb: (sessions: Session[]) => void): () => void {
    if (this.subscribers.size === 0) window.addEventListener('storage', this.onStorage);
    this.subscribers.add(cb);
    cb(this.read());
    return () => {
      this.subscribers.delete(cb);
      if (this.subscribers.size === 0) window.removeEventListener('storage', this.onStorage);
    };
  }
  private write(sessions: Session[]): void {
    try { window.localStorage.setItem(KEY, JSON.stringify(sessions)); }
    catch { this.notify(this.read()); return; }
    this.notify(sessions);
  }
  async put(session: Session): Promise<void> {
    this.write([...this.read().filter(s => s.id !== session.id), session]);
  }
  async remove(id: string): Promise<void> {
    this.write(this.read().filter(s => s.id !== id));
  }
}
