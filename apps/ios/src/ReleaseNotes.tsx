import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { RELEASE_NOTES, releaseDateLabel, releaseNoteOf, SEEN_RELEASE_KEY, shouldAnnounce } from '@table-check/core/releaseNotes';
import { version } from '../../../package.json';
import { COLORS } from './theme';
import { Glass } from './Glass';
import { feedback } from './feedback';

const APP_VERSION = `v${version}`;
// 更新のお知らせの画面（Web の ReleaseNotes と同じ。No.127）。版ごとに、何が変わったかを新しい順に出す
export function ReleaseNotes({ top }: { top: number }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: top }]}>
      <Text style={styles.title} accessibilityRole="header">更新のお知らせ</Text>
      <Text style={styles.help}>版ごとに、新しくなったところをまとめています。いまの版は {APP_VERSION} です。</Text>
      {RELEASE_NOTES.map(note => (
        <Glass key={note.version} tint={0.84} style={styles.group}>
          <View style={styles.head}>
            <Text style={styles.version} accessibilityRole="header">v{note.version}</Text>
            {`v${note.version}` === APP_VERSION && <Text style={styles.current}>いまの版</Text>}
            <Text style={styles.date}>{releaseDateLabel(note.date)}</Text>
          </View>
          {note.items.map(item => (
            <View key={item} style={styles.item}>
              <Text style={styles.bullet} accessible={false}>・</Text>
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
        </Glass>
      ))}
    </ScrollView>
  );
}

// 新しい版のお知らせを出すか（Web の useReleaseAnnounce と同じ）。見た版は端末に覚える（AsyncStorage）
export function useReleaseAnnounce(): { announce: boolean; markSeen(): void } {
  const [announce, setAnnounce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(SEEN_RELEASE_KEY).catch(() => null).then(seen => { if (alive) setAnnounce(shouldAnnounce(seen, APP_VERSION)); });
    return () => { alive = false; };
  }, []);
  const markSeen = useCallback(() => {
    setAnnounce(false);
    const note = releaseNoteOf(APP_VERSION);
    if (note) void AsyncStorage.setItem(SEEN_RELEASE_KEY, note.version).catch(() => undefined);
  }, []);
  return { announce, markSeen };
}

// 新しい版になったあとに1回だけ出す帯（Web の ReleaseBar と同じ。元に戻すの帯と同じ場所・形）。× で閉じるまで残す
export function ReleaseBar({ onOpen, onClose }: { onOpen(): void; onClose(): void }) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <Text style={styles.message} numberOfLines={1}>{APP_VERSION} になりました</Text>
        <Pressable accessibilityRole="button" onPress={() => { feedback.tap(); onOpen(); }} hitSlop={6} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonLabel}>内容を見る</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="閉じる" onPress={() => { feedback.tap(); onClose(); }} hitSlop={6} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" accessible={false}>
            <Path d="M6 6l12 12M18 6L6 18" />
          </Svg>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { alignSelf: 'center', width: '100%', maxWidth: 640, gap: 12, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  help: { fontSize: 13, lineHeight: 19, color: COLORS.muted },
  group: { gap: 6, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 20 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  version: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  current: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden', backgroundColor: COLORS.actionBg, color: COLORS.actionText, fontSize: 12, fontWeight: '700' },
  date: { marginLeft: 'auto', fontSize: 13, color: COLORS.muted },
  item: { flexDirection: 'row' },
  bullet: { width: 16, fontSize: 15, lineHeight: 23, color: COLORS.muted },
  itemText: { flex: 1, fontSize: 15, lineHeight: 23, color: COLORS.text },
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 24, alignItems: 'center' },
  bar: { maxWidth: 560, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 18, paddingRight: 6, paddingVertical: 6, borderRadius: 14, backgroundColor: COLORS.text },
  message: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: '#ffffff', paddingRight: 4 },
  button: { minHeight: 40, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center' },
  buttonLabel: { fontSize: 15, fontWeight: '700', color: '#a6dd8c', textDecorationLine: 'underline' },
  close: { width: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  pressed: { opacity: 0.6 },
});
