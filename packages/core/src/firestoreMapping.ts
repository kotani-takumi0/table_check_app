import { DEFAULT_COURSE_MENUS, isMenuId } from './courseMenus';
import { DEFAULT_DRINK_PLANS, isCourse, isGuestCount, type Course, type Session, type Status } from './domain';

export interface SessionDoc {
  tableIds: string[];
  status: Status;
  seatedAt: number;
  otoshiAt: number | null;
  loDoneAt: number | null;
  exitedAt: number | null;
  paidAt: number | null;
  guests: number | null;
  course: Course | null;       // 前の版のアプリも読めるよう、最初の3区分のどれか（店が足した区分は 'drinks'）。null は通常
  drinkPlan: Course | null;    // 飲み放題の区分の id（No.90）。通常は null
  menu: string | null;         // 前の版のアプリも読めるよう、最初の5コースのどれか（店が作ったコースは null）
  courseMenu: string | null;   // どのコースか（No.89）。コースを選んでいなければ null
  dishesServed: number;
  leaveAt: number | null;
}
// 前の版のアプリが知っている区分（これ以外の course の文書は読めずに捨ててしまう）
const LEGACY_COURSES = DEFAULT_DRINK_PLANS.map(plan => plan.id);
const LEGACY_MENUS = DEFAULT_COURSE_MENUS.map(menu => menu.id);
// 保存する形。店が足した区分（No.90）は course に 'drinks' を入れ、本当の区分は drinkPlan に入れる。
// 前の版の端末でもコースの卓として見え、空席と間違えて案内されないようにする
export function toSessionDoc(session: Session): SessionDoc {
  const { tableIds, status, seatedAt, otoshiAt, loDoneAt, exitedAt, paidAt, guests, course, menu, dishesServed, leaveAt } = session;
  const legacy = course === null ? null : LEGACY_COURSES.includes(course) ? course : 'drinks';
  // 店が作ったコース（No.89）も同じく、menu は前の版も知っているものだけにし、本当のコースは courseMenu に入れる
  const legacyMenu = menu !== null && LEGACY_MENUS.includes(menu) ? menu : null;
  return { tableIds, status, seatedAt, otoshiAt, loDoneAt, exitedAt, paidAt, guests, course: legacy, drinkPlan: course, menu: legacyMenu, courseMenu: menu, dishesServed, leaveAt };
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
    && (s.drinkPlan === undefined || s.drinkPlan === null || isCourse(s.drinkPlan))
    && (s.menu === undefined || s.menu === null || isMenuId(s.menu))
    && (s.courseMenu === undefined || s.courseMenu === null || isMenuId(s.courseMenu))
    && (s.dishesServed === undefined || (Number.isInteger(s.dishesServed) && (s.dishesServed as number) >= 0))
    && (s.leaveAt === undefined || s.leaveAt === null || timestamp(s.leaveAt))
    && (s.status === 'seated' || timestamp(s.otoshiAt))
    && (!['lo_done', 'exited'].includes(s.status) || timestamp(s.loDoneAt))
    && (s.status !== 'exited' || timestamp(s.exitedAt)))) return null;
  // お会計・人数・コース・料理を入れる前の文書には paidAt・guests・course・menu・dishesServed が無いので、
  // 未払い・人数未入力・通常・コース未選択・まだ出していない・ふつうの退店時刻として読む（leaveAt も同じ）
  const { tableIds, status, seatedAt, otoshiAt, loDoneAt, exitedAt, paidAt, guests, course, menu, dishesServed, leaveAt } = withDefaults(s);
  return { id, tableIds, status, seatedAt, otoshiAt, loDoneAt, exitedAt, paidAt, guests, course, menu, dishesServed, leaveAt };
}
// 保存されたセッションに無い項目を補う（Firestore とブラウザの保存先で共通）。
// コースでなければメニューは持たず、出した品数も持たない（メニューの品数までに収めるのは dishProgress。コースは店が作るので、ここでは品数が分からない）
// 区分は drinkPlan、コースは courseMenu を優先して読む（前の版のアプリが通常に戻した文書は course が null なので通常）
export function withDefaults(s: Record<string, unknown>): Session {
  const course = s.course == null ? null : (isCourse(s.drinkPlan) ? s.drinkPlan : s.course) as Course;
  const menu = course === null ? null : (isMenuId(s.courseMenu) ? s.courseMenu : s.menu ?? null) as string | null;
  const dishesServed = menu === null ? 0 : (s.dishesServed ?? 0) as number;
  return { ...s, paidAt: s.paidAt ?? null, guests: s.guests ?? null, course, menu, dishesServed, leaveAt: s.leaveAt ?? null } as unknown as Session;
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
