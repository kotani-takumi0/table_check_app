import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { priceLabel, type CourseMenu } from '@table-check/core/courseMenus';
import { courseMinutes, moveDish, setOwnMinutes, stepCourseMinutes } from '@table-check/core/courseEditor';
import { COURSE_LIMITS, courseProblems, type ShopSettings } from '@table-check/core/shopSettings';
import { COLORS, TABULAR } from './theme';
import { Glass } from './Glass';
import { feedback } from './feedback';
import { PanelButton } from './ui';

// コースを作る・直す画面（Web の CourseEditor と同じ。No.89）。下書きを直して「保存して使う」で全端末に反映する。
// 案内中の卓が使っているコース（usedBy）は消せず、料理の順番を変えたり料理を消したりもできない（出した品数がずれるので。名前を直す・最後に足すのはできる）
export function CourseEditor({ course, isNew, settings, usedBy, onSave, onDelete, onClose, top }: {
  course: CourseMenu; isNew: boolean; settings: ShopSettings; usedBy: string[]; onSave(course: CourseMenu): boolean; onDelete(): void; onClose(): void; top: number;
}) {
  const [draft, setDraft] = useState(course);
  const [saveError, setSaveError] = useState('');
  const inUse = usedBy.length > 0 && !isNew;
  const problems = courseProblems(draft);
  const changed = isNew || JSON.stringify(draft) !== JSON.stringify(course);
  const own = draft.lastOrderMin !== null || draft.seatLimitMin !== null;
  const minutes = courseMinutes(draft, settings);
  const setDish = (index: number, dish: string) => setDraft(d => ({ ...d, dishes: d.dishes.map((x, i) => i === index ? dish : x) }));
  const status = saveError || (problems.length ? `直すところ：${problems.join('／')}` : inUse ? `${usedBy.join('・')}番が使っているので、コースを消したり料理の順番を変えたりはできません（名前を直す・最後に足すのはできます）` : changed ? '保存すると、すべての端末のコースが変わります' : '');
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: top }]} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">{isNew ? 'コースを足す' : `${priceLabel(course)} ${course.short}を直す`}</Text>
      <Glass tint={0.84} style={styles.group}>
        <Text style={styles.groupTitle}>コース</Text>
        <Field label="名前"><TextInput accessibilityLabel="名前" style={styles.input} maxLength={COURSE_LIMITS.name} placeholder="例：カジュアルコース" placeholderTextColor={COLORS.muted}
          value={draft.name} onChangeText={name => setDraft(d => ({ ...d, name }))} /></Field>
        <Field label="ボタンの名前"><TextInput accessibilityLabel="ボタンの名前" style={styles.input} maxLength={COURSE_LIMITS.short} placeholder="例：カジュアル" placeholderTextColor={COLORS.muted}
          value={draft.short} onChangeText={short => setDraft(d => ({ ...d, short }))} /></Field>
        <Text style={styles.help}>選ぶボタンに値段と並べて出します。同じ値段のコースを見分けられる短い名前にしてください</Text>
        <Field label="値段（円）"><TextInput accessibilityLabel="値段（円）" style={styles.input} keyboardType="number-pad" maxLength={6}
          value={Number.isNaN(draft.price) ? '' : String(draft.price)} onChangeText={text => setDraft(d => ({ ...d, price: text === '' ? NaN : Number(text.replace(/\D/g, '')) }))} /></Field>
      </Glass>
      <Glass tint={0.84} style={styles.group}>
        <Text style={styles.groupTitle}>時間</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>このコースだけ L.O.・お席の時間を変える</Text>
            <Text style={styles.help}>{own ? 'ファーストドリンクから数えます' : `店の設定（L.O. ${settings.lastOrderMin}分・お席の時間 ${settings.seatLimitMin}分）を使います`}</Text>
          </View>
          <Switch accessibilityLabel="このコースだけ L.O.・お席の時間を変える" value={own} trackColor={{ true: COLORS.action }}
            onValueChange={value => { feedback.tap(); setDraft(d => setOwnMinutes(d, settings, value)); }} />
        </View>
        {own && (['lastOrderMin', 'seatLimitMin'] as const).map(key => {
          const label = key === 'lastOrderMin' ? 'L.O.' : 'お席の時間';
          const less = stepCourseMinutes(draft, settings, key, -1), more = stepCourseMinutes(draft, settings, key, 1);
          return (
            <View key={key} style={styles.row}>
              <Text style={[styles.rowLabel, styles.rowText]}>{label}</Text>
              <View style={styles.stepper}>
                <PanelButton label="−" disabled={!less} onPress={() => { if (less) { feedback.tap(); setDraft(less); } }} style={styles.small} />
                <Text style={[styles.minutes, TABULAR]} accessibilityLabel={`${label} ${minutes[key]}分`}>{minutes[key]}分</Text>
                <PanelButton label="＋" disabled={!more} onPress={() => { if (more) { feedback.tap(); setDraft(more); } }} style={styles.small} />
              </View>
            </View>
          );
        })}
      </Glass>
      <Glass tint={0.84} style={styles.group}>
        <Text style={styles.groupTitle}>料理（出す順）</Text>
        {draft.dishes.map((dish, i) => (
          <View key={i} style={styles.dish}>
            <Text style={[styles.dishNumber, TABULAR]}>{i + 1}</Text>
            <TextInput accessibilityLabel={`${i + 1}品目`} style={[styles.input, styles.dishInput]} maxLength={COURSE_LIMITS.dish} placeholder="料理の名前" placeholderTextColor={COLORS.muted}
              value={dish} onChangeText={text => setDish(i, text)} />
            <PanelButton label="↑" disabled={inUse || i === 0} onPress={() => { feedback.tap(); setDraft(d => ({ ...d, dishes: moveDish(d.dishes, i, -1) })); }} style={styles.small} />
            <PanelButton label="↓" disabled={inUse || i === draft.dishes.length - 1} onPress={() => { feedback.tap(); setDraft(d => ({ ...d, dishes: moveDish(d.dishes, i, 1) })); }} style={styles.small} />
            <PanelButton label="消す" tone="danger" disabled={inUse} onPress={() => { feedback.warn(); setDraft(d => ({ ...d, dishes: d.dishes.filter((_, j) => j !== i) })); }} style={styles.remove} />
          </View>
        ))}
        {draft.dishes.length < COURSE_LIMITS.dishes && <PanelButton label="＋ 料理を足す" onPress={() => { feedback.tap(); setDraft(d => ({ ...d, dishes: [...d.dishes, ''] })); }} style={styles.add} />}
      </Glass>
      <Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text>
      <View style={styles.foot}>
        {!isNew && <PanelButton label="このコースを消す" tone="danger" disabled={inUse} onPress={() => { feedback.warn(); onDelete(); onClose(); }} style={styles.footButton} />}
        <PanelButton label={changed ? '保存せずにもどる' : 'もどる'} onPress={() => { feedback.tap(); onClose(); }} style={styles.footButton} />
        <PanelButton label="保存して使う" tone="primary" disabled={!changed || problems.length > 0} onPress={() => { if (onSave(draft)) { feedback.done(); onClose(); } else { feedback.warn(); setSaveError(`コースは${COURSE_LIMITS.menus}個までです。ほかのコースを消してから保存してください`); } }} style={styles.footButton} />
      </View>
    </ScrollView>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { alignSelf: 'center', width: '100%', maxWidth: 640, gap: 16, paddingBottom: 24 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  group: { gap: 10, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 20 },
  groupTitle: { fontSize: 14, fontWeight: '700', color: COLORS.muted },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fieldLabel: { width: 96, fontSize: 15, fontWeight: '700', color: COLORS.text },
  input: { flex: 1, minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.lineStrong, borderRadius: 12, backgroundColor: COLORS.bg, fontSize: 16, color: COLORS.text },
  help: { fontSize: 13, lineHeight: 19, color: COLORS.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4 },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  small: { width: 44, minHeight: 44, paddingHorizontal: 0 },
  minutes: { width: 64, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.text },
  dish: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dishNumber: { width: 22, textAlign: 'right', fontSize: 14, color: COLORS.muted },
  dishInput: { minWidth: 0 },
  remove: { minWidth: 64, minHeight: 44 },
  add: { minHeight: 44 },
  status: { minHeight: 19, fontSize: 14, lineHeight: 19, color: COLORS.muted },
  foot: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footButton: { flexGrow: 1, minWidth: 150, minHeight: 44 },
});
