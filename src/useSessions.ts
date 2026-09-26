import { useCallback, useEffect, useState } from 'react';
import { addTable, advance, editTime, moveTable, newSession, removeTable, revert, togglePaid, type EditableTime, type Session } from './domain';
import type { SessionStore } from './store';
import { now } from './clock';
export function useSessions(store: SessionStore): {
  sessions: Session[];
  seat(tableId: string): void;
  next(session: Session): void;
  back(session: Session): void;
  retime(session: Session, field: EditableTime, at: number): boolean;
  pay(session: Session): void;
  moveTo(session: Session, from: string, to: string): void;
  addTo(session: Session, tableId: string): void;
  release(session: Session, tableId: string): void;
} {
  const [sessions, setSessions] = useState<Session[]>([]);
  useEffect(() => store.subscribe(setSessions), [store]);
  const seat = useCallback((tableId: string) => {
    void store.put(newSession(crypto.randomUUID(), tableId, now()));
  }, [store]);
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
  return { sessions, seat, next, back, retime, pay, moveTo, addTo, release };
}
