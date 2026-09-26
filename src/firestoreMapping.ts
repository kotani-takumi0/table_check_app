import type { Session, Status } from './domain';

export interface SessionDoc {
  tableIds: string[];
  status: Status;
  seatedAt: number;
  otoshiAt: number | null;
  loDoneAt: number | null;
  exitedAt: number | null;
  paidAt: number | null;
}
export function toSessionDoc(session: Session): SessionDoc {
  const { tableIds, status, seatedAt, otoshiAt, loDoneAt, exitedAt, paidAt } = session;
  return { tableIds, status, seatedAt, otoshiAt, loDoneAt, exitedAt, paidAt };
}
export function fromSessionDoc(id: string, data: unknown): Session | null {
  if (typeof data !== 'object' || data === null) return null;
  const s = data as Record<string, unknown>;
  const timestamp = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (!(Array.isArray(s.tableIds) && s.tableIds.length >= 1
    && s.tableIds.every(tableId => typeof tableId === 'string')
    && typeof s.status === 'string' && ['seated', 'otoshi', 'lo_done', 'exited'].includes(s.status)
    && timestamp(s.seatedAt)
    && [s.otoshiAt, s.loDoneAt, s.exitedAt].every(v => v === null || timestamp(v))
    && (s.paidAt === undefined || s.paidAt === null || timestamp(s.paidAt))
    && (s.status === 'seated' || timestamp(s.otoshiAt))
    && (!['lo_done', 'exited'].includes(s.status) || timestamp(s.loDoneAt))
    && (s.status !== 'exited' || timestamp(s.exitedAt)))) return null;
  // お会計を入れる前の文書には paidAt が無いので未払いとして読む
  return { id, ...toSessionDoc({ ...s, paidAt: s.paidAt ?? null } as unknown as Session) };
}
export function resolveSessions(tables: Record<string, string | null>, sessions: Session[]): Session[] {
  const referenced = new Set(Object.values(tables));
  const seen = new Set<string>();
  return sessions.filter(session => {
    if (!referenced.has(session.id) || seen.has(session.id)) return false;
    seen.add(session.id);
    return true;
  });
}
export function tablesToWrite(session: Session): string[] { return session.tableIds; }
// 移動・外した卓：まだこのセッションを指しているが、もう使っていない卓
export function tablesToRelease(session: Session, tables: Record<string, string | null>): string[] {
  return Object.keys(tables).filter(tableId => tables[tableId] === session.id && !session.tableIds.includes(tableId));
}
export function tablesToClear(id: string, tables: Record<string, string | null>): string[] {
  return Object.keys(tables).filter(tableId => tables[tableId] === id);
}
