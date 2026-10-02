import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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
// 出てくるときの進み（0→1）。Web の animation と同じ長さ・曲線（既定は ease-out）。「視差効果を減らす」がオンなら最初から 1
export function useAppear(durationMs: number, easing: (t: number) => number = Easing.out(Easing.ease)): Animated.Value {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (!active) return;
      if (reduce) progress.setValue(1);
      else Animated.timing(progress, { toValue: 1, duration: durationMs, easing, useNativeDriver: true }).start();
    });
    return () => { active = false; };
  }, [progress, durationMs, easing]);
  return progress;
}
const EASE_OUT = Easing.out(Easing.ease);
// Liquid Glass は iOS 26 以降（ベータの一部は API が無く落ちるので、実行時にも確かめる）
export const LIQUID_GLASS = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
// 内容の上に浮かぶ操作の層（ツールバー・一覧・ポップオーバー・通知）だけに使うガラスの面。卓カードには使わない。
// iOS 26 は本物の Liquid Glass（regular）。文字の少ないツールバーは色付けせずガラスに任せる。
// 文字の多い面（ポップオーバー・通知・一覧）は、読みやすいよう tint（地の白の濃さ 0〜1）を付けて濃くする（Web と同じ濃さ）。
// interactive にすると、触ったときにガラスが反応する（押せるまとまりに使う）。
// appear（秒）を付けると、ガラスの面を 'none' からその長さで出す。ガラスは自分や親の opacity を 0 にすると描かれないので、
// 出てくる動きは opacity ではなくこれで付ける（中身の opacity は呼ぶ側で動かす）。
// Liquid Glass が使えない iOS では、Web と同じすりガラス風の面（ほぼ不透明＋白い縁＋柔らかい影）。「透明度を下げる」がオンなら不透明な面
export function Glass({ style, interactive = false, tint, appear, children }: { style?: StyleProp<ViewStyle>; interactive?: boolean; tint?: number; appear?: number; children?: ReactNode }) {
  const reduce = useReduceTransparency();
  // 最初の描画は 'none'、次のフレームで regular にして、ガラスが出てくる動きにする
  const [shown, setShown] = useState(appear === undefined);
  useEffect(() => {
    if (appear === undefined) return;
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [appear]);
  const fallbackIn = useAppear(appear === undefined ? 0 : appear * 1000, EASE_OUT);
  if (LIQUID_GLASS && !reduce) {
    return <GlassView glassEffectStyle={!shown ? 'none' : appear === undefined ? 'regular' : { style: 'regular', animate: true, animationDuration: appear }} isInteractive={interactive} tintColor={tint === undefined ? undefined : `rgba(254, 253, 252, ${tint})`} colorScheme="light" style={[styles.base, style]}>{children}</GlassView>;
  }
  return <Animated.View style={[styles.base, reduce ? styles.solid : styles.fallback, style, appear !== undefined && { opacity: fallbackIn }]}>{children}</Animated.View>;
}
const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  fallback: {
    backgroundColor: 'rgba(254, 253, 252, 0.9)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.9)',
    boxShadow: '0 8px 28px rgba(45, 43, 40, 0.1), 0 2px 6px rgba(45, 43, 40, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
  },
  solid: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line },
});
