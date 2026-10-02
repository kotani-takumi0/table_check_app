import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { RULES } from '@table-check/core/domain';
import type { ShopSettings } from '@table-check/core/shopSettings';
import { COLORS } from './theme';
import { Glass } from './Glass';
import { feedback } from './feedback';

// 設定の画面（Web の Settings と同じ）。店全体の設定は全端末に反映する
export function Settings({ settings, onTimeLimitOff, top }: { settings: ShopSettings; onTimeLimitOff(off: boolean): void; top: number }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: top }]}>
      <Text style={styles.title} accessibilityRole="header">設定</Text>
      <Glass tint={0.84} style={styles.group}>
        <Text style={styles.groupTitle}>時間のルール</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>時間制限なし</Text>
            <Text style={styles.help}>空いている日などに、L.O.・お席の時間の通知と色を止めます。経過の時間とお通しの警告はそのまま出します。すべての端末に反映されます。</Text>
          </View>
          {/* No.80：空いているかは日によって違うので、自動では切り替えずにここでオン・オフする */}
          <Switch accessibilityLabel="時間制限なし" value={settings.timeLimitOff} trackColor={{ true: COLORS.action }}
            onValueChange={off => { feedback.tap(); onTimeLimitOff(off); }} />
        </View>
        <Text style={styles.note}>ふだんのルール：お通しは案内から{RULES.otoshiWarnMin}分、L.O.は{RULES.lastOrderMin}分、お席の時間は{RULES.seatLimitMin}分（コースはファーストドリンクから数えます）</Text>
      </Glass>
    </ScrollView>
  );
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
  note: { marginTop: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line, fontSize: 13, lineHeight: 19, color: COLORS.muted },
});
