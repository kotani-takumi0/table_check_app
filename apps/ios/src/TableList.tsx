import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { alertOf, dishProgress, displayOf, REASON_LABEL, STATUS_SHORT, type Session } from '@table-check/core/domain';
import { dialOf, formatHourMinute } from '@table-check/core/dial';
import { urgentOrder } from '@table-check/core/tableList';
import { cardTone, COLORS, TABULAR } from './theme';
import { Glass } from './Glass';
import { feedback } from './feedback';

// 全卓一覧（Web の TableList と同じ）：ツールバーの「一覧」で左から出す。フロアの上に重ねる（フロアは縮めない）。
// 急ぐ順（いま対応 → もうすぐ → 経過の長い順）に、卓番・段階・経過・人数・コース・料理の進みを並べ、行を押すと詳細シート
export function TableList({ sessions, time, onOpen, mini }: { sessions: Session[]; time: number; onOpen(session: Session, from: string): void; mini: boolean }) {
  const rows = urgentOrder(sessions, time);
  return (
    <Glass style={[styles.list, mini && styles.miniList]}>
      <Text style={styles.title} accessibilityRole="header">全卓一覧 <Text style={styles.count}>{rows.length}組</Text></Text>
      {rows.length === 0 ? <Text style={styles.empty}>ご案内中の卓はありません</Text> : (
        <ScrollView contentContainerStyle={styles.rows}>
          {rows.map(({ session, tables: shown }) => {
            const alert = alertOf(session, time);
            const dial = dialOf(session, time);
            const display = displayOf(session.status, session.course);
            const progress = dishProgress(session);
            const tone = cardTone(alert.level);
            const exited = session.status === 'exited';
            const elapsed = exited ? '退店済' : dial.elapsedMin === null ? '開始前' : formatHourMinute(dial.elapsedMin);
            const tables = shown.join('・');
            const meta = `${session.guests === null ? '人数未入力' : `${session.guests}名`}${session.course !== null ? ' · コース' : ''}${progress ? ` · 料理 ${progress.served}/${progress.total}` : ''}`;
            return (
              <Pressable key={session.id} accessibilityRole="button"
                accessibilityLabel={`${tables}番 ${STATUS_SHORT[display]} ${alert.reason ? REASON_LABEL[alert.reason] : ''} 経過${elapsed} ${meta}（押すと詳細）`}
                onPress={() => { feedback.open(); onOpen(session, shown[0]); }}
                style={({ pressed }) => [styles.row, { backgroundColor: tone.bg }, exited && styles.exited, pressed && styles.pressed]}>
                <Text style={styles.number} numberOfLines={1}>{tables}</Text>
                <View style={styles.main}>
                  {alert.reason
                    ? <View style={[styles.badge, { backgroundColor: alert.level === 'soon' ? COLORS.soon : COLORS.now }]}>
                      <Text style={[styles.badgeLabel, { color: alert.level === 'soon' ? COLORS.onSoon : COLORS.onNow }]}>{REASON_LABEL[alert.reason]}</Text>
                    </View>
                    : <Text style={[styles.status, { color: tone.text }]}>{STATUS_SHORT[display]}</Text>}
                  <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
                </View>
                <Text style={[styles.time, TABULAR]}>{elapsed}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </Glass>
  );
}
const styles = StyleSheet.create({
  list: { position: 'absolute', zIndex: 6, top: 0, left: 0, bottom: 0, width: 380, maxWidth: '100%', borderRadius: 20 },
  miniList: { width: '100%' },
  title: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, fontSize: 16, fontWeight: '700', color: COLORS.text },
  count: { fontSize: 13, fontWeight: '500', color: COLORS.muted },
  empty: { paddingHorizontal: 16, paddingBottom: 16, color: COLORS.muted },
  rows: { paddingHorizontal: 8, paddingBottom: 8, gap: 4 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  exited: { opacity: 0.5 },
  pressed: { opacity: 0.6 },
  number: { width: 64, fontSize: 18, fontWeight: '700', color: COLORS.text },
  main: { flex: 1, minWidth: 0, gap: 2, alignItems: 'flex-start' },
  status: { fontSize: 15, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeLabel: { fontSize: 13, fontWeight: '700' },
  meta: { fontSize: 12, color: COLORS.muted },
  time: { fontSize: 20, fontWeight: '700', color: COLORS.text },
});
