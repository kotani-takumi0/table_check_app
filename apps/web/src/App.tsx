import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { isVisible, occupantOf, pickGuideLabel, sessionRules, unpaidTableCount, type Session } from '@table-check/core/domain';
import { bellSeatId, NOTICE_ACTION, noticesOf } from '@table-check/core/notices';
import { FLOOR_CHROME, MIN_LABEL_PX, MIN_TIME_PX } from '@table-check/core/floorScale';
import { GRID } from '@table-check/core/layout';
import { DEFAULT_LAYOUT, portraitOf, type ShopLayout, type ShopLayoutStore } from '@table-check/core/shopLayout';
import { LayoutEditor } from './LayoutEditor';
import { CourseEditor } from './CourseEditor';
import { coursesInUse, newCourse, putCourse } from '@table-check/core/courseEditor';
import type { CourseMenu } from '@table-check/core/courseMenus';
import { useMediaQuery } from './useMediaQuery';
import { SeatCard } from './SeatCard';
import { Header } from './Header';
import { DetailPanel } from './DetailPanel';
import { ClearAllDialog } from './ClearAllDialog';
import { SeatDialog } from './SeatDialog';
import { Toasts, type Toast } from './Toasts';
import { SideMenu, type Screen } from './SideMenu';
import { Settings } from './Settings';
import { Notices, type NoticeTab } from './Notices';
import { ReleaseBar } from './ReleaseNotes';
import { useReleaseAnnounce } from './useReleaseAnnounce';
import { useRoadmapDot } from './useRoadmapDot';
import { ShopTimerGlyph } from './ShopTimerGlyph';
import { useAppUpdate } from './useAppUpdate';
import { type ShopTimerDone, type ShopTimerId, type ShopTimerStore } from '@table-check/core/shopTimers';
import { DEFAULT_SHOP_SETTINGS, type ShopSettings, type ShopSettingsStore } from '@table-check/core/shopSettings';
import { worstSyncState, type SessionStore, type SyncState } from '@table-check/core/store';
import { useSessions } from '@table-check/core/useSessions';
import { backUndo, checkUndo, nextUndo, shopTimerUndo, UNDO_MS, UNDO_REFUSED, useUndo } from '@table-check/core/undo';
import { UndoBar } from './UndoBar';
import { editingSessionIds, type EditingMark, type EditingStore } from '@table-check/core/editing';
import { now } from '@table-check/core/clock';
import type { FeedbackStore } from '@table-check/core/feedback';
import { businessDayOf, businessDaysRange, csvFileName, sessionsCsv } from '@table-check/core/history';

// trial：Firebase につながず、この端末の中だけで動いている（開発中の試し）
// account：ログインしている店のメールアドレス（今の店は null）。onLeave：ログアウト・ログインし直す（最初の画面に戻る。No.88）
export default function App({ store, shopTimerStore, editingStore, shopSettingsStore, shopLayoutStore, feedbackStore, trial = false, account = null, onLeave, leaveError = '' }: { store: SessionStore; shopTimerStore: ShopTimerStore; editingStore: EditingStore; shopSettingsStore: ShopSettingsStore; shopLayoutStore: ShopLayoutStore; feedbackStore: FeedbackStore; trial?: boolean; account?: string | null; onLeave?(): void; leaveError?: string }) {
  // 店全体の設定（時間のルール・飲み放題の区分・コースなど）。全端末で共有する
  const [shopSettings, setShopSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  useEffect(() => shopSettingsStore.subscribe(setShopSettings), [shopSettingsStore]);
  const { sessions, seat, next, back, retime, pay, changeGuests, changeLeaveAt, changeCourse, changeMenu, serve, unserve, moveTo, addTo, release, clearAll, closeOut } = useSessions(store, undefined, shopSettings.courseMenus);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openFrom, setOpenFrom] = useState('');
  // 卓の移動先・追加先を選んでいる間の状態。空席と退店済みの卓をタップすると反映する（No.133）
  const [pick, setPick] = useState<{ sessionId: string; mode: 'move' | 'add'; from: string } | null>(null);
  // メニュー（左から出す）で切り替える画面。最初はテーブル状況で、メニューはしまっておく
  const [screen, setScreen] = useState<Screen>('floor');
  const [menuOpen, setMenuOpen] = useState(false);
  const [noticeTab, setNoticeTab] = useState<NoticeTab>('roadmap');
  const selectScreen = useCallback((next: Screen) => {
    // 別の画面から開くときは今後の予定。お知らせを開き直したときはタブを残す（ご意見の下書きを消さない）
    if (next === 'notices' && screen !== 'notices') setNoticeTab('roadmap');
    setScreen(next);
    setMenuOpen(false);
  }, [screen]);
  const openUpdates = useCallback(() => { setNoticeTab('updates'); setScreen('notices'); setMenuOpen(false); }, []);
  // 新しい版のお知らせ（No.127）：更新のあと1回だけ帯を出す。最近の更新を開いたら、もう出さない
  const { announce, markSeen } = useReleaseAnnounce();
  useEffect(() => { if (screen === 'notices' && noticeTab === 'updates') markSeen(); }, [screen, noticeTab, markSeen]);
  // 新しい予定（No.144）：メニューに点を1回出す。今後の予定を開いたら、もう出さない。営業中の画面には出さない
  const { show: roadmapNew, markSeen: markRoadmapSeen } = useRoadmapDot();
  useEffect(() => { if (screen === 'notices' && noticeTab === 'roadmap') markRoadmapSeen(); }, [screen, noticeTab, markRoadmapSeen]);
  // 直しているコース（No.89）。新しく足すときは、開いたときに作った下書き
  const [editingCourse, setEditingCourse] = useState<{ course: CourseMenu; isNew: boolean } | null>(null);
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
  // 押し間違えを数秒のうちだけ戻せるようにする（No.102・No.121）。戻せなかったときは理由だけを同じ場所に出す
  const { undo, offer: offerUndo, clear: clearUndo } = useUndo();
  const [undoNote, setUndoNote] = useState<{ message: string; key: number } | null>(null);
  useEffect(() => {
    if (!undoNote) return;
    const timer = setTimeout(() => setUndoNote(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undoNote]);
  const markShopTimerDone = useCallback((id: ShopTimerId) => {
    const at = now();
    void shopTimerStore.markDone(id, at);
    const label = shopSettings.shopTimers.find(timer => timer.id === id)?.label ?? 'タイマー';
    offerUndo(shopTimerUndo(id, label, shopTimers[id], at));
    setUndoNote(null);
  }, [shopTimerStore, shopSettings.shopTimers, shopTimers, offerUndo]);
  const backWithUndo = useCallback((session: Session) => {
    offerUndo(backUndo(session, back(session), shopSettings));
    setUndoNote(null);
  }, [back, shopSettings, offerUndo]);
  // 進めたあと（詳細の大きいボタン・通知の「L.O.確認済みにする」）。No.122 で詳細のボタンにも出す
  const nextWithUndo = useCallback((session: Session) => {
    offerUndo(nextUndo(session, next(session), shopSettings));
    setUndoNote(null);
  }, [next, shopSettings, offerUndo]);
  const applyUndo = () => {
    if (!undo) return;
    const check = checkUndo(undo, sessions, shopTimers);
    clearUndo();
    if (check !== 'ok') { setUndoNote({ message: UNDO_REFUSED[check], key: undo.key }); return; }
    if (undo.kind === 'session') void store.put(undo.before);
    else void shopTimerStore.undoDone(undo.id, undo.after, undo.before);
  };
  // 閉店時刻（No.129）：過ぎても退店していない卓を、閉店で退店にする。1分ごと（とお客さんが変わったとき）に確かめ、退店にしたら下の帯で知らせる
  const minuteNow = Math.floor(time / 60_000);
  useEffect(() => {
    const count = closeOut(shopSettings.closingMin, now());
    if (count > 0) setUndoNote({ message: `閉店時刻を過ぎたので、${count}組を退店にしました`, key: now() });
  }, [closeOut, shopSettings.closingMin, minuteNow]);
  useEffect(() => {
    const interval = setInterval(() => setTime(now()), 1000);
    return () => clearInterval(interval);
  }, []);
  // 通知（No.109）：L.O.とお店のタイマー。「済にする」などを押すまで残し、ポップアップを閉じてもヘッダーの「通知」から開き直せる
  const notices = noticesOf(sessions, shopTimers, time, session => sessionRules(shopSettings, session, shopSettings.courseMenus), shopSettings.shopTimers);
  const toasts: Toast[] = notices.map(notice => ({
    key: notice.key, tone: notice.tone, message: notice.message,
    icon: notice.kind === 'shop_timer' ? <ShopTimerGlyph icon={shopSettings.shopTimers.find(timer => timer.id === notice.timerId)?.icon ?? ''} className="toast-glyph" />
      : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
    action: { label: NOTICE_ACTION[notice.kind], onClick: () => notice.kind === 'last_order' ? nextWithUndo(notice.session) : markShopTimerDone(notice.timerId) },
  }));
  // 新しい通知が来たらポップアップを開き、その通知を出す。10秒でヘッダーの「通知」にしまう（Toasts の下の線が縮みきったとき）
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [shownNotice, setShownNotice] = useState<string | null>(null);
  const [noticeRun, setNoticeRun] = useState(0);
  const openNotices = useCallback((key: string | null) => { setShownNotice(key); setNoticesOpen(true); setNoticeRun(run => run + 1); }, []);
  const seenNotices = useRef<Set<string>>(new Set());
  const noticeKeys = toasts.map(toast => toast.key).join('\n');
  useEffect(() => {
    const keys = noticeKeys === '' ? [] : noticeKeys.split('\n');
    const fresh = keys.find(key => !seenNotices.current.has(key));
    seenNotices.current = new Set(keys);
    if (fresh !== undefined) openNotices(fresh);
    else if (keys.length === 0) setNoticesOpen(false);
  }, [noticeKeys, openNotices]);
  // 卓に今表示しているお客さん（同じ卓に複数あれば後から案内したほう）
  const requestSeat = (tableId: string) => {
    // 詳細パネルから押したときはパネルが閉じるので、パネルを開いた卓に戻す
    const active = document.activeElement;
    seatReturnFocus.current = active instanceof HTMLElement && !active.closest('.panel') ? active : returnFocus.current;
    setSeating(tableId);
  };
  const seatingOccupant = seating === null ? undefined : occupantOf(sessions, seating, time, shopSettings);
  // 確認中にほかの端末でその卓に案内されたら、確認をやめる（退店済の表示が消えただけなら続ける）
  const seatingTaken = seatingOccupant !== undefined && seatingOccupant.status !== 'exited';
  useEffect(() => { if (seatingTaken) setSeating(null); }, [seatingTaken]);
  const opened = sessions.find(s => s.id === openId && isVisible(s, time, shopSettings));
  // 編集中の印（No.72）：詳細を開いているお客さんをほかの端末に知らせ、ほかの端末が開いている卓に「編集中」を出す
  const [editingMarks, setEditingMarks] = useState<EditingMark[]>([]);
  useEffect(() => editingStore.subscribe(setEditingMarks), [editingStore]);
  const editingIds = editingSessionIds(editingMarks, time);
  const openedId = opened?.id ?? null;
  useEffect(() => { editingStore.setEditing(openedId); }, [editingStore, openedId]);
  useEffect(() => () => editingStore.setEditing(null), [editingStore]);
  // 詳細は押した卓のそばに出す（No.71）。卓の位置は描くたびに取り直す（画面の回転・一覧の開け閉めで動くため）
  const anchor = opened ? document.querySelector(`.floor [data-seat="${CSS.escape(openFrom)}"]`)?.getBoundingClientRect() ?? null : null;
  // ご案内も押した卓のそばに出す（No.85。詳細パネルの「ご案内」から開いたときも、その卓のそば）
  const seatingAnchor = seating === null ? null : document.querySelector(`.floor [data-seat="${CSS.escape(seating)}"]`)?.getBoundingClientRect() ?? null;
  const modal = Boolean(opened) || clearing || seating !== null;
  const picked = pick ? sessions.find(s => s.id === pick.sessionId && isVisible(s, time, shopSettings)) : undefined;
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
  const chrome = mini ? FLOOR_CHROME.mini : FLOOR_CHROME.regular;
  // 通知のベルで、画面の外の卓まで動いて少し光らせる（No.146）。帯は固定のまま、配置図だけをスクロールする
  const floorFrame = useRef<HTMLDivElement>(null);
  const [flashSeat, setFlashSeat] = useState<string | null>(null);
  // 右にまだ卓があるときだけ、枠の右端に影を出す（端まで送ったら消す。No.146）
  const [floorMoreX, setFloorMoreX] = useState(false);
  const syncFloorMore = useCallback(() => {
    const frame = floorFrame.current;
    if (!frame) return;
    const bar = frame.offsetWidth - frame.clientWidth;
    frame.parentElement?.style.setProperty('--floor-bar', `${bar}px`);
    const more = frame.scrollWidth - frame.clientWidth - frame.scrollLeft > 2;
    setFloorMoreX(current => current === more ? current : more);
  }, []);
  const revealSeat = (tableId: string) => {
    setFlashSeat(null);
    window.requestAnimationFrame(() => setFlashSeat(tableId));
  };
  useEffect(() => {
    if (!flashSeat || screen !== 'floor') return;
    const frame = floorFrame.current;
    const seat = frame?.querySelector<HTMLElement>(`[data-seat="${CSS.escape(flashSeat)}"]`);
    if (frame && seat) {
      const seatBox = seat.getBoundingClientRect();
      const frameBox = frame.getBoundingClientRect();
      const visible = seatBox.top >= frameBox.top - 1 && seatBox.bottom <= frameBox.bottom + 1 && seatBox.left >= frameBox.left - 1 && seatBox.right <= frameBox.right + 1;
      if (!visible) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        frame.scrollTo({
          top: Math.max(0, seatBox.top - frameBox.top + frame.scrollTop - (frame.clientHeight - seatBox.height) / 2),
          left: Math.max(0, seatBox.left - frameBox.left + frame.scrollLeft - (frame.clientWidth - seatBox.width) / 2),
          behavior: reduce ? 'auto' : 'smooth',
        });
      }
    }
    const timer = window.setTimeout(() => setFlashSeat(current => current === flashSeat ? null : current), 1400);
    return () => window.clearTimeout(timer);
  }, [flashSeat, screen]);
  // 新しい版（No.83）：詳細・ダイアログ・メニュー・卓選び・席の配置・ご意見を書いている途中では読み込み直さない
  const { updateReady, reload } = useAppUpdate(modal || menuOpen || Boolean(pick) || screen === 'layout' || screen === 'course' || (screen === 'notices' && noticeTab === 'feedback'), syncState);
  // 縦向きは、置いてある行までを回して出す（No.108。何も置いていない下の行は出さない）
  const turned = portrait ? portraitOf(layout) : null;
  const grid = turned?.grid ?? GRID;
  const seats = turned?.seats ?? layout.seats;
  const labels = turned?.labels ?? layout.labels;
  useLayoutEffect(() => {
    const frame = floorFrame.current;
    if (!frame || screen !== 'floor') return;
    syncFloorMore();
    const observer = new ResizeObserver(syncFloorMore);
    observer.observe(frame);
    const floor = frame.querySelector('.floor');
    if (floor) observer.observe(floor);
    return () => observer.disconnect();
  }, [syncFloorMore, screen, grid.cols, grid.rows, mini]);
  return <main className={`app ${portrait ? 'portrait' : ''} ${mini ? 'mini' : ''}`}>
    {pick && picked ? <div className="pick-bar" role="status">
      <strong>{pickGuideLabel(pick.mode, pick.from, picked.tableIds)}</strong>
      <button className="toast-button" onClick={() => setPick(null)}>やめる</button>
    </div> : <Header inert={modal} trial={trial} time={time} syncState={syncState} showSync={Boolean(store.subscribeSync || shopTimerStore.subscribeSync)} timers={shopSettings.shopTimers} shopTimers={shopTimers} onShopTimerDone={markShopTimerDone} canClearAll={sessions.some(s => isVisible(s, time, shopSettings))} onClearAll={openClear} menuOpen={menuOpen} onToggleMenu={() => setMenuOpen(open => !open)}
      timeLimitOff={timeLimitOff} onOpenSettings={() => selectScreen('settings')} updateReady={updateReady} onUpdate={reload}
      noticeCount={toasts.length} noticesOpen={noticesOpen && screen === 'floor'} onOpenNotices={() => {
        if (screen !== 'floor') selectScreen('floor');
        openNotices(shownNotice);
        const seatId = bellSeatId(notices, shownNotice);
        if (seatId) revealSeat(seatId);
      }} />}
    {screen === 'layout' ? <LayoutEditor layout={layout} occupied={new Set(sessions.filter(s => isVisible(s, time, shopSettings)).flatMap(s => s.tableIds))}
        onSave={async next => {
          const missing = [...new Set(sessions.filter(s => isVisible(s, now(), shopSettings)).flatMap(s => s.tableIds))].filter(id => !next.seats.some(seat => seat.id === id));
          if (missing.length) throw new Error(`${missing.join('・')}番にお客さんがいます`);
          await shopLayoutStore.save(next, shopSettings);
        }} onClose={() => selectScreen('settings')} inert={modal || menuOpen} />
      : screen === 'course' && editingCourse ? <CourseEditor key={editingCourse.course.id} course={editingCourse.course} isNew={editingCourse.isNew} settings={shopSettings}
          usedBy={coursesInUse(sessions, time, shopSettings).get(editingCourse.course.id) ?? []}
          onSave={course => {
            const courseMenus = putCourse(shopSettings.courseMenus, course);
            if (courseMenus) void shopSettingsStore.update({ courseMenus });
            return courseMenus !== null;
          }}
          onDelete={() => { void shopSettingsStore.update({ courseMenus: shopSettings.courseMenus.filter(menu => menu.id !== editingCourse.course.id) }); }}
          onClose={() => selectScreen('settings')} inert={modal || menuOpen} />
      : screen === 'settings' || screen === 'course' ? <Settings settings={shopSettings} onChange={change => { void shopSettingsStore.update(change); }} onOpenLayout={() => selectScreen('layout')}
          onEditCourse={id => {
            const course = id === null ? null : shopSettings.courseMenus.find(menu => menu.id === id);
            setEditingCourse(course ? { course, isNew: false } : { course: newCourse(shopSettings.courseMenus, Date.now()), isNew: true });
            selectScreen('course');
          }} today={businessDayOf(time)} onExportCsv={async (from, to) => {
            const range = businessDaysRange(from, to);
            if (!range) throw new Error('はじめの日をおわりの日より前にしてください');
            const recorded = await store.fetchSeatedBetween(range.start, range.end);
            if (recorded.length > 0) downloadText(csvFileName(from, to), sessionsCsv(recorded, shopSettings), 'text/csv');
            return recorded.length;
          }} inert={modal || menuOpen} />
      : screen === 'notices' ? <Notices tab={noticeTab} onTab={setNoticeTab} roadmapNew={roadmapNew} feedbackStore={feedbackStore} shopName={shopSettings.shopName} shopId={account ?? 'guest'} inert={modal || menuOpen} />
      : <div className={`floor-scroll${floorMoreX ? ' more-x' : ''}`}>
        <div className="floor-frame" ref={floorFrame} onScroll={syncFloorMore}>
        {/* No.108：全面を同じ大きさの正方形のマスで敷き詰める。何も置いていないマスも薄い面で見せ、画面全体が1枚のマス目だと分かるようにする */}
        {/* No.146：マスの下限・余白は floorScale の FLOOR_CHROME。入りきらなければこの枠だけがスクロールする */}
        <section inert={modal || (menuOpen && !pick)} className="floor" aria-label="フロア図" style={{
          '--cols': grid.cols, '--rows': grid.rows, '--gap': `${chrome.gap}px`, '--pad-x': `${chrome.padX}px`, '--pad-y': `${chrome.padY}px`, '--min-cell': `${chrome.minCell}px`,
          '--label-min': `${MIN_LABEL_PX}px`, '--time-min': `${MIN_TIME_PX}px`,
        } as CSSProperties}>
        {Array.from({ length: grid.cols * grid.rows }, (_, i) => <span key={`cell-${i}`} className="floor-cell" aria-hidden="true" style={{ gridColumn: i % grid.cols + 1, gridRow: Math.floor(i / grid.cols) + 1 }} />)}
        {labels.map((label, i) => <div key={i} className="floor-label" aria-hidden="true" style={{ gridColumn: `${label.col} / span ${label.colSpan}`, gridRow: `${label.row} / span ${label.rowSpan}` }}>{label.text}</div>)}
      {seats.map(position => <SeatCard key={position.id} seat={position} session={occupantOf(sessions, position.id, time, shopSettings)} time={time} settings={shopSettings} editing={(() => { const occupant = occupantOf(sessions, position.id, time, shopSettings); return occupant !== undefined && editingIds.has(occupant.id); })()} onSeat={pick ? applyPick : requestSeat} onOpen={openPanel} mini={mini} picking={Boolean(pick)} selected={(opened !== undefined && openFrom === position.id) || seating === position.id} flashing={flashSeat === position.id} />)}
        </section>
        </div>
      </div>}
    {noticesOpen && screen === 'floor' && <Toasts toasts={toasts} shownKey={shownNotice} run={noticeRun} onShow={key => openNotices(key)} onTuck={() => setNoticesOpen(false)} onAction={() => setNoticeRun(run => run + 1)} />}
    {menuOpen && !pick && <div className="list-backdrop" aria-hidden="true" onClick={() => setMenuOpen(false)} />}
    {menuOpen && !pick && <SideMenu screen={screen} onSelect={selectScreen} account={account} shopName={shopSettings.shopName} onLeave={onLeave} leaveError={leaveError} inert={modal} roadmapNew={roadmapNew} />}
    {opened && <DetailPanel session={opened} time={time} othersEditing={editingIds.has(opened.id)} settings={shopSettings} onClose={closePanel} onNext={nextWithUndo} onSeat={requestSeat} onBack={backWithUndo} onRetime={retime} onPay={pay} onGuests={changeGuests} onLeaveAt={changeLeaveAt} onCourse={changeCourse} onMenu={changeMenu} onServe={serve} onUnserve={unserve} from={moveFrom} onPick={startPick} onRelease={release} returnFocus={returnFocus.current} anchor={anchor} sheet={mini} />}
    {seating !== null && !seatingTaken && <SeatDialog tableId={seating} exited={seatingOccupant?.status === 'exited'} previousUnpaid={seatingOccupant?.paidAt === null} onSeat={(guests, course, menu) => seat(seating, guests, course, menu)} settings={shopSettings} onClose={closeSeating} returnFocus={seatReturnFocus.current} anchor={seatingAnchor} sheet={mini} />}
    {undo ? <UndoBar message={undo.message} runKey={undo.key} onUndo={applyUndo} /> : undoNote ? <UndoBar message={undoNote.message} runKey={undoNote.key} />
      : announce && !pick && screen === 'floor' && <ReleaseBar onOpen={openUpdates} onClose={markSeen} />}
    {clearing && <ClearAllDialog unpaidTables={unpaidTableCount(sessions, time, shopSettings)} onConfirm={() => clearAll(shopSettings)} onClose={closeClear} returnFocus={clearReturnFocus.current} />}
  </main>;
}
// 文字のファイルをこの端末に保存する（履歴の CSV。No.34）
function downloadText(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
