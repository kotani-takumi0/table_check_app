import { useEffect, useState, type CSSProperties } from 'react';
import { isVisible, type Session } from './domain';
import { GRID, SEATS } from './layout';
import { SeatCard } from './SeatCard';
import { Header } from './Header';
import type { SessionStore, SyncState } from './store';
import { useSessions } from './useSessions';
import { now } from './clock';

export default function App({ store }: { store: SessionStore }) {
  const { sessions, seat, next, back } = useSessions(store);
  const [time, setTime] = useState(now);
  const [syncState, setSyncState] = useState<SyncState>('synced');
  useEffect(() => {
    setSyncState('synced');
    return store.subscribeSync?.(setSyncState);
  }, [store]);
  useEffect(() => {
    const interval = setInterval(() => setTime(now()), 1000);
    return () => clearInterval(interval);
  }, []);
  return <main className="app">
    <Header time={time} syncState={syncState} showSync={Boolean(store.subscribeSync)} />
    <section className="floor" aria-label="卓タイマー フロア図" style={{ '--cols': GRID.cols, '--rows': GRID.rows } as CSSProperties}>
      <div className="counter-label" aria-hidden="true">カウンター</div>
      <div className="line line-top" aria-hidden="true" />
      <div className="line line-middle" aria-hidden="true" />
      <div className="line line-vertical first" aria-hidden="true" />
      <div className="line line-vertical second" aria-hidden="true" />
      {SEATS.map(position => {
        const session = sessions.filter(s => s.tableIds.includes(position.id) && isVisible(s, time))
          .reduce<Session | undefined>((latest, s) => !latest || s.seatedAt > latest.seatedAt ? s : latest, undefined);
        return <SeatCard key={position.id} seat={position} session={session} time={time} onSeat={seat} onNext={next} onBack={back} />;
      })}
    </section>
  </main>;
}
