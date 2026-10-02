import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { COLORS } from './theme';
import { Glass, useAppear } from './Glass';
import { feedback } from './feedback';

export type Screen = 'floor' | 'settings' | 'layout';
export const SCREEN_LABEL: Record<Screen, string> = { floor: 'テーブル状況', settings: '設定', layout: '席の配置' };
// 席の配置は設定の中から開く（メニューには出さず、開いている間は「設定」を選んでいる印にする）
const SCREENS: Screen[] = ['floor', 'settings'];
const EASE_OUT = Easing.out(Easing.ease);
// メニュー（Web の SideMenu と同じ）：ツールバー左の「メニュー」で左から出す。選ぶとその画面に切り替えて閉じる（No.77。全卓一覧はなくした）
export function SideMenu({ screen, onSelect, mini }: { screen: Screen; onSelect(screen: Screen): void; mini: boolean }) {
  // 左から 24px すべり込みながら 0.18 秒で出す（ガラスの面は Glass の appear、中身は opacity）
  const appear = useAppear(180, EASE_OUT);
  return (
    <Animated.View style={[styles.menu, mini && styles.miniMenu, { transform: [{ translateX: appear.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] }]}>
      <Glass tint={0.84} appear={0.18} style={styles.glass}>
        <Animated.View style={[styles.items, { opacity: appear }]} accessibilityRole="menu">
          {SCREENS.map(item => {
            const current = item === screen || (item === 'settings' && screen === 'layout');
            return (
              <Pressable key={item} accessibilityRole="menuitem" accessibilityState={{ selected: current }} onPress={() => { feedback.tap(); onSelect(item); }}
                style={({ pressed }) => [styles.item, current && styles.current, pressed && styles.pressed]}>
                <MenuIcon screen={item} color={current ? COLORS.actionText : COLORS.text} />
                <Text style={[styles.label, current && styles.currentLabel]}>{SCREEN_LABEL[item]}</Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </Glass>
    </Animated.View>
  );
}
function MenuIcon({ screen, color }: { screen: Screen; color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
      {screen === 'floor'
        ? <><Rect x={3.5} y={4} width={7} height={7} rx={2} /><Rect x={13.5} y={4} width={7} height={7} rx={2} /><Rect x={3.5} y={14} width={7} height={6} rx={2} /><Circle cx={17} cy={17} r={3} /></>
        : <><Circle cx={12} cy={12} r={3} /><Path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>}
    </Svg>
  );
}
const styles = StyleSheet.create({
  menu: { width: 280 },
  miniMenu: { width: '100%' },
  glass: { borderRadius: 20 },
  items: { padding: 8, gap: 4 },
  item: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderRadius: 14 },
  current: { backgroundColor: COLORS.actionBg },
  pressed: { opacity: 0.6 },
  label: { fontSize: 16, fontWeight: '500', color: COLORS.text },
  currentLabel: { color: COLORS.actionText, fontWeight: '700' },
});
