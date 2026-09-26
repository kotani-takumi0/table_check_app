import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { isVisible, type Session } from './domain';
import { GRID, SEATS } from './layout';
import { SeatCard } from './SeatCard';
import { Header } from './Header';
import { Toasts, type Toast } from './Toasts';
import { useDismissed } from './useDismissed';
import { SHOP_TIMERS, shopTimerState, type ShopTimerDone, type ShopTimerId, type ShopTimerStore } from './shopTimers';
import { worstSyncState, type SessionStore, type SyncState } from './store';
import { useSessions } from './useSessions';
import { now } from './clock';

export default function App({ store, shopTimerStore }: { store: SessionStore; shopTimerStore: ShopTimerStore }) {
  const { sessions, seat, next, back } = useSessions(store);
  const [time, setTime] = useState(now);
  const [sessionSync, setSessionSync] = useState<SyncState>('synced');
  const [shopTimerSync, setShopTimerSync] = useState<SyncState>('synced');
  useEffect(() => {
    setSessionSync('synced');
    return store.subscribeSync?.(setSessionSync);
  }, [store]);
  useEffect(() => {
    setShopTimerSync('synced');
    return shopTimerStore.subscribeSync?.(setShopTimerSync);
  }, [shopTimerStore]);
  const syncState = worstSyncState([sessionSync, shopTimerSync]);
  const [shopTimers, setShopTimers] = useState<ShopTimerDone>({});
  useEffect(() => shopTimerStore.subscribe(setShopTimers), [shopTimerStore]);
  const markShopTimerDone = useCallback((id: ShopTimerId) => { void shopTimerStore.markDone(id, now()); }, [shopTimerStore]);
  const { isDismissed, dismiss } = useDismissed();
  useEffect(() => {
    const interval = setInterval(() => setTime(now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const toasts: Toast[] = SHOP_TIMERS.flatMap(timer => {
    const state = shopTimerState(timer.intervalMin, shopTimers[timer.id], time);
    const key = `${timer.id}:${state.dueAt}`;
    return state.due && !isDismissed(key)
      ? [{ key, message: `${timer.label}の時間です`, action: { label: '済にする', onClick: () => markShopTimerDone(timer.id) } }]
      : [];
  });
  return <main className="app">
    <Header time={time} syncState={syncState} showSync={Boolean(store.subscribeSync || shopTimerStore.subscribeSync)} shopTimers={shopTimers} onShopTimerDone={markShopTimerDone} />
    <section className="floor" aria-label="卓タイマー フロア図" style={{ '--cols': GRID.cols, '--rows': GRID.rows } as CSSProperties}>
      <div className="counter-label" aria-hidden="true">カウンター</div>
      <div className="line line-top" aria-hidden="true" />
      <div className="line line-middle" aria-hidden="true" />
      <div className="line line-vertical first" aria-hidden="true" />
      <div className="line line-vertical second" aria-hidden="true" />
      <Toasts toasts={toasts} onDismiss={dismiss} />
      {SEATS.map(position => {
        const session = sessions.filter(s => s.tableIds.includes(position.id) && isVisible(s, time))
          .reduce<Session | undefined>((latest, s) => !latest || s.seatedAt > latest.seatedAt ? s : latest, undefined);
        return <SeatCard key={position.id} seat={position} session={session} time={time} onSeat={seat} onNext={next} onBack={back} />;
      })}
    </section>
  </main>;
}
