import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { RELEASE_NOTES, releaseDateLabel, releaseNoteOf, SEEN_RELEASE_KEY, shouldAnnounce } from '@table-check/core/releaseNotes';
import { version } from '../../../package.json';
import { feedback } from './feedback';
import { Glass } from './Glass';
import { COLORS } from './theme';

const APP_VERSION = `v${version}`;

// 最近の更新（お知らせのタブ。Web の ReleaseNotes と同じ。No.127）
export function ReleaseNotes() {
  return (
    <View style={styles.stack}>
      <Text style={styles.lead}>版ごとに、新しくなったところをまとめています。いまの版は {APP_VERSION} です。</Text>
      {RELEASE_NOTES.map(note => (
        <Glass key={note.version} tint={0.84} style={styles.panel}>
          <View style={styles.head}>
            <Text style={styles.version} accessibilityRole="header">v{note.version}</Text>
            {`v${note.version}` === APP_VERSION && <Text style={styles.current}>いまの版</Text>}
            <Text style={styles.date}>{releaseDateLabel(note.date)}</Text>
          </View>
          {note.items.map((item, index) => <Text key={item} style={[styles.item, index > 0 && styles.itemLine]}>{item}</Text>)}
        </Glass>
      ))}
    </View>
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
  stack: { gap: 20 },
  lead: { fontSize: 14, lineHeight: 22, color: COLORS.muted },
  panel: { borderRadius: 20, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line, backgroundColor: COLORS.surface },
  version: { fontSize: 17, fontWeight: '700', lineHeight: 26, color: COLORS.text },
  current: { paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.action, borderRadius: 8, backgroundColor: COLORS.actionBg, color: COLORS.actionText, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  date: { marginLeft: 'auto', fontSize: 12, fontWeight: '500', color: COLORS.muted, fontVariant: ['tabular-nums'] },
  item: { paddingVertical: 16, paddingHorizontal: 18, fontSize: 14, lineHeight: 22, color: COLORS.text, backgroundColor: COLORS.surface },
  itemLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line },
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 24, alignItems: 'center' },
  bar: { maxWidth: 560, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 18, paddingRight: 6, paddingVertical: 6, borderRadius: 14, backgroundColor: COLORS.text },
  message: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: '#ffffff', paddingRight: 4 },
  button: { minHeight: 40, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center' },
  buttonLabel: { fontSize: 15, fontWeight: '700', color: '#a6dd8c', textDecorationLine: 'underline' },
  close: { width: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  pressed: { opacity: 0.6 },
});
