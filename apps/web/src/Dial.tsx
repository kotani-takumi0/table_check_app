import { arcPath, DIAL_BAND, DIAL_MIN, dialPoint, formatHourMinute, type Dial as DialValue } from '@table-check/core/dial';

const C = 50, R = 44;
// 縁の12個の点（アイコンのトゲ）。10分ごと
const DOTS = Array.from({ length: 12 }, (_, i) => dialPoint(i / 12, C, C, R));
const DEFAULT_BAND = { from: DIAL_BAND.fromMin / DIAL_MIN, to: DIAL_BAND.toMin / DIAL_MIN };
// 卓の文字盤：塗った丸の中に経過（時:分）。12時から時計回りに経過の弧が伸び、120分で一周する。
// 縁の 90〜120分（L.O.から退席まで）に淡い琥珀の帯。退店の時刻を決めた卓は band（core の bandOf）でずらす。色はカードの --dial-face・--arc で決まる
// band が null なら帯を出さない（カウンターの小さい文字盤では帯が目立って読みにくいので。No.73）
export function Dial({ dial, label, band = DEFAULT_BAND }: { dial: DialValue; label: string; band?: { from: number; to: number } | null }) {
  const text = dial.elapsedMin === null ? '開始前' : formatHourMinute(dial.elapsedMin);
  return <svg className="dial" viewBox="0 0 100 100" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={DIAL_MIN}
    aria-valuenow={Math.min(dial.elapsedMin ?? 0, DIAL_MIN)} aria-valuetext={label}>
    <circle className="dial-face" cx={C} cy={C} r={R} />
    {band && <path className="dial-band" d={arcPath(band.from, band.to, C, C, R)} />}
    {DOTS.map((dot, i) => <circle key={i} className="dial-dot" cx={dot.x} cy={dot.y} r={1.8} />)}
    {dial.progress > 0 && <path className="dial-arc" d={arcPath(0, dial.progress, C, C, R)} />}
    <text className={`dial-time ${dial.elapsedMin === null ? 'waiting' : ''}`} x={C} y={C} textAnchor="middle" dominantBaseline="central">{text}</text>
  </svg>;
}
