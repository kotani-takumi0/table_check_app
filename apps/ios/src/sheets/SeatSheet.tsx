import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { drinkPlanName, QUICK_GUESTS, stepGuests, type Course } from '@table-check/core/domain';
import { priceLabel } from '@table-check/core/courseMenus';
import type { ShopSettings } from '@table-check/core/shopSettings';
import { feedback } from '../feedback';
import { COLORS, FILL, TABULAR } from '../theme';
import { CloseButton, PanelButton } from '../ui';
import { sheet } from './common';

interface Props {
  tableId: string;
  exited: boolean;           // 退店済の卓への案内
  previousUnpaid: boolean;   // 退店した前のお客さんがお会計前のまま
  onSeat(guests: number | null, course: Course | null, menu: string | null): void;
  settings: ShopSettings;   // 店の設定（時間のルール・飲み放題の区分・コース。No.14・No.89・No.90）
  onClose(): void;
}
// 選んでいるものを茎の緑で塗るボタン（コース・料理・よく来る人数）。radio は1つだけ選ぶもの
function Choice({ label, sub, selected, role, onPress }: { label: string; sub?: string; selected: boolean; role: 'radio' | 'button'; onPress(): void }) {
  return (
    <Pressable accessibilityRole={role} accessibilityState={role === 'radio' ? { checked: selected } : { selected }}
      onPress={() => { feedback.tap(); onPress(); }} style={({ pressed }) => [styles.choice, selected && styles.choiceOn, pressed && styles.pressed]}>
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelOn]} numberOfLines={2}>{label}</Text>
      {sub ? <Text style={[styles.choiceSub, selected && styles.choiceLabelOn]} numberOfLines={1}>{sub}</Text> : null}
    </Pressable>
  );
}
// ご案内（Web の SeatDialog と同じ。No.85）：iPad は押した卓のそばのポップオーバー、iPhone は下からのシートで聞く。
// 人数は −／＋ と「よく来る人数」、コース・料理はボタンで選び、最後に大きな「ご案内」を1つだけ押す
export function SeatSheet({ tableId, exited, previousUnpaid, onSeat, settings, onClose }: Props) {
  const [guests, setGuests] = useState<number | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  // どのコースか。コースを選んだときだけ聞く（任意）
  const [menu, setMenu] = useState<string | null>(null);
  const seat = () => { feedback.done(); onSeat(guests, course, course === null ? null : menu); onClose(); };
  const step = (delta: 1 | -1) => { feedback.tap(); setGuests(g => stepGuests(g, delta)); };
  const plans: { id: Course | null; name: string }[] = [{ id: null, name: '通常' }, ...settings.drinkPlans.map(plan => ({ id: plan.id, name: drinkPlanName(settings.drinkPlans, plan.id) }))];
  return <>
    <Text style={sheet.title} accessibilityRole="header">{tableId}番にご案内</Text>
    {exited && <Text style={sheet.message}>{tableId}番は退店済みです。ご案内すると、前のお客さんの表示は新しいお客さんに置き換わります。</Text>}
    {exited && previousUnpaid && <Text style={sheet.warning}>前のお客さんはお会計済みになっていません</Text>}
    <Text style={styles.label} accessibilityRole="header">人数</Text>
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel="1人へらす" disabled={guests === null} onPress={() => step(-1)}
        style={({ pressed }) => [styles.stepButton, guests === null && styles.disabled, pressed && styles.pressed]}>
        <Text style={styles.stepMark}>−</Text>
      </Pressable>
      <Text style={[styles.count, guests === null && styles.countEmpty]} accessibilityLiveRegion="polite">{guests === null ? 'あとで' : `${guests}名`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="1人ふやす" onPress={() => step(1)}
        style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
        <Text style={styles.stepMark}>＋</Text>
      </Pressable>
    </View>
    <View style={styles.quick} accessibilityLabel="よく来る人数">
      {QUICK_GUESTS.map(n => <View key={n} style={styles.quickCell}><Choice label={`${n}名`} selected={guests === n} role="button" onPress={() => setGuests(n)} /></View>)}
    </View>
    <Text style={styles.label} accessibilityRole="header">コース</Text>
    <View style={styles.grid} accessibilityRole="radiogroup">
      {plans.map(plan => <View key={plan.id ?? ''} style={styles.cell}><Choice label={plan.name} selected={course === plan.id} role="radio" onPress={() => setCourse(plan.id)} /></View>)}
    </View>
    {course !== null && <>
      <Text style={styles.label} accessibilityRole="header">料理</Text>
      <View style={styles.grid} accessibilityRole="radiogroup">
        <View style={styles.cell}><Choice label="未定" selected={menu === null} role="radio" onPress={() => setMenu(null)} /></View>
        {settings.courseMenus.map(m => <View key={m.id} style={styles.cell}><Choice label={priceLabel(m)} sub={m.short} selected={menu === m.id} role="radio" onPress={() => setMenu(m.id)} /></View>)}
      </View>
    </>}
    <PanelButton label={guests === null ? 'ご案内（人数はあとで）' : `${guests}名でご案内`} tone="primary" onPress={seat} style={styles.go} />
    <CloseButton onPress={onClose} />
  </>;
}
const styles = StyleSheet.create({
  label: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepButton: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: COLORS.lineStrong, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  stepMark: { fontSize: 30, fontWeight: '700', color: COLORS.text },
  count: { flex: 1, textAlign: 'center', fontSize: 36, fontWeight: '900', color: COLORS.text, ...TABULAR },
  countEmpty: { fontSize: 24, fontWeight: '700', color: COLORS.muted },
  quick: { flexDirection: 'row', gap: 8 },
  quickCell: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexBasis: '47%', flexGrow: 1 },
  choice: { minHeight: 48, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 24, borderWidth: 2, borderColor: 'transparent', backgroundColor: FILL, alignItems: 'center', justifyContent: 'center' },
  choiceOn: { borderColor: COLORS.action, backgroundColor: COLORS.action },
  choiceLabel: { fontSize: 15, color: COLORS.text, textAlign: 'center' },
  choiceLabelOn: { color: COLORS.onAction, fontWeight: '700' },
  choiceSub: { fontSize: 12, color: COLORS.text },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
  go: { minHeight: 64 },
});
