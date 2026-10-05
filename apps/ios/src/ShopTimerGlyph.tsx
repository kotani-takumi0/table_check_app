import Svg, { Path } from 'react-native-svg';
import { shopTimerIcon } from '@table-check/core/shopTimerIcons';

// 店のタイマーの線のアイコン（Web の ShopTimerGlyph と同じ。No.99）。読み上げは名前で行うので隠す
export function ShopTimerGlyph({ icon, size, color }: { icon: string; size: number; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
    {shopTimerIcon(icon).paths.map(d => <Path key={d} d={d} />)}
  </Svg>;
}
