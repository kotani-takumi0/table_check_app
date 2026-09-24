export type Status = 'seated' | 'otoshi' | 'lo_done' | 'exited';
export const STATUS_LABEL: Record<Status, string> = {
  seated: 'ご案内済み', otoshi: 'お通し提供済み', lo_done: 'L.O.確認済み', exited: '退店済み',
};
export const STATUS_SHORT: Record<Status, string> = {
  seated: '案内済', otoshi: 'お通し済', lo_done: 'L.O.済', exited: '退店済',
};
export interface Session {
  id: string;
  tableIds: string[];
  status: Status;
  seatedAt: number;
  otoshiAt: number | null;
  loDoneAt: number | null;
  exitedAt: number | null;
}
export const RULES = { otoshiWarnMin: 15, lastOrderMin: 90, seatLimitMin: 120, exitedKeepMin: 5 } as const;
export type Alert = 'none' | 'soon' | 'now';
export type AlertReason = 'otoshi_missing' | 'last_order' | 'seat_limit' | null;
const MINUTE = 60_000;
export function newSession(id: string, tableId: string, at: number): Session {
  return { id, tableIds: [tableId], status: 'seated', seatedAt: at, otoshiAt: null, loDoneAt: null, exitedAt: null };
}
export function nextStatus(s: Status): Status | null {
  return { seated: 'otoshi', otoshi: 'lo_done', lo_done: 'exited', exited: null }[s] as Status | null;
}
export function advance(session: Session, at: number): Session {
  switch (session.status) {
    case 'seated': return { ...session, status: 'otoshi', otoshiAt: at };
    case 'otoshi': return { ...session, status: 'lo_done', loDoneAt: at };
    case 'lo_done': return { ...session, status: 'exited', exitedAt: at };
    case 'exited': return session;
  }
}
export function revert(session: Session): Session | null {
  switch (session.status) {
    case 'seated': return null;
    case 'otoshi': return { ...session, status: 'seated', otoshiAt: null };
    case 'lo_done': return { ...session, status: 'otoshi', loDoneAt: null };
    case 'exited': return { ...session, status: 'lo_done', exitedAt: null };
  }
}
export function timerOf(session: Session, now: number): { label: string; elapsedMs: number } {
  const [label, at] = session.status === 'seated'
    ? ['案内から', session.seatedAt] as const
    : session.status === 'exited'
      ? ['退店から', session.exitedAt] as const
      : ['お通しから', session.otoshiAt] as const;
  return { label, elapsedMs: Math.max(0, now - (at ?? now)) };
}
export function alertOf(session: Session, now: number): { level: Alert; reason: AlertReason } {
  if (session.status === 'seated' && now - session.seatedAt >= RULES.otoshiWarnMin * MINUTE) {
    return { level: 'now', reason: 'otoshi_missing' };
  }
  if ((session.status === 'otoshi' || session.status === 'lo_done') && session.otoshiAt !== null) {
    const elapsed = now - session.otoshiAt;
    if (elapsed >= RULES.seatLimitMin * MINUTE) return { level: 'now', reason: 'seat_limit' };
    if (session.status === 'otoshi' && elapsed >= RULES.lastOrderMin * MINUTE) return { level: 'soon', reason: 'last_order' };
  }
  return { level: 'none', reason: null };
}
export function isVisible(session: Session, now: number): boolean {
  return session.status !== 'exited' || (session.exitedAt !== null && now - session.exitedAt < RULES.exitedKeepMin * MINUTE);
}
export function formatElapsed(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(seconds / 60);
  const tail = `${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return minutes < 60 ? tail : `${Math.floor(minutes / 60)}:${tail}`;
}
