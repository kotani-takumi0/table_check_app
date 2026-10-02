import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS } from './theme';

type Tone = 'default' | 'primary' | 'danger';
// パネル・シートのボタン（Web の .panel-button）
export function PanelButton({ label, onPress, tone = 'default', disabled, style, children }: {
  label?: string; onPress(): void; tone?: Tone; disabled?: boolean; style?: StyleProp<ViewStyle>; children?: ReactNode;
}) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, tone === 'primary' && styles.primary, tone === 'danger' && styles.danger, disabled && styles.disabled, pressed && styles.pressed, style]}>
      {children ?? <Text style={[styles.label, tone === 'primary' && styles.primaryLabel, tone === 'danger' && styles.dangerLabel]}>{label}</Text>}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: { minHeight: 50, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.line, borderRadius: 6, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  primary: { borderColor: COLORS.action, backgroundColor: COLORS.action },
  danger: { borderColor: COLORS.now, backgroundColor: COLORS.nowBg },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
  label: { fontSize: 15, color: COLORS.text, textAlign: 'center' },
  primaryLabel: { color: COLORS.onAction },
  dangerLabel: { color: COLORS.nowText, fontWeight: '700' },
});
