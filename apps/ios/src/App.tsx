import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { randomUUID } from 'expo-crypto';
import { useKeepAwake } from 'expo-keep-awake';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { now } from '@table-check/core/clock';
import { isVisible, occupantOf, sessionRules, unpaidTableCount, type Session } from '@table-check/core/domain';
import { NOTICE_ACTION, noticesOf } from '@table-check/core/notices';
import { SHOP_TIMERS, type ShopTimerDone, type ShopTimerId } from '@table-check/core/shopTimers';
import { DEFAULT_SHOP_SETTINGS, type ShopSettings } from '@table-check/core/shopSettings';
import { DEFAULT_LAYOUT, type ShopLayout } from '@table-check/core/shopLayout';
import { worstSyncState, type SyncState } from '@table-check/core/store';
import { useSessions } from '@table-check/core/useSessions';
import { editingSessionIds, type EditingMark } from '@table-check/core/editing';
import { services, type Services } from './services';
import { COLORS, useScreen } from './theme';
import { feedback } from './feedback';
import { useDismissed } from './useDismissed';
import { Header, TOOLBAR_HEIGHT } from './Header';
import { Popover } from './Popover';
import { LIQUID_GLASS } from './Glass';
// フロアの上端。ツールバー（上から4、高さ TOOLBAR_HEIGHT）の下に卓の上端が少しもぐる。
// 縦向きは上の段がカウンター席で卓番が丸の上にあり、スマホは卓が小さく卓番が上の端の近くにあるので、どちらももぐらせない
const FLOOR_TOP = { regular: 40, portrait: TOOLBAR_HEIGHT.regular + 12, mini: TOOLBAR_HEIGHT.mini + 6 } as const;
import { Floor } from './Floor';
import { Toasts, type Toast } from './Toasts';
import { SideMenu, type Screen } from './SideMenu';
import { Settings } from './Settings';
import { LayoutEditor } from './LayoutEditor';
import { CourseEditor } from './CourseEditor';
import { coursesInUse, newCourse, putCourse } from '@table-check/core/courseEditor';
import type { CourseMenu } from '@table-check/core/courseMenus';
import { PanelButton } from './ui';
import { SeatSheet } from './sheets/SeatSheet';
import { DetailSheet } from './sheets/DetailSheet';
import { ShopTimerSheet } from './sheets/ShopTimerSheet';
import { ClearAllSheet } from './sheets/ClearAllSheet';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.screen}>
        <Hall services={services} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// Web の App と同じ画面：フロア図・ヘッダー・通知と、案内・詳細・トイレ・全卓消去のシート
function Hall({ services: { store, shopTimerStore, editingStore, shopSettingsStore, shopLayoutStore, trial } }: { services: Services }) {
  // 営業中に画面が暗くならないようにする
  useKeepAwake();
  // 店全体の設定（時間のルール・飲み放題の区分・コースなど）。全端末で共有する
  const [shopSettings, setShopSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  useEffect(() => shopSettingsStore.subscribe(setShopSettings), [shopSettingsStore]);
  const { sessions, seat, next, back, retime, pay, changeGuests, changeLeaveAt, changeCourse, changeMenu, serve, unserve, moveTo, addTo, release, clearAll } = useSessions(store, randomUUID, shopSettings.courseMenus);
  const [time, setTime] = useState(now);
  useEffect(() => {
    const interval = setInterval(() => setTime(now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const [sessionSync, setSessionSync] = useState<SyncState>('synced');
  const [shopTimerSync, setShopTimerSync] = useState<SyncState>('synced');
  useEffect(() => store.subscribeSync?.(setSessionSync), [store]);
  useEffect(() => shopTimerStore.subscribeSync?.(setShopTimerSync), [shopTimerStore]);
  const [shopSettingsSync, setShopSettingsSync] = useState<SyncState>('synced');
  useEffect(() => shopSettingsStore.subscribeSync?.(setShopSettingsSync), [shopSettingsStore]);
  const timeLimitOff = shopSettings.timeLimitOff;
  // 席の配置（No.75）。設定 → 席の配置 で作り直す（iOS は No.86）
  const [layout, setLayout] = useState<ShopLayout>(DEFAULT_LAYOUT);
  useEffect(() => shopLayoutStore.subscribe(setLayout), [shopLayoutStore]);
  const [shopTimers, setShopTimers] = useState<ShopTimerDone>({});
  useEffect(() => shopTimerStore.subscribe(setShopTimers), [shopTimerStore]);
  const markShopTimerDone = useCallback((id: ShopTimerId) => { void shopTimerStore.markDone(id, now()); }, [shopTimerStore]);
  const { isDismissed, dismiss } = useDismissed();

  const [openId, setOpenId] = useState<string | null>(null);
  const [openFrom, setOpenFrom] = useState('');
  // ご案内の確認：コース・人数を聞き、退店済の卓は前のお客さんを置き換えることを確かめる
  const [seating, setSeating] = useState<string | null>(null);
  const [shopTimerOpen, setShopTimerOpen] = useState<ShopTimerId | null>(null);
  const [clearing, setClearing] = useState(false);
  // 卓の移動先・追加先を選んでいる間の状態。空席をタップすると反映する
  const [pick, setPick] = useState<{ sessionId: string; mode: 'move' | 'add'; from: string } | null>(null);
  // メニュー（左から出す）で切り替える画面。最初はテーブル状況で、メニューはしまっておく
  const [screen, setScreen] = useState<Screen>('floor');
  const [menuOpen, setMenuOpen] = useState(false);
  const selectScreen = useCallback((next: Screen) => { setScreen(next); setMenuOpen(false); }, []);
  // 直しているコース（No.89）。新しく足すときは、開いたときに作った下書き
  const [editingCourse, setEditingCourse] = useState<{ course: CourseMenu; isNew: boolean } | null>(null);

  // 詳細は押した場所のそばに出す（No.71）。スマホは幅が足りないので、今までどおり下からのシート
  const [openAt, setOpenAt] = useState<{ x: number; y: number } | undefined>(undefined);
  const openPanel = useCallback((session: Session, from: string, at?: { x: number; y: number }) => { setOpenId(session.id); setOpenFrom(from); setOpenAt(at); }, []);
  // 詳細パネルから案内したときは、同じシートの中で案内の確認に切り替える
  const requestSeat = useCallback((tableId: string) => { setOpenId(null); setSeating(tableId); }, []);
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
      feedback.done();
      if (pick.mode === 'move') moveTo(picked, pick.from, tableId);
      else addTo(picked, tableId);
    }
    setPick(null);
  };
  // 選んでいる間にその客が退店・取り消しされたら、選ぶのをやめる
  useEffect(() => { if (pick && !picked) setPick(null); }, [pick, picked]);

  // 「閉じる」はこの端末だけ
  const toasts: Toast[] = noticesOf(sessions, shopTimers, time, session => sessionRules(shopSettings, session, shopSettings.courseMenus)).filter(notice => !isDismissed(notice.key)).map(notice => ({
    key: notice.key, tone: notice.tone, message: notice.message,
    action: { label: NOTICE_ACTION[notice.kind], onPress: () => { feedback.step(); if (notice.kind === 'last_order') next(notice.session); else markShopTimerDone(notice.timerId); } },
  }));
  const openedShopTimer = SHOP_TIMERS.find(timer => timer.id === shopTimerOpen);
  const closeSheet = useCallback(() => { setSeating(null); setOpenId(null); setShopTimerOpen(null); setClearing(false); }, []);
  const { portrait, mini } = useScreen();
  let content: ReactNode = null;
  // トイレ・全卓消去は iOS 26 のアラートのように、押したボタンのそばからポップオーバーで出す。詳細（iPad）は押した卓のそばに出す
  let popover: ReactNode = null;
  let popoverAt: { x: number; y: number } | undefined;
  if (seating !== null && !seatingTaken) {
    content = <SeatSheet key={`seat-${seating}`} tableId={seating} exited={seatingOccupant?.status === 'exited'} previousUnpaid={seatingOccupant?.paidAt === null}
      onSeat={(guests, course, menu) => seat(seating, guests, course, menu)} settings={shopSettings} onClose={closeSheet} />;
  } else if (opened) {
    const detail = <DetailSheet key={`detail-${opened.id}`} session={opened} time={time} othersEditing={editingIds.has(opened.id)} settings={shopSettings} onClose={closeSheet} onNext={next} onSeat={requestSeat} onBack={back} onRetime={retime}
      onPay={pay} onGuests={changeGuests} onLeaveAt={changeLeaveAt} onCourse={changeCourse} onMenu={changeMenu} onServe={serve} onUnserve={unserve} from={moveFrom} onPick={startPick} onRelease={release} />;
    if (!mini && openAt) { popover = detail; popoverAt = openAt; } else content = detail;
  }
  if (content === null && popover === null && openedShopTimer) {
    popover = <ShopTimerSheet label={openedShopTimer.label} icon={openedShopTimer.icon} doneAt={shopTimers[openedShopTimer.id]} onReset={() => markShopTimerDone(openedShopTimer.id)} onClose={closeSheet} />;
  } else if (content === null && popover === null && clearing) {
    popover = <ClearAllSheet unpaidTables={unpaidTableCount(sessions, time, shopSettings)} onConfirm={clearAll} onClose={closeSheet} />;
  }
  // シートが下がっていく間も、閉じる前の中身を出しておく
  const lastContent = useRef<ReactNode>(null);
  if (content) lastContent.current = content;

  return (
    <View style={[styles.hall, mini && styles.miniHall]}>
      {/* フロアを画面いっぱいに広げ、上の段の卓の上端をツールバーのガラスの下に少しもぐらせる（卓番は隠れない） */}
      {screen === 'layout'
        ? <LayoutEditor layout={layout} occupied={new Set(sessions.filter(s => isVisible(s, time, shopSettings)).flatMap(s => s.tableIds))}
          onSave={async next => {
            const missing = [...new Set(sessions.filter(s => isVisible(s, now(), shopSettings)).flatMap(s => s.tableIds))].filter(id => !next.seats.some(seat => seat.id === id));
            if (missing.length) throw new Error(`${missing.join('・')}番にお客さんがいます`);
            await shopLayoutStore.save(next, shopSettings);
          }} onClose={() => selectScreen('settings')} top={(mini ? TOOLBAR_HEIGHT.mini : TOOLBAR_HEIGHT.regular) + 20} portrait={portrait} mini={mini} />
        : screen === 'course' && editingCourse
        ? <CourseEditor key={editingCourse.course.id} course={editingCourse.course} isNew={editingCourse.isNew} settings={shopSettings}
          usedBy={coursesInUse(sessions, time, shopSettings).get(editingCourse.course.id) ?? []}
          onSave={course => { void shopSettingsStore.update({ courseMenus: putCourse(shopSettings.courseMenus, course) }); }}
          onDelete={() => { void shopSettingsStore.update({ courseMenus: shopSettings.courseMenus.filter(menu => menu.id !== editingCourse.course.id) }); }}
          onClose={() => selectScreen('settings')} top={(mini ? TOOLBAR_HEIGHT.mini : TOOLBAR_HEIGHT.regular) + 20} />
        : screen === 'settings' || screen === 'course'
        ? <Settings settings={shopSettings} onChange={change => { void shopSettingsStore.update(change); }} onOpenLayout={() => selectScreen('layout')}
          onEditCourse={id => {
            const course = id === null ? null : shopSettings.courseMenus.find(menu => menu.id === id);
            setEditingCourse(course ? { course, isNew: false } : { course: newCourse(shopSettings.courseMenus, Date.now()), isNew: true });
            selectScreen('course');
          }} top={(mini ? TOOLBAR_HEIGHT.mini : TOOLBAR_HEIGHT.regular) + 20} />
        : <View style={[styles.floorArea, { paddingTop: mini ? FLOOR_TOP.mini : portrait ? FLOOR_TOP.portrait : FLOOR_TOP.regular }]}>
          <Floor sessions={sessions} time={time} editingIds={editingIds} settings={shopSettings} layout={layout} portrait={portrait} mini={mini} picking={Boolean(pick)}
            onSeat={pick ? applyPick : requestSeat} onOpen={openPanel}
            toasts={<Toasts toasts={toasts} onDismiss={dismiss} rows={portrait || mini ? 1 : 2} mini={mini} />} />
        </View>}
      {/* メニュー：フロアの上に重ねる。外側のタップは後ろの透明な面で受けて閉じる */}
      {menuOpen && !pick && <>
        <Pressable accessibilityLabel="メニューを閉じる" style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
        <View style={[styles.listArea, { top: (mini ? TOOLBAR_HEIGHT.mini + 10 : TOOLBAR_HEIGHT.regular + 14) }, mini && styles.miniListArea]} pointerEvents="box-none">
          <SideMenu screen={screen} onSelect={selectScreen} mini={mini} />
        </View>
      </>}
      <View style={[styles.overlay, mini && styles.miniOverlay]} pointerEvents="box-none">
        {pick && picked
          ? <View style={styles.pickBar} accessibilityRole="alert">
            <Text style={[styles.pickText, mini && styles.miniPickText]} numberOfLines={1}>
              {pick.mode === 'move' ? `${pick.from}番の移動先の空席をタップしてください` : `${picked.tableIds.join('・')}番に追加する空席をタップしてください`}
            </Text>
            <PanelButton label="やめる" onPress={() => setPick(null)} style={styles.pickCancel} />
          </View>
          : <Header trial={trial} time={time} syncState={worstSyncState([sessionSync, shopTimerSync, shopSettingsSync])} shopTimers={shopTimers} onShopTimerOpen={setShopTimerOpen}
            canClearAll={sessions.some(s => isVisible(s, time, shopSettings))} onClearAll={() => setClearing(true)} mini={mini}
            menuOpen={menuOpen} onToggleMenu={() => setMenuOpen(open => !open)} timeLimitOff={timeLimitOff} onOpenSettings={() => selectScreen('settings')} />}
      </View>
      {popover && <Popover key={popoverAt ? `detail-${openId}` : 'alert'} anchor={clearing ? 'end' : 'start'} at={popoverAt} mini={mini} onClose={closeSheet}>{popover}</Popover>}
      {/* iOS 26 はシートそのものが Liquid Glass なので、中の背景を Web のパネルと同じ 84% の白にして、うっすらガラスを見せる */}
      <Modal visible={content !== null} animationType="slide" presentationStyle="formSheet" onRequestClose={closeSheet}>
        <ScrollView style={[styles.sheet, LIQUID_GLASS && styles.glassSheet]} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          {content ?? lastContent.current}
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  hall: { flex: 1, paddingHorizontal: 16, paddingBottom: 12 },
  miniHall: { paddingHorizontal: 8, paddingBottom: 8 },
  floorArea: { flex: 1 },
  // ツールバー・移動先を選ぶ帯を浮かべる層（hall の左右の余白に合わせる）
  overlay: { position: 'absolute', top: 4, left: 16, right: 16, height: TOOLBAR_HEIGHT.regular },
  miniOverlay: { left: 8, right: 8, height: TOOLBAR_HEIGHT.mini },
  listArea: { position: 'absolute', left: 16, right: 16 },
  miniListArea: { left: 8, right: 8 },
  pickBar: { height: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, paddingRight: 4, borderWidth: 1.5, borderColor: COLORS.action, borderRadius: 24, backgroundColor: COLORS.actionBg },
  pickText: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.actionText },
  miniPickText: { fontSize: 12 },
  pickCancel: { minHeight: 34, backgroundColor: COLORS.surface, borderColor: COLORS.line },
  sheet: { flex: 1, backgroundColor: COLORS.surface },
  glassSheet: { backgroundColor: 'rgba(254, 253, 252, 0.84)' },
  sheetContent: { padding: 24, gap: 16 },
});
