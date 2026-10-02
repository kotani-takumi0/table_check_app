import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, FILL } from './theme';
import { Glass } from './Glass';

export interface Toast {
  key: string;
  message: string;
  tone: 'warning' | 'danger';
  action: { label: string; onPress(): void };
}
// 閉じるまで残す通知（Web の Toasts と同じ出し方）。入る行数（rows）を超えたら先頭だけ出して残りをまとめる。
// iOS 26 の通知バナーのように、フロアの上に浮かぶガラスのカプセルにし、急ぎ具合は左の丸の色と文言で出す
export function Toasts({ toasts, onDismiss, rows, mini }: { toasts: Toast[]; onDismiss(key: string): void; rows: 1 | 2; mini: boolean }) {
  if (toasts.length === 0) return null;
  const shown = toasts.length > rows ? toasts.slice(0, 1) : toasts;
  const rest = toasts.slice(shown.length);
  const restDot = DOT[rest.some(t => t.tone === 'danger') ? 'danger' : 'warning'];
  return <>
    {shown.map(toast => {
      return (
        <Glass key={toast.key} tint={0.82} style={[styles.toast, { flex: 1 / rows }, mini && styles.miniToast]}>
          <View accessibilityRole="alert" style={styles.inner}>
          <View style={[styles.dot, { backgroundColor: DOT[toast.tone] }]} />
          <Text style={[styles.message, mini && styles.miniMessage]} numberOfLines={mini ? 1 : 2}>
            {toast.message}{rows === 1 && rest.length > 0 && <Text style={styles.more}>  ほか {rest.length}件</Text>}
          </Text>
          <Pressable accessibilityRole="button" onPress={toast.action.onPress} style={({ pressed }) => [styles.button, styles.primary, mini && styles.miniButton, pressed && styles.pressed]}>
            <Text style={[styles.buttonLabel, styles.primaryLabel, mini && styles.miniLabel]}>{toast.action.label}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onDismiss(toast.key)} style={({ pressed }) => [styles.button, mini && styles.miniButton, pressed && styles.pressed]}>
            <Text style={[styles.buttonLabel, mini && styles.miniLabel]}>閉じる</Text>
          </Pressable>
          </View>
        </Glass>
      );
    })}
    {rows === 2 && rest.length > 0 && (
      <Glass tint={0.82} style={[styles.toast, { flex: 1 / rows }]}>
        <View style={styles.inner}>
          <View style={[styles.dot, { backgroundColor: restDot }]} />
          <Text style={styles.message} numberOfLines={1}>ほか {rest.length}件：{rest.map(t => t.message).join('／')}</Text>
        </View>
      </Glass>
    )}
  </>;
}
// 急ぎ具合の丸：いま対応＝朱、もうすぐ＝琥珀
const DOT = { danger: COLORS.now, warning: COLORS.soon } as const;
const styles = StyleSheet.create({
  toast: { borderRadius: 999, justifyContent: 'center' },
  inner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 5 },
  miniToast: {},
  dot: { width: 12, height: 12, borderRadius: 6 },
  message: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.text },
  miniMessage: { fontSize: 12 },
  more: { fontSize: 12, fontWeight: '500' },
  button: { minHeight: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: FILL, justifyContent: 'center' },
  miniButton: { minHeight: 30, paddingHorizontal: 10, borderRadius: 15 },
  primary: { backgroundColor: COLORS.action },
  buttonLabel: { fontSize: 14, color: COLORS.text },
  primaryLabel: { color: COLORS.onAction },
  miniLabel: { fontSize: 12 },
  pressed: { opacity: 0.6 },
});
