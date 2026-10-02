import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { COLORS } from './theme';

// 端末の「透明度を下げる」
export function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(value => { if (active) setReduce(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduce;
}
// Liquid Glass は iOS 26 以降（ベータの一部は API が無く落ちるので、実行時にも確かめる）
export const LIQUID_GLASS = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
// 内容の上に浮かぶ操作の層（ツールバー・一覧・ポップオーバー・通知）だけに使うガラスの面。卓カードには使わない。
// iOS 26 は本物の Liquid Glass（regular）。色付けはせず、後ろの色と明るさはガラスに任せる（色は主な操作のボタンだけ）。
// interactive にすると、触ったときにガラスが反応する（押せるまとまりに使う）。
// Liquid Glass が使えない iOS では、Web と同じすりガラス風の面（ほぼ不透明＋白い縁＋柔らかい影）。「透明度を下げる」がオンなら不透明な面
export function Glass({ style, interactive = false, children }: { style?: StyleProp<ViewStyle>; interactive?: boolean; children?: ReactNode }) {
  const reduce = useReduceTransparency();
  if (LIQUID_GLASS && !reduce) {
    return <GlassView glassEffectStyle="regular" isInteractive={interactive} colorScheme="light" style={[styles.base, style]}>{children}</GlassView>;
  }
  return <View style={[styles.base, reduce ? styles.solid : styles.fallback, style]}>{children}</View>;
}
const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  fallback: {
    backgroundColor: 'rgba(254, 253, 252, 0.9)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.9)',
    boxShadow: '0 8px 28px rgba(45, 43, 40, 0.1), 0 2px 6px rgba(45, 43, 40, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
  },
  solid: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line },
});
