import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, TONES } from './theme';

export interface Toast {
  key: string;
  message: string;
  tone: 'warning' | 'danger';
  action: { label: string; onPress(): void };
}
// 閉じるまで残す通知（Web の Toasts と同じ出し方）。入る行数（rows）を超えたら先頭だけ出して残りをまとめる
export function Toasts({ toasts, onDismiss, rows, mini }: { toasts: Toast[]; onDismiss(key: string): void; rows: 1 | 2; mini: boolean }) {
  if (toasts.length === 0) return null;
  const shown = toasts.length > rows ? toasts.slice(0, 1) : toasts;
  const rest = toasts.slice(shown.length);
  const restTone = TONES[rest.some(t => t.tone === 'danger') ? 'danger' : 'warning'];
  return <>
    {shown.map(toast => {
      const tone = TONES[toast.tone];
      return (
        <View key={toast.key} accessibilityRole="alert" style={[styles.toast, { flex: 1 / rows, borderColor: tone.line, backgroundColor: tone.bg }, mini && styles.miniToast]}>
          <Text style={[styles.message, { color: tone.text }, mini && styles.miniMessage]} numberOfLines={mini ? 1 : 2}>
            {toast.message}{rows === 1 && rest.length > 0 && <Text style={styles.more}>  ほか {rest.length}件</Text>}
          </Text>
          <Pressable accessibilityRole="button" onPress={toast.action.onPress} style={({ pressed }) => [styles.button, styles.primary, mini && styles.miniButton, pressed && styles.pressed]}>
            <Text style={[styles.buttonLabel, styles.primaryLabel, mini && styles.miniLabel]}>{toast.action.label}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onDismiss(toast.key)} style={({ pressed }) => [styles.button, mini && styles.miniButton, pressed && styles.pressed]}>
            <Text style={[styles.buttonLabel, mini && styles.miniLabel]}>閉じる</Text>
          </Pressable>
        </View>
      );
    })}
    {rows === 2 && rest.length > 0 && (
      <View style={[styles.toast, { flex: 1 / rows, borderColor: restTone.line, backgroundColor: restTone.bg }]}>
        <Text style={[styles.message, { color: restTone.text }]} numberOfLines={1}>ほか {rest.length}件：{rest.map(t => t.message).join('／')}</Text>
      </View>
    )}
  </>;
}
const styles = StyleSheet.create({
  toast: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 3, borderWidth: 1.5, borderRadius: 8 },
  miniToast: { paddingLeft: 8, gap: 4 },
  message: { flex: 1, fontSize: 15, fontWeight: '700' },
  miniMessage: { fontSize: 12 },
  more: { fontSize: 12, fontWeight: '500' },
  button: { minHeight: 36, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.line, borderRadius: 6, backgroundColor: COLORS.surface, justifyContent: 'center' },
  miniButton: { minHeight: 30, paddingHorizontal: 8 },
  primary: { borderColor: COLORS.action, backgroundColor: COLORS.action },
  buttonLabel: { fontSize: 14, color: COLORS.text },
  primaryLabel: { color: COLORS.onAction },
  miniLabel: { fontSize: 12 },
  pressed: { opacity: 0.6 },
});
