import type { Dial } from '@table-check/core/dial';

// 卓カードの物差し（No.107。文字盤の代わり）：経過を横の棒で出し、お席の時間（ふつう120分）で右端に届く。
// 太い目盛りが L.O.（ふつう90分）。退店の時刻を決めた卓は core の bandOf の from でずらす。lo が null なら目盛りを出さない（時間制限なし）
export function Ruler({ dial, label, lo }: { dial: Dial; label: string; lo: number | null }) {
  return <span className="ruler" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={dial.limitMin}
    aria-valuenow={Math.min(dial.elapsedMin ?? 0, dial.limitMin)} aria-valuetext={label}>
    {dial.progress > 0 && <span className="ruler-fill" style={{ width: `${dial.progress * 100}%` }} />}
    {lo !== null && <span className="ruler-lo" style={{ left: `${lo * 100}%` }} />}
  </span>;
}
