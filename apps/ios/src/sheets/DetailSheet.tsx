import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { clockTimeNear, dishProgress, displayOf, formatClock, formatElapsed, nextStatus, STATUS_LABEL, timerOf, type Course, type EditableTime, type Session } from '@table-check/core/domain';
import { COLORS, TABULAR } from '../theme';
import { feedback } from '../feedback';
import { PanelButton } from '../ui';
import { menuOf } from '@table-check/core/courseMenus';
import { CoursePicker } from './CoursePicker';
import { MenuPicker } from './MenuPicker';
import { GuestStepper } from './GuestStepper';
import { sheet } from './common';

interface Props {
  session: Session;
  time: number;
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
export function DetailSheet({ session, time, onClose, onNext, onSeat, onBack, onRetime, onPay, onGuests, onCourse, onMenu, onServe, onUnserve, from, onPick, onRelease }: Props) {
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
  return <>
    <View style={styles.head}>
      <Text style={styles.seat}>{session.tableIds.join('・')}番</Text>
      <Text style={sheet.title}>{STATUS_LABEL[display]}</Text>
      <Text style={[styles.timer, TABULAR]}>{timer.label} {timer.elapsedMs === null ? '--:--' : formatElapsed(timer.elapsedMs)}</Text>
    </View>
    {/* 卓カードから移した操作：段階を進める・戻す、お会計 */}
    <View style={sheet.actions}>
      <PanelButton label={session.status === 'seated' ? '案内を取り消す' : '1つ戻す'} onPress={() => { feedback.step(); onBack(session); }} style={sheet.action} />
      {next
        ? <PanelButton label={STATUS_LABEL[displayOf(next, session.course)]} tone="primary" onPress={() => { feedback.step(); onNext(session); }} style={sheet.action} />
        : session.status === 'exited' && <PanelButton label={session.tableIds.length > 1 ? `${from}番にご案内` : 'ご案内'} tone="primary" onPress={() => { feedback.tap(); onSeat(from); }} style={sheet.action} />}
    </View>
    <View style={sheet.row}>
      <Text style={sheet.rowLabel}>お会計</Text>
      <Text style={[sheet.text, styles.grow, session.paidAt !== null && sheet.muted]}>{session.paidAt === null ? '未払い' : `お会計済み（${formatClock(session.paidAt)}）`}</Text>
      <PanelButton label={session.paidAt === null ? 'お会計済みにする' : '未払いに戻す'} onPress={() => { feedback.tap(); onPay(session); }} />
    </View>
    <View style={sheet.row}>
      <Text style={sheet.rowLabel}>コース</Text>
      <CoursePicker value={session.course} onChange={course => onCourse(session, course)} />
    </View>
    {session.course !== null && <View style={sheet.row}>
      <Text style={sheet.rowLabel}>料理</Text>
      <MenuPicker value={session.menu} onChange={menu => onMenu(session, menu)} />
    </View>}
    {/* 料理はメニューの順に1品ずつ進める。出した料理に印を付け、次に出す料理を目立たせる */}
    {progress && <View style={styles.dishes}>
      <View accessibilityLabel={`料理 ${progress.total}品中${progress.served}品提供済み`}>
        {dishes.map((dish, i) => {
          const served = i < progress.served;
          const next = i === progress.served;
          return (
            <View key={i} style={[styles.dish, next && styles.nextDish]}>
              <Text style={[styles.dishMark, served && sheet.muted, TABULAR]}>{served ? '✓' : i + 1}</Text>
              <Text style={[styles.dishName, served && sheet.muted, next && styles.nextDishName]}>{dish}</Text>
            </View>
          );
        })}
      </View>
      <View style={sheet.actions}>
        <PanelButton label="1品戻す" disabled={progress.served === 0} onPress={() => { feedback.step(); onUnserve(session); }} style={sheet.action} />
        <PanelButton label={progress.next === null ? '全部出しました' : `${progress.served + 1}品目を出した`} tone="primary" disabled={progress.next === null}
          onPress={() => { feedback.step(); onServe(session); }} style={sheet.action} />
      </View>
    </View>}
    <TimeRow key={`seated-${session.seatedAt}`} label="案内" value={session.seatedAt} order={order} onSave={save('seatedAt', session.seatedAt)} />
    <TimeRow key={`otoshi-${session.otoshiAt}`} label={otoshiLabel} value={session.otoshiAt} order={order} onSave={save('otoshiAt', session.otoshiAt ?? session.seatedAt)} />
    <View style={sheet.row}>
      <Text style={sheet.rowLabel}>人数</Text>
      <GuestStepper value={session.guests} onChange={guests => onGuests(session, guests)} />
    </View>
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
    <View style={sheet.actions}>
      <PanelButton label="閉じる" onPress={onClose} style={sheet.action} />
    </View>
  </>;
}
const styles = StyleSheet.create({
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 12, rowGap: 4 },
  seat: { fontSize: 16, fontWeight: '500', color: COLORS.text },
  timer: { marginLeft: 'auto', fontSize: 16, color: COLORS.muted },
  timeRow: { gap: 6 },
  fix: { marginLeft: 'auto', minWidth: 72 },
  error: { fontSize: 14, color: COLORS.nowText },
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
