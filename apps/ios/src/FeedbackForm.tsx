import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FEEDBACK_ERROR_MESSAGE, FEEDBACK_MAX, FEEDBACK_SENT_MESSAGE, feedbackText, type FeedbackStore } from '@table-check/core/feedback';
import { version } from '../../../package.json';
import { COLORS, TABULAR } from './theme';
import { Glass } from './Glass';
import { feedback } from './feedback';
import { PanelButton } from './ui';

const APP_VERSION = `v${version}`;
// ご意見を送る画面（Web の FeedbackForm と同じ。No.125）。書いた文と、版・店名を一緒に送る
export function FeedbackForm({ feedbackStore, shopName, top }: { feedbackStore: FeedbackStore; shopName: string; top: number }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const text = feedbackText(draft);
  const send = () => {
    if (text === null) return;
    feedback.tap();
    setBusy(true);
    setResult(null);
    feedbackStore.send({ message: text, version: APP_VERSION, platform: 'ios', shopName }).then(sent => {
      feedback.done();
      setDraft('');
      setResult({ ok: true, message: FEEDBACK_SENT_MESSAGE[sent] });
    }, (error: unknown) => {
      console.error(error);
      feedback.warn();
      setResult({ ok: false, message: FEEDBACK_ERROR_MESSAGE });
    }).finally(() => setBusy(false));
  };
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: top }]} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">ご意見を送る</Text>
      <Text style={styles.help}>使いにくいところ・ほしい機能・おかしな動きなど、なんでも書いてください。作っている人に届きます。</Text>
      <Glass tint={0.84} style={styles.group}>
        <Text style={styles.groupTitle}>ご意見</Text>
        <TextInput accessibilityLabel="ご意見" style={styles.input} multiline maxLength={FEEDBACK_MAX} editable={!busy} textAlignVertical="top"
          placeholder="例：トイレチェックのボタンが押しにくい" placeholderTextColor={COLORS.muted}
          value={draft} onChangeText={next => { setDraft(next); setResult(null); }} />
        <View style={styles.foot}>
          <Text style={[styles.help, styles.note]}>
            {feedbackStore.delivers ? `アプリの版（${APP_VERSION}）${shopName ? `と店名（${shopName}）` : ''}も一緒に送ります。` : '試しなので、どこにも送られません。'}
          </Text>
          <Text style={styles.count} accessible={false}>{draft.length}/{FEEDBACK_MAX}</Text>
        </View>
        {result && <Text style={[styles.help, !result.ok && styles.error]} accessibilityRole={result.ok ? 'text' : 'alert'} accessibilityLiveRegion="polite">{result.message}</Text>}
        <PanelButton label={busy ? '送っています…' : '送る'} tone="primary" disabled={busy || text === null} onPress={send} style={styles.send} />
      </Glass>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { alignSelf: 'center', width: '100%', maxWidth: 640, gap: 12, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  group: { gap: 8, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 20 },
  groupTitle: { fontSize: 14, fontWeight: '700', color: COLORS.muted },
  input: { minHeight: 168, padding: 12, borderWidth: 1, borderColor: COLORS.lineStrong, borderRadius: 12, backgroundColor: COLORS.bg, fontSize: 16, lineHeight: 24, color: COLORS.text },
  foot: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  note: { flex: 1, marginTop: 0 },
  help: { fontSize: 13, lineHeight: 19, color: COLORS.muted },
  count: { fontSize: 13, color: COLORS.muted, ...TABULAR },
  error: { fontWeight: '700', color: COLORS.nowText },
  send: { alignSelf: 'flex-end', minWidth: 120, minHeight: 48 },
});
