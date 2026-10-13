import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ROADMAP_CTA_DETAIL, ROADMAP_CTA_TITLE, ROADMAP_EMPTY, ROADMAP_FROM_FEEDBACK_LABEL, ROADMAP_NOTE, ROADMAP_STAGE_LABEL, roadmapGroups } from '@table-check/core/roadmap';
import type { FeedbackStore } from '@table-check/core/feedback';
import { FeedbackForm } from './FeedbackForm';
import { ReleaseNotes } from './ReleaseNotes';
import { feedback } from './feedback';
import { Glass } from './Glass';
import { COLORS } from './theme';

export type NoticeTab = 'roadmap' | 'updates' | 'feedback';
const TABS: { id: NoticeTab; label: string }[] = [
  { id: 'roadmap', label: '今後の予定' },
  { id: 'updates', label: '最近の更新' },
  { id: 'feedback', label: 'ご意見を送る' },
];

// お知らせ（No.144。Web の Notices と同じ中身）。色とパネルはほかの iOS 画面のテーマと Glass にそろえる
export function Notices({ tab, onTab, roadmapNew, feedbackStore, shopName, shopId, top, mini }: {
  tab: NoticeTab; onTab(tab: NoticeTab): void; roadmapNew: boolean; feedbackStore: FeedbackStore; shopName: string; shopId: string; top: number; mini: boolean;
}) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: top }]} keyboardShouldPersistTaps="handled">
      <Text style={styles.hidden} accessibilityRole="header">お知らせ</Text>
      <View style={[styles.tabs, mini && styles.tabsMini]} accessibilityRole="tablist">
        {TABS.map(item => {
          const on = tab === item.id;
          return (
            <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { feedback.tap(); onTab(item.id); }}
              style={[styles.tab, mini && styles.tabMini, on && styles.tabOn]}>
              <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{item.label}</Text>
              {item.id === 'roadmap' && roadmapNew && <View style={[styles.dot, on && styles.dotOn]} accessibilityLabel="新しい予定" />}
            </Pressable>
          );
        })}
      </View>
      {tab === 'roadmap' ? <Roadmap mini={mini} onFeedback={() => { feedback.tap(); onTab('feedback'); }} />
        : tab === 'updates' ? <ReleaseNotes />
        : <FeedbackForm feedbackStore={feedbackStore} shopName={shopName} shopId={shopId} />}
    </ScrollView>
  );
}

function Roadmap({ onFeedback, mini }: { onFeedback(): void; mini: boolean }) {
  const groups = roadmapGroups();
  if (groups.length === 0) return (
    <Glass tint={0.84} style={styles.emptyPanel}>
      <View style={styles.emptyPlate}>
        <Text style={styles.emptyText}>{ROADMAP_EMPTY}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onFeedback} style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
        <Text style={styles.outlineLabel}>ご意見を送る</Text>
      </Pressable>
    </Glass>
  );
  return (
    <View>
      {groups.map(group => (
        <View key={group.stage}>
          <Text style={styles.stage} accessibilityRole="header">{ROADMAP_STAGE_LABEL[group.stage]}</Text>
          <Glass tint={0.84} style={styles.panel}>
            {group.items.map((item, index) => (
              <View key={item.id} style={[styles.row, index === 0 && styles.rowFirst]}>
                <Text style={[styles.chip, item.stage === 'preparing' && styles.chipPrep]}>{ROADMAP_STAGE_LABEL[item.stage]}</Text>
                <View style={styles.textPlate}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.detail}>{item.detail}</Text>
                  {item.fromFeedback && (
                    <View style={styles.from}>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={COLORS.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
                        <Path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v7a1.5 1.5 0 0 1-1.5 1.5H10l-3.5 3v-3H6.5A1.5 1.5 0 0 1 5 13.5z" />
                      </Svg>
                      <Text style={styles.fromText}>{ROADMAP_FROM_FEEDBACK_LABEL}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </Glass>
        </View>
      ))}
      <Text style={styles.note}>{ROADMAP_NOTE}</Text>
      <Glass tint={0.84} style={[styles.cta, mini && styles.ctaMini]}>
        <View style={[styles.textPlate, styles.ctaText]}>
          <Text style={styles.ctaTitle}>{ROADMAP_CTA_TITLE}</Text>
          <Text style={styles.detail}>{ROADMAP_CTA_DETAIL}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onFeedback} style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
          <Text style={styles.outlineLabel}>ご意見を送る</Text>
        </Pressable>
      </Glass>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 880, alignSelf: 'center', paddingBottom: 40 },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden' },
  tabs: { alignSelf: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', maxWidth: '100%', marginBottom: 20, padding: 3, gap: 2, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, backgroundColor: COLORS.surface },
  tabsMini: { alignSelf: 'stretch' },
  tab: { position: 'relative', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  tabMini: { flex: 1, paddingHorizontal: 6, alignItems: 'center' },
  tabOn: { backgroundColor: COLORS.action },
  tabLabel: { fontSize: 14, fontWeight: '500', lineHeight: 20, color: COLORS.muted },
  tabLabelOn: { color: COLORS.onAction },
  dot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.action },
  dotOn: { backgroundColor: COLORS.onAction },
  stage: { marginTop: 20, marginBottom: 8, fontSize: 14, fontWeight: '500', color: COLORS.muted },
  panel: { borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 16, paddingHorizontal: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line },
  rowFirst: { borderTopWidth: 0 },
  chip: { marginTop: 2, paddingVertical: 3, paddingHorizontal: 9, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, backgroundColor: COLORS.bg, color: COLORS.muted, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  chipPrep: { borderColor: COLORS.action, backgroundColor: COLORS.actionBg, color: COLORS.actionText },
  textPlate: { flex: 1, borderRadius: 8, backgroundColor: COLORS.surface, paddingVertical: 4, paddingHorizontal: 8 },
  title: { fontSize: 17, fontWeight: '700', lineHeight: 26, color: COLORS.text },
  detail: { marginTop: 2, fontSize: 14, lineHeight: 22, color: COLORS.muted },
  from: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  fromText: { fontSize: 12, lineHeight: 17, color: COLORS.muted },
  note: { marginTop: 14, fontSize: 12, lineHeight: 20, color: COLORS.muted },
  cta: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 20 },
  ctaMini: { flexDirection: 'column', alignItems: 'stretch' },
  ctaText: { flex: 1 },
  ctaTitle: { fontSize: 15, fontWeight: '700', lineHeight: 22, color: COLORS.text },
  outlineButton: { height: 48, paddingHorizontal: 20, borderWidth: 1, borderColor: COLORS.action, borderRadius: 12, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  outlineLabel: { fontSize: 14, fontWeight: '700', color: COLORS.actionText },
  pressed: { opacity: 0.6 },
  emptyPanel: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 32, paddingHorizontal: 18, borderRadius: 20 },
  emptyPlate: { alignSelf: 'stretch', borderRadius: 8, backgroundColor: COLORS.surface, paddingVertical: 8, paddingHorizontal: 12 },
  emptyText: { fontSize: 14, lineHeight: 22, color: COLORS.muted, textAlign: 'center' },
});
