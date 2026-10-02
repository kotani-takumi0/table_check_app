import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { alertOf, clockTimeNear, dishProgress, displayOf, formatClock, formatElapsed, nextStatus, STATUS_LABEL, timerOf, type Course, type EditableTime, type Session, REASON_LABEL } from '@table-check/core/domain';
import { COLORS, TABULAR } from '../theme';
import { feedback } from '../feedback';
import { CloseButton, PanelButton } from '../ui';
import { menuOf } from '@table-check/core/courseMenus';
import { SelectField } from './SelectField';
import { COURSE_OPTIONS, guestOptions, MENU_OPTIONS } from './pickers';
import { remainingLabel, remainingOf } from '@table-check/core/dial';
import { sheet } from './common';

interface Props {
  session: Session;
  time: number;
  othersEditing?: boolean;   // ほかの端末でもこの卓の詳細を開いている（No.72）
  onClose(): void;
  onNext(session: Session): void;
  onSeat(tableId: string): void;  // 退店済の卓に次のお客さんを案内する
  onBack(session: Session): void;
  onRetime(session: Session, field: EditableTime, at: number): boolean;
  onPay(session: Session): void;
  onGuests(session: Session, guests: number | null): void;
  onCourse(session: Session, course: Course | null): void;
  onMenu(session: Session, menu: string | null): void;
  onServe(session: Session): void;     // コースの次の料理を出した
  onUnserve(session: Session): void;   // 1品戻す
  from: string;                   // パネルを開いた卓（移動するのはこの卓）
  onPick(mode: 'move' | 'add'): void;
  onRelease(session: Session, tableId: string): void;
}
// 時刻の行：iOS の時刻ピッカーで選び、「修正」で保存する（順番を崩す時刻は保存しない）
function TimeRow({ label, value, order, onSave }: { label: string; value: number | null; order: string; onSave(hhmm: string): boolean }) {
  const [draft, setDraft] = useState(value === null ? null : new Date(value));
  const [error, setError] = useState(false);
  if (value === null || draft === null) return <View style={sheet.row}><Text style={sheet.rowLabel}>{label}</Text><Text style={[sheet.text, sheet.muted]}>未提供</Text></View>;
  const hhmm = formatClock(draft.getTime());
  const changed = hhmm !== formatClock(value);
  return (
    <View style={styles.timeRow}>
      <View style={sheet.row}>
        <Text style={sheet.rowLabel}>{label}</Text>
        <DateTimePicker value={draft} mode="time" display="compact" locale="ja-JP" themeVariant="light" accentColor={COLORS.action}
          onValueChange={(_event, date) => { setDraft(date); setError(false); }} />
        <PanelButton label="修正" disabled={!changed} onPress={() => { const ok = onSave(hhmm); setError(!ok); if (ok) feedback.done(); else feedback.warn(); }} style={styles.fix} />
      </View>
      {error && <Text style={styles.error} accessibilityRole="alert">{order} の順になる時刻にしてください</Text>}
    </View>
  );
}
// Web の DetailPanel と同じ中身
export function DetailSheet({ session, time, othersEditing = false, onClose, onNext, onSeat, onBack, onRetime, onPay, onGuests, onCourse, onMenu, onServe, onUnserve, from, onPick, onRelease }: Props) {
  const [changing, setChanging] = useState(false);
  const [showDishes, setShowDishes] = useState(false);
  const timer = timerOf(session, time);
  const next = nextStatus(session.status);
  const display = displayOf(session.status, session.course);
  // コースはお通しを出さず、同じ欄にファーストドリンクの時刻を入れる
  const otoshiLabel = session.course === null ? 'お通し' : 'ドリンク';
  const order = `案内 → ${session.course === null ? 'お通し' : 'ファーストドリンク'} → L.O.確認・現在`;
  const progress = dishProgress(session);
  const dishes = menuOf(session.menu)?.dishes ?? [];
  const save = (field: EditableTime, near: number) => (hhmm: string) => {
    const at = clockTimeNear(hhmm, near);
    return at !== null && onRetime(session, field, at);
  };
  const alert = alertOf(session, time);
  const remaining = remainingOf(session, time);
  const paid = session.paidAt !== null;
  return <>
    {/* No.71：いちばん見てほしいのは「次にやること」1つ。大きいボタンはそれだけにし、戻す・お会計は小さく、ほかは「変更する」にしまう */}
    <View style={styles.head}>
      <Text style={sheet.title} accessibilityRole="header">
        <Text style={styles.seat}>{session.tableIds.join('・')}番  </Text>{STATUS_LABEL[display]}
      </Text>
      <Text style={[styles.timer, TABULAR]}>{timer.label} {timer.elapsedMs === null ? '--:--' : formatElapsed(timer.elapsedMs)}{remaining ? `  ・ ${remainingLabel(remaining)}` : ''}</Text>
      {othersEditing && <Text style={styles.editing} accessibilityRole="alert">ほかの端末でもこの卓を開いています。操作がぶつからないよう声をかけてください</Text>}
      {alert.reason && <View style={[styles.badge, { backgroundColor: alert.level === 'soon' ? COLORS.soon : COLORS.now }]}>
        <Text style={[styles.badgeLabel, { color: alert.level === 'soon' ? COLORS.onSoon : COLORS.onNow }]}>{REASON_LABEL[alert.reason]}</Text>
      </View>}
    </View>
    {next
      ? <PanelButton label={STATUS_LABEL[displayOf(next, session.course)]} tone="primary" onPress={() => { feedback.step(); onNext(session); }} style={styles.next} />
      : session.status === 'exited' && <PanelButton label={session.tableIds.length > 1 ? `${from}番にご案内` : 'ご案内'} tone="primary" onPress={() => { feedback.tap(); onSeat(from); }} style={styles.next} />}
    <View style={styles.quick}>
      <Pressable accessibilityRole="button" onPress={() => { feedback.step(); onBack(session); }} style={({ pressed }) => [styles.textButton, pressed && { opacity: 0.6 }]}>
        <Text style={styles.textButtonLabel}>{session.status === 'seated' ? '案内を取り消す' : '1つ戻す'}</Text>
      </Pressable>
      {/* お会計：今の状態を左に、押すと切り替える */}
      <Text style={[sheet.text, styles.payState, !paid && sheet.muted]}>{paid ? `会計済（${formatClock(session.paidAt ?? 0)}）` : '未払い'}</Text>
      <PanelButton label={paid ? '未払いに戻す' : 'お会計済みにする'} onPress={() => { feedback.tap(); onPay(session); }} style={styles.small} />
    </View>
    {session.course !== null && <View style={styles.section}>
      <Text style={styles.heading} accessibilityRole="header">料理{progress ? `  ${progress.served}/${progress.total}品` : ''}</Text>
      {progress ? <>
        {/* 料理はメニューの順に1品ずつ進める。進みのバーと次に出す料理 */}
        <View style={styles.bar} accessibilityRole="progressbar" accessibilityLabel="料理の進み"
          accessibilityValue={{ min: 0, max: progress.total, now: progress.served, text: `${progress.total}品中${progress.served}品提供済み` }}>
          <View style={[styles.barFill, { width: `${progress.total === 0 ? 0 : progress.served / progress.total * 100}%` }]} />
        </View>
        <Text style={sheet.text}>{progress.next === null ? '全部出しました' : <>次：<Text style={styles.nextDishName}>{progress.next}</Text></>}</Text>
        <View style={sheet.actions}>
          <PanelButton label="1品戻す" disabled={progress.served === 0} onPress={() => { feedback.step(); onUnserve(session); }} style={sheet.action} />
          <PanelButton label={progress.next === null ? '全部出しました' : `${progress.served + 1}品目を出した`} tone="primary" disabled={progress.next === null}
            onPress={() => { feedback.step(); onServe(session); }} style={sheet.action} />
        </View>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showDishes }} onPress={() => setShowDishes(!showDishes)} style={styles.toggle}>
          <Text style={styles.toggleLabel}>{showDishes ? '▾' : '▸'} 料理をすべて見る</Text>
        </Pressable>
        {showDishes && <View accessibilityLabel={`料理 ${progress.total}品中${progress.served}品提供済み`}>
          {dishes.map((dish, i) => {
            const served = i < progress.served;
            const isNext = i === progress.served;
            return (
              <View key={i} style={[styles.dish, isNext && styles.nextDish]}>
                <Text style={[styles.dishMark, served && sheet.muted, TABULAR]}>{served ? '✓' : i + 1}</Text>
                <Text style={[styles.dishName, served && sheet.muted, isNext && styles.nextDishName]}>{dish}</Text>
              </View>
            );
          })}
        </View>}
      </> : <>
        {/* どのコースかが未定なら、ここで選ぶと料理の進みを付けられる */}
        <SelectField label="料理" value={session.menu} options={MENU_OPTIONS} onChange={menu => onMenu(session, menu)} />
      </>}
    </View>}
    {/* 変更する：人数・コース・時刻の修正・卓の移動と団体。ふだんは閉じておく */}
    <View style={styles.section}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: changing }} onPress={() => setChanging(!changing)} style={styles.toggle}>
        <Text style={styles.changeLabel}>{changing ? '▾' : '▸'} 変更する（人数・コース・時刻・卓）</Text>
      </Pressable>
      {changing && <View style={styles.changeBody}>
        <SelectField label="人数" value={session.guests} options={guestOptions('未入力', session.guests)} onChange={guests => onGuests(session, guests)} />
        <SelectField label="コース" value={session.course} options={COURSE_OPTIONS} onChange={course => onCourse(session, course)} />
        {session.course !== null && progress && <SelectField label="料理" value={session.menu} options={MENU_OPTIONS} onChange={menu => onMenu(session, menu)} />}
        <TimeRow key={`seated-${session.seatedAt}`} label="案内" value={session.seatedAt} order={order} onSave={save('seatedAt', session.seatedAt)} />
        <TimeRow key={`otoshi-${session.otoshiAt}`} label={otoshiLabel} value={session.otoshiAt} order={order} onSave={save('otoshiAt', session.otoshiAt ?? session.seatedAt)} />
        <View style={sheet.row}>
          <Text style={sheet.rowLabel}>卓</Text>
          <View style={styles.chips}>
            {session.tableIds.map(id => (
              <View key={id} style={[styles.chip, session.tableIds.length === 1 && styles.chipAlone]}>
                <Text style={styles.chipLabel}>{id}番</Text>
                {session.tableIds.length > 1 && (
                  <Pressable accessibilityRole="button" accessibilityLabel={`${id}番を団体から外す`} hitSlop={6}
                    onPress={() => { feedback.step(); onRelease(session, id); }} style={({ pressed }) => [styles.remove, pressed && { opacity: 0.5 }]}>
                    <Text style={styles.removeLabel}>×</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </View>
        <View style={sheet.actions}>
          <PanelButton label={`${from}番を移動`} onPress={() => { feedback.tap(); onPick('move'); }} style={sheet.action} />
          <PanelButton label="卓を追加（団体）" onPress={() => { feedback.tap(); onPick('add'); }} style={sheet.action} />
        </View>
      </View>}
    </View>
    <CloseButton onPress={onClose} />
  </>;
}
const styles = StyleSheet.create({
  next: { minHeight: 60 },
  // 文字を大きくしていても、入らなければ次の行に折り返す
  quick: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  textButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 4 },
  textButtonLabel: { fontSize: 14, fontWeight: '700', color: COLORS.actionText, textDecorationLine: 'underline' },
  payState: { marginLeft: 'auto', fontSize: 14 },
  small: { minHeight: 40, paddingHorizontal: 14 },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 12, rowGap: 6, paddingRight: 48 },
  badge: { alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeLabel: { fontSize: 13, fontWeight: '700' },
  // 区切り：お会計・料理の見出し、変更する（折りたたみ）
  section: { gap: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line },
  heading: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: COLORS.dialFace },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.action },
  toggle: { minHeight: 44, justifyContent: 'center' },
  toggleLabel: { fontSize: 13, color: COLORS.actionText },
  changeLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  changeBody: { gap: 14 },
  seat: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  timer: { marginLeft: 'auto', fontSize: 16, color: COLORS.muted },
  timeRow: { gap: 6 },
  fix: { marginLeft: 'auto', minWidth: 72 },
  error: { fontSize: 14, color: COLORS.nowText },
  editing: { alignSelf: 'stretch', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, overflow: 'hidden', backgroundColor: COLORS.actionBg, color: COLORS.actionText, fontSize: 14, fontWeight: '700' },
  grow: { flex: 1 },
  dishes: { gap: 8 },
  dish: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 2, borderColor: 'transparent' },
  nextDish: { borderColor: COLORS.action },
  dishMark: { minWidth: 20, fontSize: 14, color: COLORS.text, textAlign: 'center' },
  dishName: { flex: 1, fontSize: 14, lineHeight: 19, color: COLORS.text },
  nextDishName: { fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 36, paddingLeft: 12, paddingRight: 4, borderWidth: 1, borderColor: COLORS.line, borderRadius: 18 },
  chipAlone: { paddingRight: 12 },
  chipLabel: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  remove: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  removeLabel: { fontSize: 16, color: COLORS.muted },
});
