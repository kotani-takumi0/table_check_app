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
const LIQUID_GLASS = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
// 内容の上に浮かぶ操作の層（ツールバー・一覧・パネル）だけに使うガラスの面。卓カードには使わない。
// Liquid Glass が使えない iOS では、ほぼ不透明な面（92%）にする。「透明度を下げる」がオンなら不透明な面
export function Glass({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const reduce = useReduceTransparency();
  if (LIQUID_GLASS && !reduce) {
    return <GlassView glassEffectStyle="regular" tintColor="rgba(254, 253, 252, 0.8)" colorScheme="light" style={[styles.base, style]}>{children}</GlassView>;
  }
  return <View style={[styles.base, reduce ? styles.solid : styles.fallback, style]}>{children}</View>;
}
const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  fallback: { backgroundColor: 'rgba(254, 253, 252, 0.92)', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line },
  solid: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line },
});
