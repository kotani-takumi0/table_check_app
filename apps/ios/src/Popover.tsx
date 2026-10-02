import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass } from './Glass';
import { TOOLBAR_HEIGHT } from './Header';

// iOS 26 のアラート・ポップオーバー：押したボタンのそば（ツールバーの下）から出す。後ろは暗くせず、外側を押すと閉じる。
// anchor は出す側（start＝左のトイレ、end＝右の消去）。「視差効果を減らす」がオンなら膨らむ動きをやめる。
// ガラス（GlassView）は自分や親の opacity を 0 にすると描かれなくなるので、出すときは opacity を動かさず大きさだけ動かす
export function Popover({ anchor, mini, onClose, children }: { anchor: 'start' | 'end'; mini: boolean; onClose(): void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (!active) return;
      if (reduce) grow.setValue(1);
      else Animated.spring(grow, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 6 }).start();
    });
    return () => { active = false; };
  }, [grow]);
  const side = mini ? 8 : 16;
  const top = insets.top + 4 + (mini ? TOOLBAR_HEIGHT.mini : TOOLBAR_HEIGHT.regular) + 8;
  const place = anchor === 'end' ? { right: side + insets.right } : { left: side + insets.left + (mini ? 0 : 56) };
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable accessibilityLabel="閉じる" style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View accessibilityViewIsModal style={[styles.wrap, place, { top, width: Math.min(380, width - side * 2) },
        { transformOrigin: anchor === 'end' ? 'top right' : 'top left', transform: [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
        <Glass tint={0.84} style={styles.card}>{children}</Glass>
      </Animated.View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  card: { padding: 24, gap: 12, borderRadius: 36 },
});
