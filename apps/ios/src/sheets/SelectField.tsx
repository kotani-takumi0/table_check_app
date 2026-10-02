import { useRef } from 'react';
import { ActionSheetIOS, findNodeHandle, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../theme';
import { feedback } from '../feedback';

export interface SelectOption<T> { value: T; label: string }
// ドロップダウン（Web の <select> と同じ役目。No.71）：押すと iOS の選択リスト（アクションシート）を出し、選んだものだけを欄に見せる。
// iPad ではこの欄から吹き出しで出す（anchor）
export function SelectField<T>({ label, value, options, onChange }: { label: string; value: T; options: SelectOption<T>[]; onChange(value: T): void }) {
  const ref = useRef<View>(null);
  const current = options.find(option => option.value === value)?.label ?? '';
  const open = () => {
    feedback.tap();
    const anchor = ref.current ? findNodeHandle(ref.current) ?? undefined : undefined;
    ActionSheetIOS.showActionSheetWithOptions({ title: label, options: [...options.map(option => option.label), 'キャンセル'], cancelButtonIndex: options.length, anchor },
      index => { if (index < options.length) onChange(options[index].value); });
  };
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Pressable ref={ref} accessibilityRole="button" accessibilityLabel={`${label} ${current}（押すと選べます）`} onPress={open}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}>
        <Text style={styles.value} numberOfLines={1}>{current}</Text>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={COLORS.muted} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
          <Path d="M6 9l6 6 6-6" />
        </Svg>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  label: { width: 56, fontSize: 15, fontWeight: '700', color: COLORS.text },
  field: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.lineStrong, borderRadius: 12, backgroundColor: COLORS.bg },
  value: { flex: 1, fontSize: 16, color: COLORS.text },
  pressed: { opacity: 0.6 },
});
