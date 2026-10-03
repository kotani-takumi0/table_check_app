import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type ViewStyle } from 'react-native';
import { alertOf, dishProgress, displayOf, sessionRules, STATUS_LABEL, STATUS_SHORT, type Session, REASON_LABEL } from '@table-check/core/domain';
import type { ShopSettings } from '@table-check/core/shopSettings';
import { bandOf, dialLabel, dialOf, remainingLabel, remainingOf } from '@table-check/core/dial';
import type { Seat } from '@table-check/core/layout';
import { cardTone, COLORS, TABULAR } from './theme';
import { Dial } from './Dial';
import { feedback } from './feedback';

interface Props {
  seat: Seat;
  session?: Session;
  time: number;
  frame: ViewStyle & { width: number; height: number };   // フロア図の中の位置と大きさ
  onSeat(tableId: string, at?: { x: number; y: number }): void;   // at：押した場所（ご案内をそのそばに出す。No.85）
  onOpen(session: Session, from: string, at?: { x: number; y: number }): void;   // at：押した場所（詳細をそのそばに出す）
  editing?: boolean;   // ほかの端末でこの卓の詳細を開いている（No.72）
  settings: ShopSettings;   // 店の設定（時間のルール・飲み放題の区分・コース。No.14・No.89・No.90）
  mini: boolean;      // スマホ：卓番・段階・時:分だけ出し、タップで詳細パネル
  picking: boolean;   // 移動先・追加先を選んでいる間：空席だけ押せる
}
// 押した場所（画面の中の位置）。詳細・ご案内をそのそばに出す
const pointOf = (event: GestureResponderEvent) => ({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
// Web の SeatCard と同じ出し分け。テーブルは文字盤と四隅、カウンターは円の文字盤。
// テーブルはタップで詳細パネル（退店済はご案内）、カウンターはタップで次の状態へ。どちらも長押し（600ms）で詳細パネル
export function SeatCard({ seat, session, time, editing = false, settings, frame, onSeat, onOpen, mini, picking }: Props) {
  const { width, height } = frame;
  if (!session) {
    // 空席：点線の枠（テーブルは角丸の四角、カウンターは円）
    const circle = seat.kind === 'counter' && !mini;
    const d = Math.min(width, height);
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={picking ? `${seat.id}番を選ぶ` : `${seat.id}番 ご案内`}
        onPress={event => { feedback.tap(); onSeat(seat.id, pointOf(event)); }}
        style={[frame, styles.emptyBox]}>
        {({ pressed }) => (
          <View style={[circle ? { width: d, height: d, borderRadius: d / 2 } : [styles.fill, styles.emptyRect, mini && styles.miniRadius], styles.empty,
            picking && styles.pickTarget, pressed && styles.emptyPressed]}>
            <Text style={[styles.emptyNumber, mini && styles.miniEmptyNumber, picking && { color: COLORS.actionText }]}>{seat.id}</Text>
          </View>
        )}
      </Pressable>
    );
  }
  // その卓に使う時間のルール（コースごとの L.O.・お席の時間。No.89）
  const rules = sessionRules(settings, session, settings.courseMenus);
  const alert = alertOf(session, time, rules);
  const dial = dialOf(session, time, rules);
  const remaining = remainingOf(session, time, rules);
  // コースの「開始待ち」「ファーストドリンク提供済み」は通常と名前を変える（色は変えない）
  const display = displayOf(session.status, session.course, rules);
  const tone = cardTone(alert.level);
  const exited = session.status === 'exited';
  const paid = session.paidAt !== null;
  // 団体：同じセッションの他の卓番を添える
  const others = session.tableIds.filter(id => id !== seat.id);
  const groupMark = others.length === 0 ? '' : `+${others.length <= 2 ? others.join('+') : `${others.length}卓`}`;
  // 人数・コースの料理の進みはテーブル卓だけ。団体はどの卓にも全員の人数を出す
  const guests = seat.kind === 'table' ? session.guests : undefined;
  const progress = seat.kind === 'table' ? dishProgress(session, settings.courseMenus) : null;
  // 右下：L.O.まで・退席まで。退店済は「押すとご案内」、コースの開始待ちはタイマー停止中
  const corner = remaining ? remainingLabel(remaining)
    : exited ? '押すとご案内' : 'タイマー停止中';
  const meter = dialLabel(dial, remaining);
  const label = `${editing ? 'ほかの端末で編集中 ' : ''}${seat.id}番${others.length ? `（${session.tableIds.join('・')}番の団体）` : ''}${guests === undefined ? '' : guests === null ? ' 人数未入力' : ` ${guests}名`} ${STATUS_LABEL[display]} ${meter}${alert.reason ? ` ${REASON_LABEL[alert.reason]}` : ''}${paid ? ' お会計済み' : ''}`;
  const open = (event?: GestureResponderEvent) => { feedback.open(); onOpen(session, seat.id, event ? pointOf(event) : undefined); };
  const number = (size: number) => (
    <Text style={[styles.number, { fontSize: size }]} numberOfLines={1}>
      {seat.id}{groupMark !== '' && <Text style={[styles.group, { color: tone.text }]}> {groupMark}</Text>}
    </Text>
  );
  const guestText = guests === undefined ? null
    : <Text style={[styles.guests, guests === null && styles.unknown]}><Text style={[styles.guestNum, guests === null && styles.unknownNum, TABULAR]}>{guests ?? '?'}</Text>名</Text>;
  // 右上：人数・コース（料理の進み）・会計済。低い卓・細い卓は1行に収まるよう「3/8」「¥✓」と短くする
  const isFull = seat.kind === 'table' && seat.rowSpan > 1 && seat.colSpan > 1;
  const courseText = session.course === null ? null
    : <Text style={[styles.meta, TABULAR]}>{isFull || !progress ? 'コース' : ''}{progress ? `${isFull ? ' ' : ''}${progress.served}/${progress.total}` : ''}</Text>;
  const paidText = paid ? <Text style={styles.paidMeta}>{isFull ? '会計済' : '¥✓'}</Text> : null;
  // 段階：警告のときは理由の札（塗り）、ふだんは段階名
  const stage = alert.reason
    ? <View style={[styles.badge, { backgroundColor: alert.level === 'soon' ? COLORS.soon : COLORS.now }]}>
      <Text style={[styles.badgeLabel, { color: alert.level === 'soon' ? COLORS.onSoon : COLORS.onNow }]} numberOfLines={1}>{REASON_LABEL[alert.reason]}</Text>
    </View>
    : <Text style={[styles.status, { color: tone.text }]} numberOfLines={1}>{STATUS_SHORT[display]}</Text>;
  const dialView = (size: number, textScale?: number) => <Dial dial={dial} label={meter} size={Math.max(0, size)} face={seat.kind === 'counter' && alert.level === 'none' ? COLORS.surface : tone.face} arc={tone.arc} band={seat.kind !== 'counter' && !rules.timeLimitOff ? bandOf(session, rules) : null} textScale={textScale} />;
  const faded = exited && styles.exited;
  // 編集中の印（No.72）：ほかの端末で詳細を開いている卓。上の辺の真ん中に小さな札と、点線の枠を重ねる
  const editingTag = editing ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.editingFrame, seat.kind === 'counter' && !mini && styles.editingCounter]}>
    <View style={[styles.editingTag, seat.kind === 'counter' && !mini && styles.editingCounterTag]}><Text style={styles.editingLabel}>編集中</Text></View>
  </View> : null;

  if (mini) {
    // スマホ（Web と同じ）：上に卓番（人数）、真ん中に文字盤（中に時:分）、下に段階。警告は淡い地の色と文字盤の色。
    // カウンターのような低いマスは段階を省き、卓番を左上の角に重ねて文字盤をマスいっぱいにする
    const low = height <= MINI_LOW;
    const narrowGuests = guests !== undefined && seat.colSpan === 1;
    const numberText = (
      <Text style={[styles.number, styles.miniNumber, low && styles.miniCornerNumber]} numberOfLines={1}>
        {seat.id}{groupMark !== '' && <Text style={[styles.group, { color: tone.text }]}> {groupMark}</Text>}
        {paid && <Text style={styles.paidInline}> ¥✓</Text>}
        {guests !== undefined && seat.colSpan > 1 && <Text style={styles.miniGuests}> {guests ?? '?'}名</Text>}
      </Text>
    );
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}（押すと詳細）`} disabled={picking} onPress={open}
        style={({ pressed }) => [frame, styles.card, styles.mini, { backgroundColor: tone.bg }, faded, picking && styles.pickDisabled, pressed && styles.pressed]}>
        {low ? <>
          {dialView(Math.min(width, height) - 4, 0.34)}
          {numberText}
        </> : <>
          {numberText}
          {narrowGuests && <Text style={styles.miniGuests}>{guests ?? '?'}名</Text>}
          {dialView(Math.min(width - 4, height - (narrowGuests ? 44 : 32)), 0.27)}
          <Text style={[styles.miniStatus, { color: tone.text }]} numberOfLines={1} adjustsFontSizeToFit>{alert.reason ? REASON_LABEL[alert.reason] : STATUS_SHORT[display]}</Text>
        </>}
        {editingTag}
      </Pressable>
    );
  }
  if (seat.kind === 'counter') {
    // カウンター：卓番は円の上、時間は円の中、段階は円の下（横長のマスは卓番を円の左に置く）。テーブルと同じくタップで詳細（退店済はご案内。No.70）
    const wide = width > height * 1.3;
    const size = wide ? Math.min(width * 0.7, height - 18) : Math.min(width, height - 34);
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}（${exited ? '押すとご案内、長押しで詳細' : '押すと詳細'}）`} disabled={picking}
        onPress={event => { if (exited) { feedback.step(); onSeat(seat.id, pointOf(event)); } else open(event); }} onLongPress={open} delayLongPress={600}
        style={({ pressed }) => [frame, styles.counter, faded, picking && styles.pickDisabled, pressed && styles.pressed]}>
        {wide ? <View style={styles.counterRow}>{number(14)}{dialView(size)}</View> : <>{number(14)}{dialView(size)}</>}
        {paid && <Text style={styles.paidMark}>¥✓</Text>}
        <Text style={[styles.counterStatus, { color: tone.text }]} numberOfLines={1}>{alert.reason ? REASON_LABEL[alert.reason] : STATUS_SHORT[display]}</Text>
        {editingTag}
      </Pressable>
    );
  }
  const full = isFull;
  const narrow = seat.colSpan === 1;
  const card = ({ pressed }: { pressed: boolean }) => [frame, styles.card, { backgroundColor: tone.bg }, faded, picking && styles.pickDisabled, pressed && styles.pressed];
  const press = (event: GestureResponderEvent) => { if (exited) { feedback.tap(); onSeat(seat.id, pointOf(event)); } else open(event); };
  const a11y = `${label}（${exited ? '押すとご案内、長押しで詳細' : '押すと詳細'}）`;
  if (full) {
    // 大きい卓：四隅（左上 卓番／右上 人数・コース・会計済／左下 段階か札／右下 残り時間）と真ん中の文字盤
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={a11y} disabled={picking} onPress={press} onLongPress={open} delayLongPress={600} style={card}>
        <View style={styles.fullTop}>
          {number(20)}
          <View style={styles.metaColumn}>{guestText}{courseText}{paidText}</View>
        </View>
        <View style={styles.fullDial}>{dialView(Math.min(width - 24, height - 84))}</View>
        <View style={styles.fullBottom}>
          <View style={styles.shrink}>{stage}</View>
          <Text style={styles.remaining} numberOfLines={1}>{corner}</Text>
        </View>
        {editingTag}
      </Pressable>
    );
  }
  // 低い卓：左に卓番・段階・残り時間、右に小さめの文字盤。細い卓（縦向き）は上下に並べる
  const info = (
    <View style={[styles.info, narrow && styles.narrowInfo]}>
      <View style={[styles.infoHead, narrow && styles.infoHeadWrap]}>{number(narrow ? 17 : 18)}{guestText}{courseText}{paidText}</View>
      {stage}
      <Text style={styles.remaining} numberOfLines={1}>{corner}</Text>
    </View>
  );
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} disabled={picking} onPress={press} onLongPress={open} delayLongPress={600}
      style={state => [...card(state), narrow ? styles.narrow : styles.low]}>
      {info}
      {dialView(narrow ? Math.min(width - 12, height - 110) : Math.min(height - 12, width / 2))}
      {editingTag}
    </Pressable>
  );
}

// スマホでこの高さ以下のマス（カウンターなど）は、段階を省いて文字盤をマスいっぱいにする（Web の @container と同じ）
const MINI_LOW = 72;
const styles = StyleSheet.create({
  editingFrame: { borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.action, borderRadius: 12, alignItems: 'center' },
  // カウンターは卓番が円の上にあるので、札は下（段階の文字の場所）に出す
  editingCounter: { borderRadius: 999, justifyContent: 'flex-end' },
  editingCounterTag: { marginTop: 0, marginBottom: 0 },
  editingTag: { marginTop: 2, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999, backgroundColor: COLORS.action },
  editingLabel: { fontSize: 11, fontWeight: '700', color: COLORS.onAction },
  fill: { flex: 1, alignSelf: 'stretch' },
  card: { position: 'absolute', borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent', overflow: 'hidden' },
  exited: { opacity: 0.5 },
  pressed: { borderColor: COLORS.action, borderWidth: 3 },
  pickDisabled: { opacity: 0.35 },
  emptyBox: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  emptyRect: { borderRadius: 12 },
  miniRadius: { borderRadius: 6 },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.lineStrong, alignItems: 'center', justifyContent: 'center' },
  emptyPressed: { backgroundColor: COLORS.actionBg, borderColor: COLORS.action },
  pickTarget: { borderWidth: 2, borderColor: COLORS.action, backgroundColor: COLORS.actionBg },
  emptyNumber: { fontSize: 20, fontWeight: '500', color: COLORS.muted },
  miniEmptyNumber: { fontSize: 14 },
  number: { fontWeight: '700', color: COLORS.text },
  group: { fontSize: 12, fontWeight: '700' },
  guests: { fontSize: 13, fontWeight: '500', color: COLORS.muted },
  guestNum: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  unknown: { color: COLORS.muted },
  unknownNum: { fontWeight: '500', color: COLORS.muted },
  meta: { fontSize: 13, color: COLORS.muted },
  paidMeta: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  status: { fontSize: 16, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeLabel: { fontSize: 13, fontWeight: '700' },
  remaining: { fontSize: 13, color: COLORS.muted },
  shrink: { flexShrink: 1, minWidth: 0 },
  fullTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 12, paddingTop: 8 },
  metaColumn: { alignItems: 'flex-end' },
  fullDial: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fullBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6, paddingHorizontal: 12, paddingBottom: 10 },
  low: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 6 },
  narrow: { alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 8 },
  info: { flex: 1, minWidth: 0, gap: 4, alignItems: 'flex-start' },
  narrowInfo: { flex: 0, alignSelf: 'stretch' },
  infoHead: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'baseline', columnGap: 8, overflow: 'hidden', maxWidth: '100%' },
  infoHeadWrap: { flexWrap: 'wrap' },
  counter: { position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 1 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  counterStatus: { fontSize: 12, fontWeight: '700', paddingHorizontal: 2 },
  paidMark: { position: 'absolute', top: 0, right: 2, fontSize: 10, fontWeight: '700', color: COLORS.text },
  mini: { alignItems: 'center', justifyContent: 'center', padding: 2, borderRadius: 6 },
  miniNumber: { fontSize: 11, lineHeight: 13 },
  miniGuests: { fontSize: 10, lineHeight: 13, color: COLORS.text },
  miniStatus: { fontSize: 12, lineHeight: 13, fontWeight: '700', paddingHorizontal: 1 },
  miniCornerNumber: { position: 'absolute', top: 1, left: 3, fontSize: 10 },
  paidInline: { fontSize: 10, fontWeight: '700', color: COLORS.text },
});
