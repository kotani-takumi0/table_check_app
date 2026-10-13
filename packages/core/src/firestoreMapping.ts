import { DEFAULT_COURSE_MENUS, isMenuId } from './courseMenus';
import { DEFAULT_DRINK_PLANS, isCourse, isGuestCount, TABLE_LOG_MAX, type Course, type Session, type Status, type TableMove } from './domain';

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
  dishServedAt: (number | null)[];   // 料理を出した時刻（No.131）
  leaveAt: number | null;
  clearedAt: number | null;    // 全卓消去した時刻（No.113）
  tableLog: TableMove[];       // 卓の動き（No.113）
  exitedByClosing: boolean;    // 閉店で退店にした（No.129）。書き込みは merge なので、戻したときに消えるよう false もいつも書く
}
// 前の版のアプリが知っている区分（これ以外の course の文書は読めずに捨ててしまう）
const LEGACY_COURSES = DEFAULT_DRINK_PLANS.map(plan => plan.id);
const LEGACY_MENUS = DEFAULT_COURSE_MENUS.map(menu => menu.id);
// 保存する形。店が足した区分（No.90）は course に 'drinks' を入れ、本当の区分は drinkPlan に入れる。
// 前の版の端末でもコースの卓として見え、空席と間違えて案内されないようにする
export function toSessionDoc(session: Session): SessionDoc {
  const { tableIds, status, seatedAt, otoshiAt, loDoneAt, exitedAt, paidAt, guests, course, menu, dishesServed, dishServedAt, leaveAt, clearedAt, tableLog, exitedByClosing } = session;
  const legacy = course === null ? null : LEGACY_COURSES.includes(course) ? course : 'drinks';
  // 店が作ったコース（No.89）も同じく、menu は前の版も知っているものだけにし、本当のコースは courseMenu に入れる
  const legacyMenu = menu !== null && LEGACY_MENUS.includes(menu) ? menu : null;
  return { tableIds, status, seatedAt, otoshiAt, loDoneAt, exitedAt, paidAt, guests, course: legacy, drinkPlan: course, menu: legacyMenu, courseMenu: menu, dishesServed, dishServedAt, leaveAt, clearedAt, tableLog, exitedByClosing };
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
    && (s.clearedAt === undefined || s.clearedAt === null || timestamp(s.clearedAt))
    // 閉店で退店にした卓（No.129）は、お通し・L.O.確認をしないまま退店になるので、その2つの時刻が空でもよい
    && (s.status === 'seated' || timestamp(s.otoshiAt) || (s.status === 'exited' && s.exitedByClosing === true))
    && (!['lo_done', 'exited'].includes(s.status) || timestamp(s.loDoneAt) || (s.status === 'exited' && s.exitedByClosing === true))
    && (s.status !== 'exited' || timestamp(s.exitedAt)))) return null;
  // お会計・人数・コース・料理を入れる前の文書には paidAt・guests・course・menu・dishesServed が無いので、
  // 未払い・人数未入力・通常・コース未選択・まだ出していない・ふつうの退店時刻として読む（leaveAt も同じ）
  // 全卓消去・卓の動き（No.113）より前の文書は、消していない・動かしていないとして読む
  // 料理を出した時刻（No.131）より前の文書は、時刻が分からないとして読む
  const { tableIds, status, seatedAt, otoshiAt, loDoneAt, exitedAt, paidAt, guests, course, menu, dishesServed, dishServedAt, leaveAt, clearedAt, tableLog, exitedByClosing } = withDefaults(s);
  return { id, tableIds, status, seatedAt, otoshiAt, loDoneAt, exitedAt, paidAt, guests, course, menu, dishesServed, dishServedAt, leaveAt, clearedAt, tableLog, exitedByClosing };
}
// 保存されたセッションに無い項目を補う（Firestore とブラウザの保存先で共通）。
// コースでなければメニューは持たず、出した品数も持たない（メニューの品数までに収めるのは dishProgress。コースは店が作るので、ここでは品数が分からない）
// 区分は drinkPlan、コースは courseMenu を優先して読む（前の版のアプリが通常に戻した文書は course が null なので通常）
export function withDefaults(s: Record<string, unknown>): Session {
  const course = s.course == null ? null : (isCourse(s.drinkPlan) ? s.drinkPlan : s.course) as Course;
  const menu = course === null ? null : (isMenuId(s.courseMenu) ? s.courseMenu : s.menu ?? null) as string | null;
  const dishesServed = menu === null ? 0 : (s.dishesServed ?? 0) as number;
  return { ...s, paidAt: s.paidAt ?? null, guests: s.guests ?? null, course, menu, dishesServed, dishServedAt: parseDishTimes(s.dishServedAt, dishesServed), leaveAt: s.leaveAt ?? null,
    clearedAt: s.clearedAt ?? null, tableLog: parseTableLog(s.tableLog), exitedByClosing: s.status === 'exited' && s.exitedByClosing === true } as unknown as Session;
}
// 料理を出した時刻を読む（No.131）。出した品数より後の時刻（前の版で1品戻した）は落とし、壊れた値は時刻が分からないとして null にする
export function parseDishTimes(value: unknown, served: number): (number | null)[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, served).map(at => typeof at === 'number' && Number.isFinite(at) ? at : null);
}
// 卓の動きを読む。壊れた項目は落とす（記録の読み違いで、卓の画面を止めない）
export function parseTableLog(value: unknown): TableMove[] {
  if (!Array.isArray(value)) return [];
  const tableOrNull = (v: unknown) => v === null || typeof v === 'string';
  return value.slice(-TABLE_LOG_MAX).flatMap((item): TableMove[] => {
    const m = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {};
    return typeof m.at === 'number' && Number.isFinite(m.at) && (m.kind === 'move' || m.kind === 'add' || m.kind === 'remove') && tableOrNull(m.from) && tableOrNull(m.to)
      ? [{ at: m.at, kind: m.kind, from: m.from as string | null, to: m.to as string | null }] : [];
  });
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
