import { isMenuId, menuOf } from './courseMenus';
import { isCourse, isGuestCount, type Course, type Session, type Status } from './domain';

export interface SessionDoc {
  tableIds: string[];
  status: Status;
  seatedAt: number;
  otoshiAt: number | null;
  loDoneAt: number | null;
  exitedAt: number | null;
  paidAt: number | null;
  guests: number | null;
  course: Course | null;
  menu: string | null;
  dishesServed: number;
}
export function toSessionDoc(session: Session): SessionDoc {
  const { tableIds, status, seatedAt, otoshiAt, loDoneAt, exitedAt, paidAt, guests, course, menu, dishesServed } = session;
  return { tableIds, status, seatedAt, otoshiAt, loDoneAt, exitedAt, paidAt, guests, course, menu, dishesServed };
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
    && (s.guests === undefined || s.guests === null || isGuestCount(s.guests))
    && (s.course === undefined || s.course === null || isCourse(s.course))
    && (s.menu === undefined || s.menu === null || isMenuId(s.menu))
    && (s.dishesServed === undefined || (Number.isInteger(s.dishesServed) && (s.dishesServed as number) >= 0))
    && (s.status === 'seated' || timestamp(s.otoshiAt))
    && (!['lo_done', 'exited'].includes(s.status) || timestamp(s.loDoneAt))
    && (s.status !== 'exited' || timestamp(s.exitedAt)))) return null;
  // お会計・人数・コース・料理を入れる前の文書には paidAt・guests・course・menu・dishesServed が無いので、
  // 未払い・人数未入力・通常・コース未選択・まだ出していないとして読む
  return { id, ...toSessionDoc(withDefaults(s)) };
}
// 保存されたセッションに無い項目を補う（Firestore とブラウザの保存先で共通）。
// コースでなければメニューは持たず、出した品数はメニューの品数までに収める
export function withDefaults(s: Record<string, unknown>): Session {
  const course = (s.course ?? null) as Course | null;
  const menu = course === null ? null : (s.menu ?? null) as string | null;
  const total = menuOf(menu)?.dishes.length ?? 0;
  const dishesServed = Math.min((s.dishesServed ?? 0) as number, total);
  return { ...s, paidAt: s.paidAt ?? null, guests: s.guests ?? null, course, menu, dishesServed } as unknown as Session;
}
// 卓の持ち主は「tables/{卓} がそのセッションを指し、かつセッションの tableIds にもその卓がある」ときだけ。
// 移動・取り消しで卓を null に戻す書き込みをしない（オフライン復帰時に他の端末の案内を消さない）ので、
// 古い参照や、同時操作で他の客に取られた卓は、ここで tableIds から外す
export function resolveSessions(tables: Record<string, string | null>, sessions: Session[]): Session[] {
  const seen = new Set<string>();
  return sessions.flatMap(session => {
    if (seen.has(session.id)) return [];
    seen.add(session.id);
    const owned = session.tableIds.filter(tableId => tables[tableId] === session.id);
    if (owned.length === 0) return [];
    return [owned.length === session.tableIds.length ? session : { ...session, tableIds: owned }];
  });
}
export function tablesToWrite(session: Session): string[] { return session.tableIds; }
