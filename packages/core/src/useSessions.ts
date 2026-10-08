import { useCallback, useEffect, useState } from 'react';
import { addTable, advance, clearSession, editTime, isVisible, moveTable, newSession, removeTable, revert, serveDish, setCourse, setGuests, setLeaveAt, setMenu, togglePaid, unserveDish, type Course, type EditableTime, type Rules, type Session } from './domain';
import type { SessionStore } from './store';
import { DEFAULT_COURSE_MENUS, type CourseMenu } from './courseMenus';
import { now } from './clock';
import { closeOuts } from './closing';
// createId はお客さん（セッション）の ID を作る。React Native には crypto.randomUUID が無いので、iOS は expo-crypto を渡す
// menus は店が作ったコース（No.89。料理を進める・コースを選び直すときに品数を見る）
const randomId = () => crypto.randomUUID();
export function useSessions(store: SessionStore, createId: () => string = randomId, menus: CourseMenu[] = DEFAULT_COURSE_MENUS): {
  sessions: Session[];
  seat(tableId: string, guests?: number | null, course?: Course | null, menu?: string | null): void;
  next(session: Session): Session;          // 進めたあとの中身を返す（元に戻すで使う。No.102）
  back(session: Session): Session | null;   // 戻したあとの中身を返す。null は案内を取り消して記録を消した
  retime(session: Session, field: EditableTime, at: number): boolean;
  pay(session: Session): void;
  changeGuests(session: Session, guests: number | null): void;
  changeLeaveAt(session: Session, at: number | null): boolean;   // 退店の時刻を決める（null でふつうに戻す）。案内より前なら false
  changeCourse(session: Session, course: Course | null): void;
  changeMenu(session: Session, menu: string | null): void;
  serve(session: Session): void;
  unserve(session: Session): void;
  moveTo(session: Session, from: string, to: string): void;
  addTo(session: Session, tableId: string): void;
  release(session: Session, tableId: string): void;
  clearAll(rules: Rules): void;   // rules：退店済みを卓に残す時間（今卓に出ているお客さんだけを消す）
  closeOut(closingMin: number | null, at: number): number;   // 閉店時刻を過ぎても退店していない卓を、閉店で退店にする（No.129）。退店にした組の数を返す
} {
  const [sessions, setSessions] = useState<Session[]>([]);
  // 全卓消去したお客さん（No.113）は記録に残すだけで、画面・通知には渡さない
  useEffect(() => store.subscribe(all => setSessions(all.filter(session => session.clearedAt === null))), [store]);
  const seat = useCallback((tableId: string, guests: number | null = null, course: Course | null = null, menu: string | null = null) => {
    void store.put(newSession(createId(), tableId, now(), guests, course, menu));
  }, [store, createId]);
  const next = useCallback((session: Session) => {
    const advanced = advance(session, now());
    void store.put(advanced);
    return advanced;
  }, [store]);
  const back = useCallback((session: Session) => {
    const previous = revert(session);
    if (previous) void store.put(previous);
    else void store.remove(session.id);
    return previous;
  }, [store]);
  const retime = useCallback((session: Session, field: EditableTime, at: number) => {
    const edited = editTime(session, field, at, now());
    if (edited) void store.put(edited);
    return edited !== null;
  }, [store]);
  const pay = useCallback((session: Session) => { void store.put(togglePaid(session, now())); }, [store]);
  const changeGuests = useCallback((session: Session, guests: number | null) => {
    const changed = setGuests(session, guests);
    if (changed) void store.put(changed);
  }, [store]);
  const changeLeaveAt = useCallback((session: Session, at: number | null) => {
    const changed = setLeaveAt(session, at);
    if (changed) void store.put(changed);
    return changed !== null;
  }, [store]);
  const changeCourse = useCallback((session: Session, course: Course | null) => {
    const changed = setCourse(session, course);
    if (changed) void store.put(changed);
  }, [store]);
  const changeMenu = useCallback((session: Session, menu: string | null) => {
    const changed = setMenu(session, menu, menus);
    if (changed) void store.put(changed);
  }, [store, menus]);
  const serve = useCallback((session: Session) => {
    const served = serveDish(session, menus);
    if (served) void store.put(served);
  }, [store, menus]);
  const unserve = useCallback((session: Session) => {
    const reverted = unserveDish(session, menus);
    if (reverted) void store.put(reverted);
  }, [store, menus]);
  const moveTo = useCallback((session: Session, from: string, to: string) => {
    const moved = moveTable(session, from, to, now());
    if (moved) void store.put(moved);
  }, [store]);
  const addTo = useCallback((session: Session, tableId: string) => {
    const added = addTable(session, tableId, now());
    if (added) void store.put(added);
  }, [store]);
  const release = useCallback((session: Session, tableId: string) => {
    const removed = removeTable(session, tableId, now());
    if (removed) void store.put(removed);
  }, [store]);
  // 全卓消去：今卓に出ているお客さんを全端末の画面から消す。記録は消さずに、消した時刻を付けて残す（No.113）
  const clearAll = useCallback((rules: Rules) => {
    const at = now();
    for (const session of sessions) if (isVisible(session, at, rules)) void store.put(clearSession(session, at));
  }, [store, sessions]);
  // 閉店で退店にする（No.129）。そのとき開いている端末（どの端末も開いていなければ、次に開いた端末）が書く。
  // 何台もの端末が同時に書いても、中身は同じ（退店の時刻は閉店時刻）なので食い違わない
  const closeOut = useCallback((closingMin: number | null, at: number) => {
    const closed = closeOuts(sessions, at, closingMin);
    for (const session of closed) void store.put(session);
    return closed.length;
  }, [store, sessions]);
  return { sessions, seat, next, back, retime, pay, changeGuests, changeLeaveAt, changeCourse, changeMenu, serve, unserve, moveTo, addTo, release, clearAll, closeOut };
}
