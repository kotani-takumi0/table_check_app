import type { ReactNode } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, type ModalProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass, useAppear } from './Glass';
import { TOOLBAR_HEIGHT } from './Header';

// iOS 26 のアラート・ポップオーバー：押したボタンのそば（ツールバーの下）から出す。後ろは暗くせず、外側を押すと閉じる。
// anchor は出す側（start＝左のトイレ、end＝右の消去）。「視差効果を減らす」がオンなら膨らむ動きをやめる。
// ガラス（GlassView）は自分や親の opacity を 0 にすると描かれなくなるので、ガラスの面は Glass の appear で出し、中身だけ opacity を動かす
export function Popover({ anchor, mini, onClose, children }: { anchor: 'start' | 'end'; mini: boolean; onClose(): void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Web の .popover と同じ 0.2 秒・少し行き過ぎて戻る曲線
  const grow = useAppear(200, POP);
  const side = mini ? 8 : 16;
  const top = insets.top + 4 + (mini ? TOOLBAR_HEIGHT.mini : TOOLBAR_HEIGHT.regular) + 8;
  const place = anchor === 'end' ? { right: side + insets.right } : { left: side + insets.left + (mini ? 0 : 56) };
  return (
    <Modal visible transparent animationType="none" supportedOrientations={ORIENTATIONS} onRequestClose={onClose}>
      <Pressable accessibilityLabel="閉じる" style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View accessibilityViewIsModal style={[styles.wrap, place, { top, width: Math.min(380, width - side * 2), maxHeight: height - top - insets.bottom - side },
        { transformOrigin: anchor === 'end' ? 'top right' : 'top left', transform: [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
        <Glass tint={0.84} appear={0.2} style={styles.card}>
          {/* 文字を大きくしていてもボタンまで届くよう、画面に入らなければ中をスクロールする */}
          <ScrollView bounces={false}>
            <Animated.View style={[styles.content, { opacity: grow }]}>{children}</Animated.View>
          </ScrollView>
        </Glass>
      </Animated.View>
    </Modal>
  );
}
// 透明な Modal は既定で縦向きだけになるので、iPad・iPhone の横向きのまま出す
const ORIENTATIONS: ModalProps['supportedOrientations'] = ['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right'];
const POP = Easing.bezier(0.2, 0.9, 0.3, 1.2);
const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  card: { flexShrink: 1, borderRadius: 36 },
  content: { padding: 24, gap: 12 },
});
