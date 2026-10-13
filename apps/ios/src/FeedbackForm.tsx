import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEEDBACK_ERROR_MESSAGE, FEEDBACK_MAX, FEEDBACK_SENT_AT_KEY, FEEDBACK_SENT_MESSAGE, FEEDBACK_UNCONFIRMED_MESSAGE, FEEDBACK_WAIT_MESSAGE, FeedbackRejected, feedbackAccepted, feedbackCooldownMs, feedbackText, type FeedbackStore } from '@table-check/core/feedback';
import { version } from '../../../package.json';
import { feedback } from './feedback';
import { Glass } from './Glass';
import { COLORS } from './theme';

const APP_VERSION = `v${version}`;
// メニューで別の画面に移るとこの部品は外れる。下書きはここに残し、戻したときに出す
let keptDraft = '';

// ご意見を送る（お知らせのタブ。Web の FeedbackForm と同じ。No.125）。連続では送れない
export function FeedbackForm({ feedbackStore, shopName }: { feedbackStore: FeedbackStore; shopName: string }) {
  const [draft, setDraft] = useState(keptDraft);
  const updateDraft = (next: string) => { keptDraft = next; setDraft(next); };
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'ok' | 'pending' | 'error'; message: string } | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
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
    void AsyncStorage.setItem(FEEDBACK_SENT_AT_KEY, String(at)).catch(() => undefined);
    if (!alive.current) return;
    setSentAt(at);
    setNowMs(at);
  };
  const accept = (sentText: string) => {
    if (feedbackText(keptDraft) === sentText) { keptDraft = ''; if (alive.current) setDraft(''); }
    rememberSent();
    feedback.done();
    if (alive.current) setResult({ tone: 'ok', message: FEEDBACK_SENT_MESSAGE });
  };
  const fail = (error: unknown) => {
    console.error(error);
    feedback.warn();
    if (!alive.current) return;
    if (error instanceof FeedbackRejected) { rememberSent(); setResult({ tone: 'error', message: FEEDBACK_WAIT_MESSAGE }); return; }
    setResult({ tone: 'error', message: FEEDBACK_ERROR_MESSAGE });
  };
  const send = () => {
    if (text === null) return;
    if (feedbackCooldownMs(sentAt, Date.now()) > 0) { setResult({ tone: 'error', message: FEEDBACK_WAIT_MESSAGE }); return; }
    const sentText = text;
    feedback.tap();
    setBusy(true);
    setResult(null);
    feedbackStore.send({ message: sentText, version: APP_VERSION, platform: 'ios', shopName }).then(ack => {
      if (feedbackAccepted(ack.delivery)) accept(sentText);
      else {
        feedback.warn();
        if (alive.current) setResult({ tone: 'pending', message: FEEDBACK_UNCONFIRMED_MESSAGE });
        void ack.confirmed.then(() => accept(sentText), fail);
      }
    }, fail).finally(() => { if (alive.current) setBusy(false); });
  };
  return (
    <View style={styles.stack}>
      <Text style={styles.lead}>使いにくいところ・ほしい機能・おかしな動きなど、なんでも書いてください。作っている人に届きます。</Text>
      <Glass tint={0.84} style={styles.panel}>
        <Text style={styles.label}>ご意見</Text>
        <TextInput accessibilityLabel="ご意見" style={styles.input} multiline maxLength={FEEDBACK_MAX} editable={!busy} textAlignVertical="top"
          placeholder="例：トイレチェックのボタンが押しにくい" placeholderTextColor={COLORS.muted}
          value={draft} onChangeText={next => { updateDraft(next); setResult(null); }} />
        <View style={styles.foot}>
          <Text style={styles.note}>
            {feedbackStore.delivers ? `アプリの版（${APP_VERSION}）${shopName ? `と店名（${shopName}）` : ''}も一緒に送ります。` : '試しなので、どこにも送られません。'}
          </Text>
          <Text style={styles.count} accessible={false}>{draft.length}/{FEEDBACK_MAX}</Text>
        </View>
        {result && <Text style={[styles.status, result.tone === 'pending' && styles.pending, result.tone === 'error' && styles.error]} accessibilityRole={result.tone === 'error' ? 'alert' : 'text'} accessibilityLiveRegion="polite">{result.message}</Text>}
        <Pressable accessibilityRole="button" disabled={busy || text === null || cooldown > 0} onPress={send}
          style={({ pressed }) => [styles.send, (busy || text === null || cooldown > 0) && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.sendLabel}>{busy ? '送っています…' : cooldown > 0 ? `あと${Math.ceil(cooldown / 1000)}秒` : '送る'}</Text>
        </Pressable>
      </Glass>
    </View>
  );
}
const styles = StyleSheet.create({
  stack: { gap: 12 },
  lead: { fontSize: 14, lineHeight: 22, color: COLORS.muted },
  panel: { gap: 8, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 20 },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  input: { minHeight: 168, padding: 12, borderWidth: 1, borderColor: COLORS.lineStrong, borderRadius: 12, backgroundColor: COLORS.surface, fontSize: 16, lineHeight: 24, color: COLORS.text },
  foot: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  note: { flex: 1, fontSize: 12, lineHeight: 20, color: COLORS.muted },
  count: { fontSize: 12, color: COLORS.muted, fontVariant: ['tabular-nums'] },
  status: { fontSize: 14, lineHeight: 22, color: COLORS.text, backgroundColor: COLORS.surface, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
  pending: { fontWeight: '700', color: COLORS.soonText },
  error: { fontWeight: '700', color: COLORS.nowText },
  send: { alignSelf: 'flex-end', minWidth: 120, height: 48, paddingHorizontal: 20, borderRadius: 12, backgroundColor: COLORS.action, alignItems: 'center', justifyContent: 'center' },
  sendLabel: { fontSize: 14, fontWeight: '700', color: COLORS.onAction },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
