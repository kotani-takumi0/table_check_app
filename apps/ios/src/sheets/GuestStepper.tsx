import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GUESTS_MAX } from '@table-check/core/domain';
import { COLORS } from '../theme';
import { feedback } from '../feedback';

// 人数の −／＋。null は未入力
export function GuestStepper({ value, onChange, children }: { value: number | null; onChange(guests: number): void; children?: ReactNode }) {
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel="1名減らす" disabled={value === null || value <= 1}
        onPress={() => { feedback.step(); onChange((value ?? 1) - 1); }} style={({ pressed }) => [styles.step, (value === null || value <= 1) && styles.disabled, pressed && styles.pressed]}>
        <Text style={styles.stepLabel}>−</Text>
      </Pressable>
      <Text style={[styles.value, value === null && styles.muted]} accessibilityLiveRegion="polite">{value === null ? '未入力' : `${value}名`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="1名増やす" disabled={value !== null && value >= GUESTS_MAX}
        onPress={() => { feedback.step(); onChange((value ?? 0) + 1); }} style={({ pressed }) => [styles.step, value !== null && value >= GUESTS_MAX && styles.disabled, pressed && styles.pressed]}>
        <Text style={styles.stepLabel}>＋</Text>
      </Pressable>
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  step: { minWidth: 50, minHeight: 50, borderWidth: 1, borderColor: COLORS.line, borderRadius: 6, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 22, color: COLORS.text },
  value: { minWidth: 64, textAlign: 'center', fontSize: 18, fontWeight: '700', color: COLORS.text },
  muted: { color: COLORS.muted },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
