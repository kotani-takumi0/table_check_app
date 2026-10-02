import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { DrinkPlan } from '@table-check/core/domain';
import { DRINK_PLAN_NAME_MAX, DRINK_PLANS_MAX, newDrinkPlanId, SHOP_NAME_MAX, stepMinutes, type MinuteSetting, type ShopSettings } from '@table-check/core/shopSettings';
import { COLORS, TABULAR } from './theme';
import { Glass } from './Glass';
import { feedback } from './feedback';
import { PanelButton } from './ui';

// 設定の画面（Web の Settings と同じ）。店全体の設定は全端末に反映する
export function Settings({ settings, onChange, onOpenLayout, top }: { settings: ShopSettings; onChange(change: Partial<ShopSettings>): void; onOpenLayout(): void; top: number }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: top }]} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">設定</Text>
      <Glass tint={0.84} style={styles.group}>
        <Text style={styles.groupTitle}>時間のルール</Text>
        {/* No.80：空いているかは日によって違うので、自動では切り替えずにここでオン・オフする */}
        <SwitchRow label="時間制限なし" checked={settings.timeLimitOff} onChange={timeLimitOff => onChange({ timeLimitOff })}
          help="空いている日などに、L.O.・お席の時間の通知と色を止めます。経過の時間とお通しの警告はそのまま出します。" />
        {/* No.14：店ごとに分を決める。L.O.・お席の時間は案内（コースはファーストドリンク）から数える */}
        <MinutesRow settings={settings} field="lastOrderMin" label="L.O." help="案内から数えます（コースはファーストドリンクから）" onChange={onChange} />
        <MinutesRow settings={settings} field="seatLimitMin" label="お席の時間" help="案内から数えます（コースはファーストドリンクから）" onChange={onChange} />
        <SwitchRow label="お通しを出す" checked={settings.otoshi} onChange={otoshi => onChange({ otoshi })}
          help="出さない店は「お通し提供済み」を「ファーストドリンク提供済み」と呼び、お通し未提供の警告を出しません。" />
        {settings.otoshi && <MinutesRow settings={settings} field="otoshiWarnMin" label="お通しの警告" help="案内からこの時間たってもお通しがまだなら知らせます" onChange={onChange} />}
        <MinutesRow settings={settings} field="exitedKeepMin" label="退店済みを残す" help="退店したあと、卓に退店済みを出しておく時間" onChange={onChange} />
        <Text style={styles.note}>変えると、すべての端末にすぐ反映されます。</Text>
      </Glass>
      <Glass tint={0.84} style={styles.group}>
        <Text style={styles.groupTitle}>コース</Text>
        <DrinkPlanRows plans={settings.drinkPlans} onChange={drinkPlans => onChange({ drinkPlans })} />
      </Glass>
      <Glass tint={0.84} style={styles.group}>
        <Text style={styles.groupTitle}>お店</Text>
        <ShopNameRow name={settings.shopName} onSave={shopName => onChange({ shopName })} />
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>席の配置</Text>
            <Text style={styles.help}>卓の場所・大きさ・卓番と、カウンターなどのことばを、マス目にブロックを置いて作り直します。すべての端末に反映されます。</Text>
          </View>
          <PanelButton label="変える" onPress={() => { feedback.tap(); onOpenLayout(); }} style={styles.open} />
        </View>
      </Glass>
    </ScrollView>
  );
}
function SwitchRow({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange(checked: boolean): void }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.help}>{help}</Text>
      </View>
      <Switch accessibilityLabel={label} value={checked} trackColor={{ true: COLORS.action }} onValueChange={value => { feedback.tap(); onChange(value); }} />
    </View>
  );
}
// 分を −／＋ で変える（Web の MinutesRow と同じ。1回で5分、退店済みは1分）。L.O. はお席の時間より前にしかできない
function MinutesRow({ settings, field, label, help, onChange }: { settings: ShopSettings; field: MinuteSetting; label: string; help: string; onChange(change: Partial<ShopSettings>): void }) {
  const less = stepMinutes(settings, field, -1), more = stepMinutes(settings, field, 1);
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.help}>{help}</Text>
      </View>
      <View style={styles.stepper} accessibilityLabel={label}>
        <PanelButton label="−" disabled={!less} onPress={() => { if (less) { feedback.tap(); onChange(less); } }} style={styles.stepButton} />
        <Text style={[styles.minutes, TABULAR]} accessibilityLabel={`${label} ${settings[field]}分`}>{settings[field]}分</Text>
        <PanelButton label="＋" disabled={!more} onPress={() => { if (more) { feedback.tap(); onChange(more); } }} style={styles.stepButton} />
      </View>
    </View>
  );
}
function ShopNameRow({ name, onSave }: { name: string; onSave(name: string): void }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>店名</Text>
        <Text style={styles.help}>ログインしたときに、どの店か分かるように出します</Text>
      </View>
      <SavedInput label="店名" value={name} maxLength={SHOP_NAME_MAX} placeholder="店の名前" onSave={onSave} style={styles.input} />
    </View>
  );
}
// 飲み放題の区分（Web の DrinkPlanRows と同じ。No.90）：名前を直す・足す・消す。消しても、その区分で案内中の卓はそのまま
function DrinkPlanRows({ plans, onChange }: { plans: DrinkPlan[]; onChange(plans: DrinkPlan[]): void }) {
  return <>
    <View style={styles.rowText}>
      <Text style={styles.rowLabel}>飲み放題の区分</Text>
      <Text style={styles.help}>ご案内のときに選ぶと、その卓はコースになります（L.O.・お席の時間はファーストドリンクから数えます）。区分が無ければコースは選べません。</Text>
    </View>
    {plans.map((plan, i) => (
      <View key={plan.id} style={styles.row}>
        <SavedInput label={`区分${i + 1}の名前`} value={plan.name} maxLength={DRINK_PLAN_NAME_MAX} placeholder="区分の名前" style={styles.planInput}
          onSave={name => { if (name !== '') onChange(plans.map(p => p.id === plan.id ? { ...p, name } : p)); }} />
        <PanelButton label="消す" tone="danger" onPress={() => { feedback.warn(); onChange(plans.filter(p => p.id !== plan.id)); }} style={styles.remove} />
      </View>
    ))}
    {plans.length < DRINK_PLANS_MAX && <PanelButton label="＋ 区分を足す" onPress={() => { feedback.tap(); onChange([...plans, { id: newDrinkPlanId(plans, Date.now()), name: '新しい区分' }]); }} style={styles.add} />}
  </>;
}
// 文字の設定（Web の SavedInput と同じ）：入力を終えたら保存する。打っている途中では保存しない
function SavedInput({ label, value, maxLength, placeholder, onSave, style }: { label: string; value: string; maxLength: number; placeholder: string; onSave(value: string): void; style: object }) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const save = () => { setEditing(false); const trimmed = draft.trim(); if (trimmed !== value) onSave(trimmed); };
  return <TextInput accessibilityLabel={label} style={style} maxLength={maxLength} placeholder={placeholder} placeholderTextColor={COLORS.muted} returnKeyType="done"
    value={editing ? draft : value} onFocus={() => { setDraft(value); setEditing(true); }} onChangeText={setDraft} onEndEditing={save} />;
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { alignSelf: 'center', width: '100%', maxWidth: 640, gap: 16, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  group: { paddingVertical: 16, paddingHorizontal: 20, borderRadius: 20 },
  groupTitle: { marginBottom: 8, fontSize: 14, fontWeight: '700', color: COLORS.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8 },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  help: { marginTop: 4, fontSize: 13, lineHeight: 19, color: COLORS.muted },
  open: { minWidth: 88, minHeight: 44 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepButton: { width: 44, minHeight: 44, paddingHorizontal: 0 },
  minutes: { width: 64, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.text },
  input: { width: 200, minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.lineStrong, borderRadius: 12, backgroundColor: COLORS.bg, fontSize: 16, color: COLORS.text },
  planInput: { flex: 1, minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.lineStrong, borderRadius: 12, backgroundColor: COLORS.bg, fontSize: 16, color: COLORS.text },
  remove: { minWidth: 72, minHeight: 44 },
  add: { marginTop: 4, minHeight: 44 },
  note: { marginTop: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line, fontSize: 13, lineHeight: 19, color: COLORS.muted },
});
