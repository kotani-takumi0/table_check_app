import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { isVisible, occupantOf, unpaidTableCount, type Session } from '@table-check/core/domain';
import { NOTICE_ACTION, noticesOf } from '@table-check/core/notices';
import { GRID, PORTRAIT_GRID, rotateClockwise } from '@table-check/core/layout';
import { DEFAULT_LAYOUT, rotateLabelClockwise, type ShopLayout, type ShopLayoutStore } from '@table-check/core/shopLayout';
import { LayoutEditor } from './LayoutEditor';
import { useMediaQuery } from './useMediaQuery';
import { SeatCard } from './SeatCard';
import { Header } from './Header';
import { DetailPanel } from './DetailPanel';
import { ClearAllDialog } from './ClearAllDialog';
import { SeatDialog } from './SeatDialog';
import { ShopTimerDialog } from './ShopTimerDialog';
import { Toasts, type Toast } from './Toasts';
import { SideMenu, type Screen } from './SideMenu';
import { Settings } from './Settings';
import { useDismissed } from './useDismissed';
import { SHOP_TIMERS, type ShopTimerDone, type ShopTimerId, type ShopTimerStore } from '@table-check/core/shopTimers';
import { DEFAULT_SHOP_SETTINGS, type ShopSettings, type ShopSettingsStore } from '@table-check/core/shopSettings';
import { worstSyncState, type SessionStore, type SyncState } from '@table-check/core/store';
import { useSessions } from '@table-check/core/useSessions';
import { editingSessionIds, type EditingMark, type EditingStore } from '@table-check/core/editing';
import { now } from '@table-check/core/clock';

// trial：Firebase につながず、この端末の中だけで動いている（開発中の試し）
export default function App({ store, shopTimerStore, editingStore, shopSettingsStore, shopLayoutStore, trial = false }: { store: SessionStore; shopTimerStore: ShopTimerStore; editingStore: EditingStore; shopSettingsStore: ShopSettingsStore; shopLayoutStore: ShopLayoutStore; trial?: boolean }) {
  const { sessions, seat, next, back, retime, pay, changeGuests, changeLeaveAt, changeCourse, changeMenu, serve, unserve, moveTo, addTo, release, clearAll } = useSessions(store);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openFrom, setOpenFrom] = useState('');
  // 卓の移動先・追加先を選んでいる間の状態。空席をタップすると反映する
  const [pick, setPick] = useState<{ sessionId: string; mode: 'move' | 'add'; from: string } | null>(null);
  // メニュー（左から出す）で切り替える画面。最初はテーブル状況で、メニューはしまっておく
  const [screen, setScreen] = useState<Screen>('floor');
  const [menuOpen, setMenuOpen] = useState(false);
  const selectScreen = useCallback((next: Screen) => { setScreen(next); setMenuOpen(false); }, []);
  // 店全体の設定（時間制限なし）。全端末で共有する
  const [shopSettings, setShopSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  useEffect(() => shopSettingsStore.subscribe(setShopSettings), [shopSettingsStore]);
  const timeLimitOff = shopSettings.timeLimitOff;
  // 席の配置（No.75）。全端末で共有し、設定 → 席の配置 で作り直す
  const [layout, setLayout] = useState<ShopLayout>(DEFAULT_LAYOUT);
  useEffect(() => shopLayoutStore.subscribe(setLayout), [shopLayoutStore]);
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
  const [shopSettingsSync, setShopSettingsSync] = useState<SyncState>('synced');
  useEffect(() => {
    setShopSettingsSync('synced');
    return shopSettingsStore.subscribeSync?.(setShopSettingsSync);
  }, [shopSettingsStore]);
  useEffect(() => {
    setSessionSync('synced');
    return store.subscribeSync?.(setSessionSync);
  }, [store]);
  useEffect(() => {
    setShopTimerSync('synced');
    return shopTimerStore.subscribeSync?.(setShopTimerSync);
  }, [shopTimerStore]);
  const syncState = worstSyncState([sessionSync, shopTimerSync, shopSettingsSync]);
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
  const toasts: Toast[] = noticesOf(sessions, shopTimers, time, timeLimitOff).filter(notice => !isDismissed(notice.key)).map(notice => ({
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
  // 詳細は押した卓のそばに出す（No.71）。卓の位置は描くたびに取り直す（画面の回転・一覧の開け閉めで動くため）
  const anchor = opened ? document.querySelector(`.floor [data-seat="${CSS.escape(openFrom)}"]`)?.getBoundingClientRect() ?? null : null;
  const modal = Boolean(opened) || clearing || seating !== null || Boolean(openedShopTimer);
  const picked = pick ? sessions.find(s => s.id === pick.sessionId && isVisible(s, time)) : undefined;
  // パネルを開いた卓を「×」で外したら、残っている卓の先頭を移動元にする
  const moveFrom = opened ? (opened.tableIds.includes(openFrom) ? openFrom : opened.tableIds[0]) : openFrom;
  const startPick = useCallback((mode: 'move' | 'add') => {
    if (!openId) return;
    setPick({ sessionId: openId, mode, from: moveFrom });
    setMenuOpen(false);
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
  // メニューは Esc で閉じる（パネルやダイアログを開いている間は、そちらを先に閉じる）。外側のタップはメニューの後ろの透明な面で受ける
  useEffect(() => {
    if (!menuOpen || modal) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, modal]);
  // 縦向きは手描きの配置図と同じ向き（時計回りに90°）。スマホは小さいカード＋タップで詳細
  const portrait = useMediaQuery('(orientation: portrait)');
  const mini = useMediaQuery('(max-width: 600px), (max-height: 600px)');
  const grid = portrait ? PORTRAIT_GRID : GRID;
  const seats = portrait ? layout.seats.map(rotateClockwise) : layout.seats;
  const labels = portrait ? layout.labels.map(rotateLabelClockwise) : layout.labels;
  return <main className={`app ${portrait ? 'portrait' : ''} ${mini ? 'mini' : ''}`}>
    {pick && picked ? <div className="pick-bar" role="status">
      <strong>{pick.mode === 'move' ? `${pick.from}番の移動先の空席をタップしてください` : `${picked.tableIds.join('・')}番に追加する空席をタップしてください`}</strong>
      <button className="toast-button" onClick={() => setPick(null)}>やめる</button>
    </div> : <Header inert={modal} trial={trial} time={time} syncState={syncState} showSync={Boolean(store.subscribeSync || shopTimerStore.subscribeSync)} shopTimers={shopTimers} onShopTimerOpen={openShopTimer} canClearAll={sessions.some(s => isVisible(s, time))} onClearAll={openClear} menuOpen={menuOpen} onToggleMenu={() => setMenuOpen(open => !open)}
      timeLimitOff={timeLimitOff} onOpenSettings={() => selectScreen('settings')} />}
    {screen === 'layout' ? <LayoutEditor layout={layout} occupied={new Set(sessions.filter(s => isVisible(s, time)).flatMap(s => s.tableIds))}
        onSave={async next => {
          const missing = [...new Set(sessions.filter(s => isVisible(s, now())).flatMap(s => s.tableIds))].filter(id => !next.seats.some(seat => seat.id === id));
          if (missing.length) throw new Error(`${missing.join('・')}番にお客さんがいます`);
          await shopLayoutStore.save(next);
        }} onClose={() => selectScreen('settings')} inert={modal || menuOpen} />
      : screen === 'settings' ? <Settings settings={shopSettings} onTimeLimitOff={off => { void shopSettingsStore.setTimeLimitOff(off); }} onOpenLayout={() => selectScreen('layout')} inert={modal || menuOpen} />
      : <section inert={modal || (menuOpen && !pick)} className="floor" aria-label="フロア図" style={{ '--cols': grid.cols, '--rows': grid.rows } as CSSProperties}>
        {labels.map((label, i) => <div key={i} className="floor-label" aria-hidden="true" style={{ gridColumn: `${label.col} / span ${label.colSpan}`, gridRow: `${label.row} / span ${label.rowSpan}` }}>{label.text}</div>)}
        <Toasts toasts={toasts} onDismiss={dismiss} rows={portrait || mini ? 1 : 2} />
      {seats.map(position => <SeatCard key={position.id} seat={position} session={occupantOf(sessions, position.id, time)} time={time} timeLimitOff={timeLimitOff} editing={(() => { const occupant = occupantOf(sessions, position.id, time); return occupant !== undefined && editingIds.has(occupant.id); })()} onSeat={pick ? applyPick : requestSeat} onOpen={openPanel} mini={mini} picking={Boolean(pick)} />)}
      </section>}
    {menuOpen && !pick && <div className="list-backdrop" aria-hidden="true" onClick={() => setMenuOpen(false)} />}
    {menuOpen && !pick && <SideMenu screen={screen} onSelect={selectScreen} inert={modal} />}
    {opened && <DetailPanel session={opened} time={time} othersEditing={editingIds.has(opened.id)} timeLimitOff={timeLimitOff} onClose={closePanel} onNext={next} onSeat={requestSeat} onBack={back} onRetime={retime} onPay={pay} onGuests={changeGuests} onLeaveAt={changeLeaveAt} onCourse={changeCourse} onMenu={changeMenu} onServe={serve} onUnserve={unserve} from={moveFrom} onPick={startPick} onRelease={release} returnFocus={returnFocus.current} anchor={anchor} />}
    {seating !== null && !seatingTaken && <SeatDialog tableId={seating} exited={seatingOccupant?.status === 'exited'} previousUnpaid={seatingOccupant?.paidAt === null} onSeat={(guests, course, menu) => seat(seating, guests, course, menu)} onClose={closeSeating} returnFocus={seatReturnFocus.current} />}
    {openedShopTimer && <ShopTimerDialog label={openedShopTimer.label} icon={openedShopTimer.icon} doneAt={shopTimers[openedShopTimer.id]} onReset={() => markShopTimerDone(openedShopTimer.id)} onClose={closeShopTimer} returnFocus={shopTimerReturnFocus.current} />}
    {clearing && <ClearAllDialog unpaidTables={unpaidTableCount(sessions, time)} onConfirm={clearAll} onClose={closeClear} returnFocus={clearReturnFocus.current} />}
  </main>;
}
