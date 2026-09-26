import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { isVisible, lastOrderDue, type Session } from './domain';
import { GRID, SEATS } from './layout';
import { SeatCard } from './SeatCard';
import { Header } from './Header';
import { DetailPanel } from './DetailPanel';
import { Toasts, type Toast } from './Toasts';
import { useDismissed } from './useDismissed';
import { SHOP_TIMERS, shopTimerState, type ShopTimerDone, type ShopTimerId, type ShopTimerStore } from './shopTimers';
import { worstSyncState, type SessionStore, type SyncState } from './store';
import { useSessions } from './useSessions';
import { now } from './clock';

export default function App({ store, shopTimerStore }: { store: SessionStore; shopTimerStore: ShopTimerStore }) {
  const { sessions, seat, next, back, retime, pay } = useSessions(store);
  const [openId, setOpenId] = useState<string | null>(null);
  const closePanel = useCallback(() => setOpenId(null), []);
  // 開くと背景が inert になりフォーカスが外れるので、開く前に覚えておく
  const returnFocus = useRef<HTMLElement | null>(null);
  const openPanel = useCallback((session: Session) => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpenId(session.id);
  }, []);
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
  // 「閉じる」はこの端末だけ。お通し時刻を直すと別の通知として出し直す
  const lastOrderToasts: Toast[] = lastOrderDue(sessions, time).flatMap(session => {
    const key = `lo:${session.id}:${session.otoshiAt}`;
    return isDismissed(key) ? [] : [{
      key, tone: 'warning' as const, message: `${session.tableIds.join('・')}卓 ラストオーダーの時間です`,
      action: { label: 'L.O.確認済みにする', onClick: () => next(session) },
    }];
  });
  const shopTimerToasts: Toast[] = SHOP_TIMERS.flatMap(timer => {
    const state = shopTimerState(timer.intervalMin, shopTimers[timer.id], time);
    const key = `${timer.id}:${state.dueAt}`;
    return state.due && !isDismissed(key)
      ? [{ key, tone: 'danger' as const, message: `${timer.label}の時間です`, action: { label: '済にする', onClick: () => markShopTimerDone(timer.id) } }]
      : [];
  });
  const toasts = [...lastOrderToasts, ...shopTimerToasts];
  const opened = sessions.find(s => s.id === openId && isVisible(s, time));
  return <main className="app">
    <Header inert={Boolean(opened)} time={time} syncState={syncState} showSync={Boolean(store.subscribeSync || shopTimerStore.subscribeSync)} shopTimers={shopTimers} onShopTimerDone={markShopTimerDone} />
    <section inert={Boolean(opened)} className="floor" aria-label="卓タイマー フロア図" style={{ '--cols': GRID.cols, '--rows': GRID.rows } as CSSProperties}>
      <div className="counter-label" aria-hidden="true">カウンター</div>
      <div className="line line-top" aria-hidden="true" />
      <div className="line line-middle" aria-hidden="true" />
      <div className="line line-vertical first" aria-hidden="true" />
      <div className="line line-vertical second" aria-hidden="true" />
      <Toasts toasts={toasts} onDismiss={dismiss} />
      {SEATS.map(position => {
        const session = sessions.filter(s => s.tableIds.includes(position.id) && isVisible(s, time))
          .reduce<Session | undefined>((latest, s) => !latest || s.seatedAt > latest.seatedAt ? s : latest, undefined);
        return <SeatCard key={position.id} seat={position} session={session} time={time} onSeat={seat} onNext={next} onOpen={openPanel} onPay={pay} />;
      })}
    </section>
    {opened && <DetailPanel session={opened} time={time} onClose={closePanel} onNext={next} onBack={back} onRetime={retime} onPay={pay} returnFocus={returnFocus.current} />}
  </main>;
}
