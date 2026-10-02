import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
// シート・ポップオーバーの右上の × ボタン（Web の CloseButton と同じ）。押すと閉じる
export function CloseButton({ onPress }: { onPress(): void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="閉じる" onPress={onPress} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={COLORS.text} strokeWidth={2.2} strokeLinecap="round" accessible={false}>
        <Path d="M6 6l12 12M18 6L6 18" />
      </Svg>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  // iOS 26 のボタン：枠線を付けない淡い塗りのカプセル
  button: { minHeight: 50, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 25, backgroundColor: FILL, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: COLORS.action },
  danger: { backgroundColor: COLORS.nowBg },
  close: { position: 'absolute', zIndex: 1, top: 14, right: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: FILL, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
  label: { fontSize: 15, color: COLORS.text, textAlign: 'center' },
  primaryLabel: { color: COLORS.onAction },
  dangerLabel: { color: COLORS.nowText, fontWeight: '700' },
});
