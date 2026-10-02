import Svg, { Circle, Ellipse, Line } from 'react-native-svg';
import { cactusClock } from '@table-check/core/cactusClock';

// 時刻の横に置くサボテンの時計の印（Web の CactusClock と同じ）：茎色の楕円に10個のクリーム色の点と、いまの時刻を指す針2本
export function CactusClock({ time, size = 22 }: { time: number; size?: number }) {
  const { dots, hour, minute } = cactusClock(time);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Ellipse cx={12} cy={12} rx={10} ry={11} fill="#305a12" />
      {dots.map((dot, i) => <Circle key={i} cx={dot.x} cy={dot.y} r={1} fill="#fdefd2" />)}
      <Line x1={12} y1={12} x2={hour.x} y2={hour.y} stroke="#fdefd2" strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={12} y1={12} x2={minute.x} y2={minute.y} stroke="#fdefd2" strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}
