import { useCallback, useEffect, useState } from 'react';
import { addTable, advance, editTime, moveTable, newSession, removeTable, revert, serveDish, setCourse, setGuests, setMenu, togglePaid, unserveDish, type Course, type EditableTime, type Session } from './domain';
import type { SessionStore } from './store';
import { now } from './clock';
// createId はお客さん（セッション）の ID を作る。React Native には crypto.randomUUID が無いので、iOS は expo-crypto を渡す
const randomId = () => crypto.randomUUID();
export function useSessions(store: SessionStore, createId: () => string = randomId): {
  sessions: Session[];
  seat(tableId: string, guests?: number | null, course?: Course | null, menu?: string | null): void;
  next(session: Session): void;
  back(session: Session): void;
  retime(session: Session, field: EditableTime, at: number): boolean;
  pay(session: Session): void;
  changeGuests(session: Session, guests: number | null): void;
  changeCourse(session: Session, course: Course | null): void;
  changeMenu(session: Session, menu: string | null): void;
  serve(session: Session): void;
  unserve(session: Session): void;
  moveTo(session: Session, from: string, to: string): void;
  addTo(session: Session, tableId: string): void;
  release(session: Session, tableId: string): void;
  clearAll(): void;
} {
  const [sessions, setSessions] = useState<Session[]>([]);
  useEffect(() => store.subscribe(setSessions), [store]);
  const seat = useCallback((tableId: string, guests: number | null = null, course: Course | null = null, menu: string | null = null) => {
    void store.put(newSession(createId(), tableId, now(), guests, course, menu));
  }, [store, createId]);
  const next = useCallback((session: Session) => { void store.put(advance(session, now())); }, [store]);
  const back = useCallback((session: Session) => {
    const previous = revert(session);
    if (previous) void store.put(previous);
    else void store.remove(session.id);
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
  const changeCourse = useCallback((session: Session, course: Course | null) => {
    const changed = setCourse(session, course);
    if (changed) void store.put(changed);
  }, [store]);
  const changeMenu = useCallback((session: Session, menu: string | null) => {
    const changed = setMenu(session, menu);
    if (changed) void store.put(changed);
  }, [store]);
  const serve = useCallback((session: Session) => {
    const served = serveDish(session);
    if (served) void store.put(served);
  }, [store]);
  const unserve = useCallback((session: Session) => {
    const reverted = unserveDish(session);
    if (reverted) void store.put(reverted);
  }, [store]);
  const moveTo = useCallback((session: Session, from: string, to: string) => {
    const moved = moveTable(session, from, to);
    if (moved) void store.put(moved);
  }, [store]);
  const addTo = useCallback((session: Session, tableId: string) => {
    const added = addTable(session, tableId);
    if (added) void store.put(added);
  }, [store]);
  const release = useCallback((session: Session, tableId: string) => {
    const removed = removeTable(session, tableId);
    if (removed) void store.put(removed);
  }, [store]);
  // 全卓消去：今ある客をすべて消す（全端末の画面から消える）
  const clearAll = useCallback(() => {
    for (const session of sessions) void store.remove(session.id);
  }, [store, sessions]);
  return { sessions, seat, next, back, retime, pay, changeGuests, changeCourse, changeMenu, serve, unserve, moveTo, addTo, release, clearAll };
}
