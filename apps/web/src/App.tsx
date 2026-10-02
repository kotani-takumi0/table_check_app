import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { isVisible, occupantOf, unpaidTableCount, type Session } from '@table-check/core/domain';
import { NOTICE_ACTION, noticesOf } from '@table-check/core/notices';
import { GRID, PORTRAIT_GRID, rotateClockwise, SEATS } from '@table-check/core/layout';
import { useMediaQuery } from './useMediaQuery';
import { SeatCard } from './SeatCard';
import { Header } from './Header';
import { DetailPanel } from './DetailPanel';
import { ClearAllDialog } from './ClearAllDialog';
import { SeatDialog } from './SeatDialog';
import { ShopTimerDialog } from './ShopTimerDialog';
import { Toasts, type Toast } from './Toasts';
import { TableList } from './TableList';
import { useDismissed } from './useDismissed';
import { SHOP_TIMERS, type ShopTimerDone, type ShopTimerId, type ShopTimerStore } from '@table-check/core/shopTimers';
import { worstSyncState, type SessionStore, type SyncState } from '@table-check/core/store';
import { useSessions } from '@table-check/core/useSessions';
import { editingSessionIds, type EditingMark, type EditingStore } from '@table-check/core/editing';
import { now } from '@table-check/core/clock';

export default function App({ store, shopTimerStore, editingStore }: { store: SessionStore; shopTimerStore: ShopTimerStore; editingStore: EditingStore }) {
  const { sessions, seat, next, back, retime, pay, changeGuests, changeCourse, changeMenu, serve, unserve, moveTo, addTo, release, clearAll } = useSessions(store);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openFrom, setOpenFrom] = useState('');
  // 卓の移動先・追加先を選んでいる間の状態。空席をタップすると反映する
  const [pick, setPick] = useState<{ sessionId: string; mode: 'move' | 'add'; from: string } | null>(null);
  // 全卓一覧（左から出す）。最初はしまっておく
  const [listOpen, setListOpen] = useState(false);
  const closePanel = useCallback(() => setOpenId(null), []);
  // 開くと背景が inert になりフォーカスが外れるので、開く前に覚えておく
  const returnFocus = useRef<HTMLElement | null>(null);
  const openPanel = useCallback((session: Session, from: string) => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpenId(session.id);
    setOpenFrom(from);
  }, []);
  const [clearing, setClearing] = useState(false);
  const clearReturnFocus = useRef<HTMLElement | null>(null);
  const openClear = useCallback(() => {
    clearReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setClearing(true);
  }, []);
  const closeClear = useCallback(() => setClearing(false), []);
  // ご案内の確認：コース・人数を聞き、退店済の卓は前のお客さんを置き換えることを確かめる
  const [seating, setSeating] = useState<string | null>(null);
  const seatReturnFocus = useRef<HTMLElement | null>(null);
  const closeSeating = useCallback(() => setSeating(null), []);
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
  // ヘッダーのトイレタイマーは詳細を開き、そこから済にする（通知の「済にする」はすぐ済にする）
  const [shopTimerOpen, setShopTimerOpen] = useState<ShopTimerId | null>(null);
  const shopTimerReturnFocus = useRef<HTMLElement | null>(null);
  const openShopTimer = useCallback((id: ShopTimerId) => {
    shopTimerReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setShopTimerOpen(id);
  }, []);
  const closeShopTimer = useCallback(() => setShopTimerOpen(null), []);
  const openedShopTimer = SHOP_TIMERS.find(timer => timer.id === shopTimerOpen);
  const { isDismissed, dismiss } = useDismissed();
  useEffect(() => {
    const interval = setInterval(() => setTime(now()), 1000);
    return () => clearInterval(interval);
  }, []);
  // 「閉じる」はこの端末だけ
  const toasts: Toast[] = noticesOf(sessions, shopTimers, time).filter(notice => !isDismissed(notice.key)).map(notice => ({
    key: notice.key, tone: notice.tone, message: notice.message,
    action: { label: NOTICE_ACTION[notice.kind], onClick: () => notice.kind === 'last_order' ? next(notice.session) : markShopTimerDone(notice.timerId) },
  }));
  // 卓に今表示しているお客さん（同じ卓に複数あれば後から案内したほう）
  const requestSeat = (tableId: string) => {
    // 詳細パネルから押したときはパネルが閉じるので、パネルを開いた卓に戻す
    const active = document.activeElement;
    seatReturnFocus.current = active instanceof HTMLElement && !active.closest('.panel') ? active : returnFocus.current;
    setSeating(tableId);
  };
  const seatingOccupant = seating === null ? undefined : occupantOf(sessions, seating, time);
  // 確認中にほかの端末でその卓に案内されたら、確認をやめる（退店済の表示が消えただけなら続ける）
  const seatingTaken = seatingOccupant !== undefined && seatingOccupant.status !== 'exited';
  useEffect(() => { if (seatingTaken) setSeating(null); }, [seatingTaken]);
  const opened = sessions.find(s => s.id === openId && isVisible(s, time));
  // 編集中の印（No.72）：詳細を開いているお客さんをほかの端末に知らせ、ほかの端末が開いている卓に「編集中」を出す
  const [editingMarks, setEditingMarks] = useState<EditingMark[]>([]);
  useEffect(() => editingStore.subscribe(setEditingMarks), [editingStore]);
  const editingIds = editingSessionIds(editingMarks, time);
  const openedId = opened?.id ?? null;
  useEffect(() => { editingStore.setEditing(openedId); }, [editingStore, openedId]);
  useEffect(() => () => editingStore.setEditing(null), [editingStore]);
  const modal = Boolean(opened) || clearing || seating !== null || Boolean(openedShopTimer);
  const picked = pick ? sessions.find(s => s.id === pick.sessionId && isVisible(s, time)) : undefined;
  // パネルを開いた卓を「×」で外したら、残っている卓の先頭を移動元にする
  const moveFrom = opened ? (opened.tableIds.includes(openFrom) ? openFrom : opened.tableIds[0]) : openFrom;
  const startPick = useCallback((mode: 'move' | 'add') => {
    if (!openId) return;
    setPick({ sessionId: openId, mode, from: moveFrom });
    setListOpen(false);
    setOpenId(null);
  }, [openId, moveFrom]);
  const applyPick = (tableId: string) => {
    if (pick && picked) {
      if (pick.mode === 'move') moveTo(picked, pick.from, tableId);
      else addTo(picked, tableId);
    }
    setPick(null);
  };
  // 選んでいる間にその客が退店・取り消しされたら、選ぶのをやめる
  useEffect(() => { if (pick && !picked) setPick(null); }, [pick, picked]);
  useEffect(() => {
    if (!pick) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setPick(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick]);
  // 一覧は Esc で閉じる（パネルやダイアログを開いている間は、そちらを先に閉じる）。外側のタップは一覧の後ろの透明な面で受ける
  useEffect(() => {
    if (!listOpen || modal) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setListOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [listOpen, modal]);
  // 縦向きは手描きの配置図と同じ向き（時計回りに90°）。スマホは小さいカード＋タップで詳細
  const portrait = useMediaQuery('(orientation: portrait)');
  const mini = useMediaQuery('(max-width: 600px), (max-height: 600px)');
  const grid = portrait ? PORTRAIT_GRID : GRID;
  const seats = portrait ? SEATS.map(rotateClockwise) : SEATS;
  return <main className={`app ${portrait ? 'portrait' : ''} ${mini ? 'mini' : ''}`}>
    {pick && picked ? <div className="pick-bar" role="status">
      <strong>{pick.mode === 'move' ? `${pick.from}番の移動先の空席をタップしてください` : `${picked.tableIds.join('・')}番に追加する空席をタップしてください`}</strong>
      <button className="toast-button" onClick={() => setPick(null)}>やめる</button>
    </div> : <Header inert={modal} time={time} syncState={syncState} showSync={Boolean(store.subscribeSync || shopTimerStore.subscribeSync)} shopTimers={shopTimers} onShopTimerOpen={openShopTimer} canClearAll={sessions.some(s => isVisible(s, time))} onClearAll={openClear} listOpen={listOpen} onToggleList={() => setListOpen(open => !open)} />}
    <section inert={modal || (listOpen && !pick)} className="floor" aria-label="フロア図" style={{ '--cols': grid.cols, '--rows': grid.rows } as CSSProperties}>
      <div className="counter-label" aria-hidden="true">カウンター</div>
      <Toasts toasts={toasts} onDismiss={dismiss} rows={portrait || mini ? 1 : 2} />
      {seats.map(position => <SeatCard key={position.id} seat={position} session={occupantOf(sessions, position.id, time)} time={time} editing={(() => { const occupant = occupantOf(sessions, position.id, time); return occupant !== undefined && editingIds.has(occupant.id); })()} onSeat={pick ? applyPick : requestSeat} onNext={next} onOpen={openPanel} mini={mini} picking={Boolean(pick)} />)}
    </section>
    {listOpen && !pick && <div className="list-backdrop" aria-hidden="true" onClick={() => setListOpen(false)} />}
    {listOpen && !pick && <TableList sessions={sessions} time={time} onOpen={openPanel} inert={modal} />}
    {opened && <DetailPanel session={opened} time={time} othersEditing={editingIds.has(opened.id)} onClose={closePanel} onNext={next} onSeat={requestSeat} onBack={back} onRetime={retime} onPay={pay} onGuests={changeGuests} onCourse={changeCourse} onMenu={changeMenu} onServe={serve} onUnserve={unserve} from={moveFrom} onPick={startPick} onRelease={release} returnFocus={returnFocus.current} />}
    {seating !== null && !seatingTaken && <SeatDialog tableId={seating} exited={seatingOccupant?.status === 'exited'} previousUnpaid={seatingOccupant?.paidAt === null} onSeat={(guests, course, menu) => seat(seating, guests, course, menu)} onClose={closeSeating} returnFocus={seatReturnFocus.current} />}
    {openedShopTimer && <ShopTimerDialog label={openedShopTimer.label} icon={openedShopTimer.icon} doneAt={shopTimers[openedShopTimer.id]} onReset={() => markShopTimerDone(openedShopTimer.id)} onClose={closeShopTimer} returnFocus={shopTimerReturnFocus.current} />}
    {clearing && <ClearAllDialog unpaidTables={unpaidTableCount(sessions, time)} onConfirm={clearAll} onClose={closeClear} returnFocus={clearReturnFocus.current} />}
  </main>;
}
