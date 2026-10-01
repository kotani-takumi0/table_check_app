import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { alertOf, displayOf, formatElapsed, nextStatus, STATUS_CARD, STATUS_LABEL, STATUS_SHORT, timerOf, type Session } from '@table-check/core/domain';
import type { Seat } from '@table-check/core/layout';
import { COLORS, fade, mix, stateColor, TABULAR } from './theme';
import { feedback } from './feedback';

const REASONS = { otoshi_missing: 'お通し未提供', last_order: 'L.O.の時間', seat_limit: 'お席の時間' };
interface Props {
  seat: Seat;
  session?: Session;
  time: number;
  frame: ViewStyle;   // フロア図の中の位置と大きさ
  onSeat(tableId: string): void;
  onNext(session: Session): void;
  onOpen(session: Session, from: string): void;
  onPay(session: Session): void;
  mini: boolean;      // スマホ：卓番・状態・タイマーだけ出し、タップで詳細パネル
  picking: boolean;   // 移動先・追加先を選んでいる間：空席だけ押せる
}
// Web の SeatCard と同じ出し分け。長押し（600ms）で詳細パネルを開く
export function SeatCard({ seat, session, time, frame, onSeat, onNext, onOpen, onPay, mini, picking }: Props) {
  if (!session) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={picking ? `${seat.id}番を選ぶ` : `${seat.id}番 ご案内`}
        onPress={() => { feedback.tap(); onSeat(seat.id); }}
        style={({ pressed }) => [frame, styles.card, styles.empty, picking && styles.pickTarget, pressed && styles.emptyPressed]}>
        <Text style={[styles.emptyNumber, mini && styles.miniEmptyNumber, picking && { color: COLORS.seated }]}>{seat.id}</Text>
      </Pressable>
    );
  }
  const alert = alertOf(session, time);
  const timer = timerOf(session, time);
  const next = nextStatus(session.status);
  // コースの「開始待ち」「ファーストドリンク提供済み」は通常と色・名前を変える
  const display = displayOf(session.status, session.course);
  const st = stateColor(display, alert.level);
  // コースの開始待ちはタイマーを進めない
  const timerText = timer.elapsedMs === null ? '--:--' : formatElapsed(timer.elapsedMs);
  const exited = session.status === 'exited';
  const paid = session.paidAt !== null;
  // 団体：同じセッションの他の卓番を添える
  const others = session.tableIds.filter(id => id !== seat.id);
  const groupMark = others.length === 0 ? '' : `+${others.length <= 2 ? others.join('+') : `${others.length}卓`}`;
  // 人数はテーブル卓だけ。団体はどの卓にも全員の人数を出す
  const guests = seat.kind === 'table' ? session.guests : undefined;
  const compact = seat.kind === 'table' && seat.rowSpan === 1;   // 上段の低いテーブル
  const narrow = seat.kind === 'table' && seat.colSpan === 1;    // 縦向きの細いテーブル
  const cardStyle = [frame, styles.card, { backgroundColor: mix(st, 12), borderColor: fade(st, 45) }, picking && styles.pickDisabled];
  const label = `${seat.id}番${others.length ? `（${session.tableIds.join('・')}番の団体）` : ''} ${STATUS_LABEL[display]} ${timer.label} ${timerText}${alert.reason ? ` ${REASONS[alert.reason]}` : ''}${paid ? ' お会計済み' : ''}`;
  const open = () => { feedback.open(); onOpen(session, seat.id); };
  const guestLabel = guests === undefined ? null : guests === null ? '?名' : `${guests}名`;
  const guestStyle = [styles.guests, guests === null && styles.unknown, mini && styles.miniGuests];
  // スマホの横長のカードは低いので、人数を卓番の横に並べる（細いカードだけ卓番の下の行）
  const guestsInline = mini && seat.colSpan > 1;
  const number = (
    <Text style={[styles.number, mini && styles.miniNumber]} numberOfLines={1}>
      {seat.id}{groupMark !== '' && <Text style={[styles.group, { color: st }]}> {groupMark}</Text>}
      {mini && paid && <Text style={styles.paidInline}> ¥✓</Text>}
      {guestsInline && guestLabel && <Text style={guestStyle}> {guestLabel}</Text>}
    </Text>
  );
  const guestText = guestLabel === null || guestsInline ? null : <Text style={guestStyle}>{guestLabel}</Text>;
  const timerView = <Text style={[styles.timer, mini && styles.miniTimer, seat.kind === 'counter' && !mini && styles.counterTimer, timer.elapsedMs === null && styles.stopped, TABULAR]} numberOfLines={1} adjustsFontSizeToFit>{timerText}</Text>;

  if (mini) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}（押すと詳細）`} disabled={picking} onPress={open}
        style={({ pressed }) => [...cardStyle, styles.mini, pressed && { borderColor: st, borderWidth: 2 }]}>
        {number}
        {guestText}
        <Text style={[styles.miniStatus, { color: st }]} numberOfLines={1} adjustsFontSizeToFit>{STATUS_SHORT[display]}</Text>
        {timerView}
      </Pressable>
    );
  }
  if (seat.kind === 'counter') {
    // カウンターはカード全体のタップで進める（退店済みならご案内）
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}${exited ? '（押すとご案内）' : ''}`} disabled={picking}
        onPress={() => { feedback.step(); if (exited) onSeat(seat.id); else onNext(session); }} onLongPress={open} delayLongPress={600}
        style={({ pressed }) => [...cardStyle, styles.counter, pressed && { borderColor: st, borderWidth: 3 }]}>
        {number}
        <Text style={[styles.counterStatus, { color: st }]} numberOfLines={1} adjustsFontSizeToFit>{STATUS_SHORT[display]}</Text>
        {timerView}
        {paid && <Text style={styles.paidMark}>¥✓</Text>}
      </Pressable>
    );
  }
  // テーブル：カードの中の「次の状態」ボタンで進め、右上で会計を切り替える
  const payLabel = compact || narrow ? (paid ? '¥✓' : '¥') : paid ? '会計済み' : '未払い';
  const nextButton = next
    ? <Pressable accessibilityRole="button" onPress={() => { feedback.step(); onNext(session); }} onLongPress={open} delayLongPress={600} disabled={picking}
      style={({ pressed }) => [styles.next, { borderColor: fade(st, 40), backgroundColor: mix(st, 8) }, compact && styles.compactNext, pressed && styles.nextPressed]}>
      <Text style={styles.nextLabel} numberOfLines={2} adjustsFontSizeToFit>{STATUS_CARD[displayOf(next, session.course)]}</Text>
    </Pressable>
    : exited && <Pressable accessibilityRole="button" accessibilityLabel={`${seat.id}番 ご案内`} onPress={() => { feedback.tap(); onSeat(seat.id); }} onLongPress={open} delayLongPress={600} disabled={picking}
      style={({ pressed }) => [styles.next, { borderColor: fade(st, 40), backgroundColor: mix(st, 8) }, compact && styles.compactNext, pressed && styles.nextPressed]}>
      <Text style={styles.nextLabel}>ご案内</Text>
    </Pressable>;
  const reason = alert.reason && <Text style={[styles.reason, { color: st }]} numberOfLines={1} adjustsFontSizeToFit>{REASONS[alert.reason]}</Text>;
  return (
    // カードの中のボタンも長押しで詳細を開く（指を離しても進めたり会計したりしない）。
    // VoiceOver では、カード全体を1つにまとめず、卓の情報（ダブルタップで詳細）・会計・次の状態を別々に読む
    <Pressable accessible={false} onLongPress={open} delayLongPress={600} disabled={picking}
      style={({ pressed }) => [...cardStyle, styles.table, compact && styles.compact, pressed && { borderColor: st, borderWidth: 3 }]}>
      {/* 上段の低いカード・縦向きの細いカードは、人数を卓番の下に重ねる（状態名と横に並ぶ幅が無い） */}
      <View accessible accessibilityRole="button" accessibilityLabel={label} accessibilityHint="ダブルタップで詳細" accessibilityState={{ disabled: picking }}
        accessibilityActions={[{ name: 'activate' }]} onAccessibilityAction={() => { if (!picking) open(); }}
        style={[styles.corner, (compact || narrow) && styles.cornerStacked]}>{number}{guestText}</View>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: paid }} disabled={picking}
        accessibilityLabel={paid ? 'お会計済み（押すと未払いに戻す）' : '未払い（押すとお会計済みにする）'}
        onPress={() => { feedback.tap(); onPay(session); }} onLongPress={open} delayLongPress={600} hitSlop={6}
        style={({ pressed }) => [styles.pay, (compact || narrow) && styles.payShort, paid && styles.paid, pressed && { opacity: 0.6 }]}>
        <Text style={[styles.payLabel, paid && styles.paidLabel]}>{payLabel}</Text>
      </Pressable>
      {compact ? <>
        <Text style={[styles.status, styles.compactStatus, { color: st }]} numberOfLines={1} adjustsFontSizeToFit>{STATUS_CARD[display]}</Text>
        <View style={styles.compactRow}>
          <View style={styles.compactLeft}>{timerView}{reason}</View>
          {nextButton}
        </View>
      </> : <>
        <Text style={[styles.status, narrow && styles.narrowStatus, { color: st }]} numberOfLines={1} adjustsFontSizeToFit>{narrow ? STATUS_SHORT[display] : STATUS_CARD[display]}</Text>
        {timerView}
        {reason}
        {nextButton}
      </>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', borderRadius: 8, borderWidth: 1.5, overflow: 'hidden' },
  empty: { borderColor: COLORS.line, backgroundColor: 'transparent', alignItems: 'flex-start', padding: 8 },
  emptyPressed: { backgroundColor: mix(COLORS.seated, 8, COLORS.bg), borderColor: COLORS.seated },
  emptyNumber: { fontSize: 20, fontWeight: '500', color: COLORS.muted },
  miniEmptyNumber: { fontSize: 14, alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto' },
  pickTarget: { borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.seated, backgroundColor: fade(COLORS.seated, 6) },
  pickDisabled: { opacity: 0.35 },
  number: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  miniNumber: { fontSize: 11, lineHeight: 13 },
  group: { fontSize: 12, fontWeight: '700' },
  guests: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  miniGuests: { fontSize: 10, lineHeight: 13 },
  unknown: { color: COLORS.muted, fontWeight: '400' },
  timer: { fontSize: 21, color: COLORS.text, textAlign: 'center' },
  counterTimer: { fontSize: 14 },
  miniTimer: { fontSize: 12, lineHeight: 13 },
  stopped: { color: COLORS.muted },
  status: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  narrowStatus: { fontSize: 18 },
  reason: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  table: { padding: 8, paddingTop: 40, justifyContent: 'center', gap: 3 },
  compact: { paddingHorizontal: 6, paddingTop: 4, paddingBottom: 4, gap: 2 },
  compactStatus: { fontSize: 18, paddingLeft: 34, paddingRight: 38 },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  compactLeft: { flex: 1, alignItems: 'center', paddingLeft: 30 },
  corner: { position: 'absolute', left: 8, top: 6, right: 80, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  cornerStacked: { left: 6, top: 5, right: undefined, flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
  pay: { position: 'absolute', top: 4, right: 4, minHeight: 32, paddingHorizontal: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.muted, borderRadius: 16, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  payShort: { minWidth: 32, paddingHorizontal: 6 },
  paid: { borderStyle: 'solid', borderColor: COLORS.text, backgroundColor: COLORS.text },
  payLabel: { fontSize: 13, color: COLORS.muted },
  paidLabel: { color: COLORS.surface, fontWeight: '700' },
  next: { minHeight: 50, paddingHorizontal: 4, borderWidth: 1, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  compactNext: { flex: 1, minHeight: 0, alignSelf: 'stretch' },
  nextPressed: { opacity: 0.6 },
  nextLabel: { fontSize: 14, color: COLORS.text, textAlign: 'center' },
  counter: { alignItems: 'center', justifyContent: 'center', paddingVertical: 3, gap: 2 },
  counterStatus: { fontSize: 15, fontWeight: '700', paddingHorizontal: 2 },
  paidMark: { position: 'absolute', top: 2, right: 3, fontSize: 11, fontWeight: '700', color: COLORS.text },
  mini: { alignItems: 'center', justifyContent: 'center', padding: 2, borderRadius: 6 },
  miniStatus: { fontSize: 12, lineHeight: 13, fontWeight: '700', paddingHorizontal: 1 },
  paidInline: { fontSize: 10, fontWeight: '700', color: COLORS.text },
});
