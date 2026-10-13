import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ROADMAP_CTA_DETAIL, ROADMAP_CTA_TITLE, ROADMAP_EMPTY, ROADMAP_FROM_FEEDBACK_LABEL, ROADMAP_NOTE, ROADMAP_STAGE_LABEL, roadmapGroups } from '@table-check/core/roadmap';
import type { FeedbackStore } from '@table-check/core/feedback';
import { FeedbackForm } from './FeedbackForm';
import { ReleaseNotes } from './ReleaseNotes';
import { feedback } from './feedback';

export type NoticeTab = 'roadmap' | 'updates' | 'feedback';
const TABS: { id: NoticeTab; label: string }[] = [
  { id: 'roadmap', label: '今後の予定' },
  { id: 'updates', label: '最近の更新' },
  { id: 'feedback', label: 'ご意見を送る' },
];
const TILE = '#f3f6f4';
const INK = '#16211b';
const INK2 = '#4b5a51';
const MUTED = '#627168';
const LINE = '#e2e9e4';
const EDGE = '#bcc6c0';
const KEY = '#1b7a3e';
const PREP = '#e8f3ec';
const PAGE = '#ffffff';

// お知らせ（No.144。Web の Notices と同じ）。今後の予定・最近の更新・ご意見を送るをタブにまとめる
export function Notices({ tab, onTab, roadmapNew, feedbackStore, shopName, top, mini }: {
  tab: NoticeTab; onTab(tab: NoticeTab): void; roadmapNew: boolean; feedbackStore: FeedbackStore; shopName: string; top: number; mini: boolean;
}) {
  return (
    <ScrollView style={[styles.screen, mini ? styles.screenMini : styles.screenRegular]} contentContainerStyle={[styles.content, { paddingTop: top }]} keyboardShouldPersistTaps="handled">
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
        : <FeedbackForm feedbackStore={feedbackStore} shopName={shopName} />}
    </ScrollView>
  );
}

function Roadmap({ onFeedback, mini }: { onFeedback(): void; mini: boolean }) {
  const groups = roadmapGroups();
  if (groups.length === 0) return (
    <View style={styles.emptyPanel}>
      <Text style={styles.emptyText}>{ROADMAP_EMPTY}</Text>
      <Pressable accessibilityRole="button" onPress={onFeedback} style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}>
        <Text style={styles.emptyButtonLabel}>ご意見を送る</Text>
      </Pressable>
    </View>
  );
  return (
    <View>
      {groups.map(group => (
        <View key={group.stage}>
          <Text style={styles.stage} accessibilityRole="header">{ROADMAP_STAGE_LABEL[group.stage]}</Text>
          <View style={styles.panel}>
            {group.items.map((item, index) => (
              <View key={item.id} style={[styles.row, index === 0 && styles.rowFirst]}>
                <Text style={[styles.chip, item.stage === 'preparing' && styles.chipPrep]}>{ROADMAP_STAGE_LABEL[item.stage]}</Text>
                <View style={styles.body}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.detail}>{item.detail}</Text>
                  {item.fromFeedback && (
                    <View style={styles.from}>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
                        <Path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v7a1.5 1.5 0 0 1-1.5 1.5H10l-3.5 3v-3H6.5A1.5 1.5 0 0 1 5 13.5z" />
                      </Svg>
                      <Text style={styles.fromText}>{ROADMAP_FROM_FEEDBACK_LABEL}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
      <Text style={styles.note}>{ROADMAP_NOTE}</Text>
      <View style={[styles.cta, mini && styles.ctaMini]}>
        <View style={styles.ctaText}>
          <Text style={styles.ctaTitle}>{ROADMAP_CTA_TITLE}</Text>
          <Text style={styles.detail}>{ROADMAP_CTA_DETAIL}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onFeedback} style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}>
          <Text style={styles.ctaButtonLabel}>ご意見を送る</Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TILE },
  screenRegular: { marginHorizontal: -16 },
  screenMini: { marginHorizontal: -8 },
  content: { width: '100%', maxWidth: 880, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 40 },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden' },
  tabs: { alignSelf: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', maxWidth: '100%', marginBottom: 20, padding: 3, gap: 2, borderWidth: 1, borderColor: EDGE, borderRadius: 8, backgroundColor: PAGE },
  tabsMini: { alignSelf: 'stretch' },
  tab: { position: 'relative', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  tabMini: { flex: 1, paddingHorizontal: 6, alignItems: 'center' },
  tabOn: { backgroundColor: KEY },
  tabLabel: { fontSize: 14, fontWeight: '500', lineHeight: 20, color: INK2 },
  tabLabelOn: { color: '#ffffff' },
  dot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: KEY },
  dotOn: { backgroundColor: '#ffffff' },
  stage: { marginTop: 20, marginBottom: 8, fontSize: 14, fontWeight: '500', color: MUTED },
  panel: { borderWidth: 1, borderColor: EDGE, borderRadius: 12, backgroundColor: PAGE, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 16, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: LINE },
  rowFirst: { borderTopWidth: 0 },
  chip: { marginTop: 2, paddingVertical: 3, paddingHorizontal: 9, borderWidth: 1, borderColor: EDGE, borderRadius: 8, backgroundColor: TILE, color: INK2, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  chipPrep: { borderColor: KEY, backgroundColor: PREP, color: KEY },
  body: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700', lineHeight: 26, color: INK },
  detail: { marginTop: 2, fontSize: 14, lineHeight: 22, color: INK2 },
  from: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  fromText: { fontSize: 12, lineHeight: 17, color: MUTED },
  note: { marginTop: 14, fontSize: 12, lineHeight: 20, color: MUTED },
  cta: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 16, paddingHorizontal: 18, borderWidth: 1, borderColor: EDGE, borderRadius: 12, backgroundColor: PAGE },
  ctaMini: { flexDirection: 'column', alignItems: 'stretch' },
  ctaText: { flex: 1 },
  ctaTitle: { fontSize: 15, fontWeight: '700', lineHeight: 22, color: INK },
  ctaButton: { height: 48, paddingHorizontal: 20, borderWidth: 1, borderColor: KEY, borderRadius: 8, backgroundColor: PAGE, alignItems: 'center', justifyContent: 'center' },
  ctaButtonLabel: { fontSize: 14, fontWeight: '700', color: KEY },
  pressed: { opacity: 0.6 },
  emptyPanel: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 32, paddingHorizontal: 18, borderWidth: 1, borderColor: EDGE, borderRadius: 12, backgroundColor: PAGE },
  emptyText: { fontSize: 14, lineHeight: 22, color: MUTED, textAlign: 'center' },
  emptyButton: { height: 48, paddingHorizontal: 20, borderWidth: 1, borderColor: KEY, borderRadius: 8, backgroundColor: PAGE, alignItems: 'center', justifyContent: 'center' },
  emptyButtonLabel: { fontSize: 14, fontWeight: '700', color: KEY },
});
