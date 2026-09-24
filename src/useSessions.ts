import { useCallback, useEffect, useState } from 'react';
import { advance, newSession, revert, type Session } from './domain';
import type { SessionStore } from './store';
import { now } from './clock';
export function useSessions(store: SessionStore): {
  sessions: Session[];
  seat(tableId: string): void;
  next(session: Session): void;
  back(session: Session): void;
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
  return { sessions, seat, next, back };
}
