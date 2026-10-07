import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from './theme';
import { feedback } from './feedback';

// 画面の下に数秒だけ出す「〜しました［元に戻す］」（Web の UndoBar と同じ。No.102・No.121）。
// 戻せなかったとき（ほかの端末で変わった）は、ボタンを出さずに理由だけを出す
export function UndoBar({ message, onUndo }: { message: string; onUndo?(): void }) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar} accessibilityRole="alert">
        <Text style={styles.message} numberOfLines={2}>{message}</Text>
        {onUndo && <Pressable accessibilityRole="button" onPress={() => { feedback.tap(); onUndo(); }} hitSlop={6} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonLabel}>元に戻す</Text>
        </Pressable>}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 24, alignItems: 'center' },
  bar: { maxWidth: 560, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 18, paddingRight: 6, paddingVertical: 6, borderRadius: 14, backgroundColor: COLORS.text },
  message: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: '#ffffff', paddingRight: 12 },
  button: { minHeight: 40, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center' },
  buttonLabel: { fontSize: 15, fontWeight: '700', color: '#a6dd8c', textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
});
