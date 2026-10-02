import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { randomUUID } from 'expo-crypto';
import { useKeepAwake } from 'expo-keep-awake';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { now } from '@table-check/core/clock';
import { isVisible, occupantOf, unpaidTableCount, type Session } from '@table-check/core/domain';
import { NOTICE_ACTION, noticesOf } from '@table-check/core/notices';
import { SHOP_TIMERS, type ShopTimerDone, type ShopTimerId } from '@table-check/core/shopTimers';
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
import { TableList } from './TableList';
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
function Hall({ services: { store, shopTimerStore, editingStore, trial } }: { services: Services }) {
  // 営業中に画面が暗くならないようにする
  useKeepAwake();
  const { sessions, seat, next, back, retime, pay, changeGuests, changeCourse, changeMenu, serve, unserve, moveTo, addTo, release, clearAll } = useSessions(store, randomUUID);
  const [time, setTime] = useState(now);
  useEffect(() => {
    const interval = setInterval(() => setTime(now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const [sessionSync, setSessionSync] = useState<SyncState>('synced');
  const [shopTimerSync, setShopTimerSync] = useState<SyncState>('synced');
  useEffect(() => store.subscribeSync?.(setSessionSync), [store]);
  useEffect(() => shopTimerStore.subscribeSync?.(setShopTimerSync), [shopTimerStore]);
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
  // 全卓一覧（左から出す）。最初はしまっておく
  const [listOpen, setListOpen] = useState(false);

  const openPanel = useCallback((session: Session, from: string) => { setOpenId(session.id); setOpenFrom(from); }, []);
  // 詳細パネルから案内したときは、同じシートの中で案内の確認に切り替える
  const requestSeat = useCallback((tableId: string) => { setOpenId(null); setSeating(tableId); }, []);
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
      feedback.done();
      if (pick.mode === 'move') moveTo(picked, pick.from, tableId);
      else addTo(picked, tableId);
    }
    setPick(null);
  };
  // 選んでいる間にその客が退店・取り消しされたら、選ぶのをやめる
  useEffect(() => { if (pick && !picked) setPick(null); }, [pick, picked]);

  // 「閉じる」はこの端末だけ
  const toasts: Toast[] = noticesOf(sessions, shopTimers, time).filter(notice => !isDismissed(notice.key)).map(notice => ({
    key: notice.key, tone: notice.tone, message: notice.message,
    action: { label: NOTICE_ACTION[notice.kind], onPress: () => { feedback.step(); if (notice.kind === 'last_order') next(notice.session); else markShopTimerDone(notice.timerId); } },
  }));
  const openedShopTimer = SHOP_TIMERS.find(timer => timer.id === shopTimerOpen);
  const closeSheet = useCallback(() => { setSeating(null); setOpenId(null); setShopTimerOpen(null); setClearing(false); }, []);
  let content: ReactNode = null;
  if (seating !== null && !seatingTaken) {
    content = <SeatSheet key={`seat-${seating}`} tableId={seating} exited={seatingOccupant?.status === 'exited'} previousUnpaid={seatingOccupant?.paidAt === null}
      onSeat={(guests, course, menu) => seat(seating, guests, course, menu)} onClose={closeSheet} />;
  } else if (opened) {
    content = <DetailSheet key={`detail-${opened.id}`} session={opened} time={time} othersEditing={editingIds.has(opened.id)} onClose={closeSheet} onNext={next} onSeat={requestSeat} onBack={back} onRetime={retime}
      onPay={pay} onGuests={changeGuests} onCourse={changeCourse} onMenu={changeMenu} onServe={serve} onUnserve={unserve} from={moveFrom} onPick={startPick} onRelease={release} />;
  }
  // トイレ・全卓消去は iOS 26 のアラートのように、押したボタンのそばからポップオーバーで出す
  let popover: ReactNode = null;
  if (content === null && openedShopTimer) {
    popover = <ShopTimerSheet label={openedShopTimer.label} icon={openedShopTimer.icon} doneAt={shopTimers[openedShopTimer.id]} onReset={() => markShopTimerDone(openedShopTimer.id)} onClose={closeSheet} />;
  } else if (content === null && clearing) {
    popover = <ClearAllSheet unpaidTables={unpaidTableCount(sessions, time)} onConfirm={clearAll} onClose={closeSheet} />;
  }
  // シートが下がっていく間も、閉じる前の中身を出しておく
  const lastContent = useRef<ReactNode>(null);
  if (content) lastContent.current = content;

  const { portrait, mini } = useScreen();
  return (
    <View style={[styles.hall, mini && styles.miniHall]}>
      {/* フロアを画面いっぱいに広げ、上の段の卓の上端をツールバーのガラスの下に少しもぐらせる（卓番は隠れない） */}
      <View style={[styles.floorArea, { paddingTop: mini ? FLOOR_TOP.mini : portrait ? FLOOR_TOP.portrait : FLOOR_TOP.regular }]}>
        <Floor sessions={sessions} time={time} editingIds={editingIds} portrait={portrait} mini={mini} picking={Boolean(pick)}
          onSeat={pick ? applyPick : requestSeat} onNext={next} onOpen={openPanel}
          toasts={<Toasts toasts={toasts} onDismiss={dismiss} rows={portrait || mini ? 1 : 2} mini={mini} />} />
      </View>
      {/* 全卓一覧：フロアの上に重ねる。外側のタップは後ろの透明な面で受けて閉じる */}
      {listOpen && !pick && <>
        <Pressable accessibilityLabel="全卓一覧を閉じる" style={StyleSheet.absoluteFill} onPress={() => setListOpen(false)} />
        <View style={[styles.listArea, { top: (mini ? TOOLBAR_HEIGHT.mini + 10 : TOOLBAR_HEIGHT.regular + 14) }, mini && styles.miniListArea]} pointerEvents="box-none">
          <TableList sessions={sessions} time={time} onOpen={openPanel} mini={mini} />
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
          : <Header trial={trial} time={time} syncState={worstSyncState([sessionSync, shopTimerSync])} shopTimers={shopTimers} onShopTimerOpen={setShopTimerOpen}
            canClearAll={sessions.some(s => isVisible(s, time))} onClearAll={() => setClearing(true)} mini={mini}
            listOpen={listOpen} onToggleList={() => setListOpen(open => !open)} />}
      </View>
      {popover && <Popover anchor={clearing ? 'end' : 'start'} mini={mini} onClose={closeSheet}>{popover}</Popover>}
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
  listArea: { position: 'absolute', left: 16, right: 16, bottom: 12 },
  miniListArea: { left: 8, right: 8, bottom: 8 },
  pickBar: { height: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, paddingRight: 4, borderWidth: 1.5, borderColor: COLORS.action, borderRadius: 24, backgroundColor: COLORS.actionBg },
  pickText: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.actionText },
  miniPickText: { fontSize: 12 },
  pickCancel: { minHeight: 34, backgroundColor: COLORS.surface, borderColor: COLORS.line },
  sheet: { flex: 1, backgroundColor: COLORS.surface },
  glassSheet: { backgroundColor: 'rgba(254, 253, 252, 0.84)' },
  sheetContent: { padding: 24, gap: 16 },
});
