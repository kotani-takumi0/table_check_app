import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { isVisible, type Session } from './domain';
import { GRID, SEATS } from './layout';
import { SeatCard } from './SeatCard';
import { Header } from './Header';
import { DetailPanel } from './DetailPanel';
import type { SessionStore, SyncState } from './store';
import { useSessions } from './useSessions';
import { now } from './clock';

export default function App({ store }: { store: SessionStore }) {
  const { sessions, seat, next, back, retime } = useSessions(store);
  const [openId, setOpenId] = useState<string | null>(null);
  const closePanel = useCallback(() => setOpenId(null), []);
  // 開くと背景が inert になりフォーカスが外れるので、開く前に覚えておく
  const returnFocus = useRef<HTMLElement | null>(null);
  const openPanel = useCallback((session: Session) => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpenId(session.id);
  }, []);
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
  const opened = sessions.find(s => s.id === openId && isVisible(s, time));
  return <main className="app">
    <Header inert={Boolean(opened)} time={time} syncState={syncState} showSync={Boolean(store.subscribeSync)} />
    <section inert={Boolean(opened)} className="floor" aria-label="卓タイマー フロア図" style={{ '--cols': GRID.cols, '--rows': GRID.rows } as CSSProperties}>
      <div className="counter-label" aria-hidden="true">カウンター</div>
      <div className="line line-top" aria-hidden="true" />
      <div className="line line-middle" aria-hidden="true" />
      <div className="line line-vertical first" aria-hidden="true" />
      <div className="line line-vertical second" aria-hidden="true" />
      {SEATS.map(position => {
        const session = sessions.filter(s => s.tableIds.includes(position.id) && isVisible(s, time))
          .reduce<Session | undefined>((latest, s) => !latest || s.seatedAt > latest.seatedAt ? s : latest, undefined);
        return <SeatCard key={position.id} seat={position} session={session} time={time} onSeat={seat} onNext={next} onOpen={openPanel} />;
      })}
    </section>
    {opened && <DetailPanel session={opened} time={time} onClose={closePanel} onNext={next} onBack={back} onRetime={retime} returnFocus={returnFocus.current} />}
  </main>;
}
