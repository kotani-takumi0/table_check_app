import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS, FILL } from './theme';

type Tone = 'default' | 'primary' | 'danger';
// パネル・シートのボタン（Web の .panel-button）
export function PanelButton({ label, onPress, tone = 'default', disabled, style, children }: {
  label?: string; onPress(): void; tone?: Tone; disabled?: boolean; style?: StyleProp<ViewStyle>; children?: ReactNode;
}) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, tone === 'primary' && styles.primary, tone === 'danger' && styles.danger, disabled && styles.disabled, pressed && styles.pressed, style]}>
      {children ?? <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.label, tone === 'primary' && styles.primaryLabel, tone === 'danger' && styles.dangerLabel]}>{label}</Text>}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  // iOS 26 のボタン：枠線を付けない淡い塗りのカプセル
  button: { minHeight: 50, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 25, backgroundColor: FILL, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: COLORS.action },
  danger: { backgroundColor: COLORS.nowBg },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
  label: { fontSize: 15, color: COLORS.text, textAlign: 'center' },
  primaryLabel: { color: COLORS.onAction },
  dangerLabel: { color: COLORS.nowText, fontWeight: '700' },
});
