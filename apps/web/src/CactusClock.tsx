import { cactusClock } from '@table-check/core/cactusClock';

// 時刻の横に置くサボテンの時計の印（アイコンの茎の時計）：茎色の楕円に10個のクリーム色の点と、いまの時刻を指す針2本
export function CactusClock({ time }: { time: number }) {
  const { dots, hour, minute } = cactusClock(time);
  return <svg className="cactus-clock" viewBox="0 0 24 24" aria-hidden="true">
    <ellipse cx={12} cy={12} rx={10} ry={11} fill="#305a12" />
    {dots.map((dot, i) => <circle key={i} cx={dot.x} cy={dot.y} r={1} fill="#fdefd2" />)}
    <line x1={12} y1={12} x2={hour.x} y2={hour.y} stroke="#fdefd2" strokeWidth={1.8} strokeLinecap="round" />
    <line x1={12} y1={12} x2={minute.x} y2={minute.y} stroke="#fdefd2" strokeWidth={1.4} strokeLinecap="round" />
  </svg>;
}
