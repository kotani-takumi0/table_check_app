import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEEDBACK_ERROR_MESSAGE, FEEDBACK_MAX, FEEDBACK_SENT_AT_KEY, FEEDBACK_SENT_MESSAGE, FEEDBACK_WAIT_MESSAGE, FeedbackRejected, feedbackCooldownMs, feedbackText, type FeedbackStore } from '@table-check/core/feedback';
import { version } from '../../../package.json';
import { feedback } from './feedback';

const APP_VERSION = `v${version}`;
const INK = '#16211b';
const INK2 = '#4b5a51';
const MUTED = '#627168';
const EDGE = '#bcc6c0';
const KEY = '#1b7a3e';
const PAGE = '#ffffff';
const NOW_INK = '#b3242a';

// ご意見を送る（お知らせのタブ。Web の FeedbackForm と同じ。No.125）。連続では送れない
export function FeedbackForm({ feedbackStore, shopName }: { feedbackStore: FeedbackStore; shopName: string }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(FEEDBACK_SENT_AT_KEY).then(raw => {
      if (!alive || raw === null) return;
      const at = Number(raw);
      if (Number.isFinite(at)) setSentAt(at);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (sentAt === null) return;
    const timer = setInterval(() => {
      const next = Date.now();
      setNowMs(next);
      if (feedbackCooldownMs(sentAt, next) === 0) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [sentAt]);
  const text = feedbackText(draft);
  const cooldown = feedbackCooldownMs(sentAt, nowMs);
  const rememberSent = () => {
    const at = Date.now();
    setSentAt(at);
    setNowMs(at);
    void AsyncStorage.setItem(FEEDBACK_SENT_AT_KEY, String(at)).catch(() => undefined);
  };
  const send = () => {
    if (text === null) return;
    if (feedbackCooldownMs(sentAt, Date.now()) > 0) { setResult({ ok: false, message: FEEDBACK_WAIT_MESSAGE }); return; }
    feedback.tap();
    setBusy(true);
    setResult(null);
    feedbackStore.send({ message: text, version: APP_VERSION, platform: 'ios', shopName }).then(sent => {
      feedback.done();
      setDraft('');
      rememberSent();
      setResult({ ok: true, message: FEEDBACK_SENT_MESSAGE[sent] });
    }, (error: unknown) => {
      console.error(error);
      feedback.warn();
      if (error instanceof FeedbackRejected) { rememberSent(); setResult({ ok: false, message: FEEDBACK_WAIT_MESSAGE }); return; }
      setResult({ ok: false, message: FEEDBACK_ERROR_MESSAGE });
    }).finally(() => setBusy(false));
  };
  return (
    <View style={styles.stack}>
      <Text style={styles.lead}>使いにくいところ・ほしい機能・おかしな動きなど、なんでも書いてください。作っている人に届きます。</Text>
      <View style={styles.panel}>
        <Text style={styles.label}>ご意見</Text>
        <TextInput accessibilityLabel="ご意見" style={styles.input} multiline maxLength={FEEDBACK_MAX} editable={!busy} textAlignVertical="top"
          placeholder="例：トイレチェックのボタンが押しにくい" placeholderTextColor={MUTED}
          value={draft} onChangeText={next => { setDraft(next); setResult(null); }} />
        <View style={styles.foot}>
          <Text style={styles.note}>
            {feedbackStore.delivers ? `アプリの版（${APP_VERSION}）${shopName ? `と店名（${shopName}）` : ''}も一緒に送ります。` : '試しなので、どこにも送られません。'}
          </Text>
          <Text style={styles.count} accessible={false}>{draft.length}/{FEEDBACK_MAX}</Text>
        </View>
        {result && <Text style={[styles.status, !result.ok && styles.error]} accessibilityRole={result.ok ? 'text' : 'alert'} accessibilityLiveRegion="polite">{result.message}</Text>}
        <Pressable accessibilityRole="button" disabled={busy || text === null || cooldown > 0} onPress={send}
          style={({ pressed }) => [styles.send, (busy || text === null || cooldown > 0) && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.sendLabel}>{busy ? '送っています…' : cooldown > 0 ? `あと${Math.ceil(cooldown / 1000)}秒` : '送る'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  stack: { gap: 12 },
  lead: { fontSize: 14, lineHeight: 22, color: INK2 },
  panel: { gap: 8, paddingVertical: 16, paddingHorizontal: 18, borderWidth: 1, borderColor: EDGE, borderRadius: 12, backgroundColor: PAGE },
  label: { fontSize: 14, fontWeight: '700', color: INK },
  input: { minHeight: 168, padding: 12, borderWidth: 1, borderColor: EDGE, borderRadius: 8, backgroundColor: PAGE, fontSize: 16, lineHeight: 24, color: INK },
  foot: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  note: { flex: 1, fontSize: 12, lineHeight: 20, color: MUTED },
  count: { fontSize: 12, color: MUTED, fontVariant: ['tabular-nums'] },
  status: { fontSize: 14, lineHeight: 22, color: INK },
  error: { fontWeight: '700', color: NOW_INK },
  send: { alignSelf: 'flex-end', minWidth: 120, height: 48, paddingHorizontal: 20, borderRadius: 8, backgroundColor: KEY, alignItems: 'center', justifyContent: 'center' },
  sendLabel: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
