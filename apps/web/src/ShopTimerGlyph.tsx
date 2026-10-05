import { shopTimerIcon } from '@table-check/core/shopTimerIcons';

// 店のタイマーの線のアイコン（No.99）。色は文字と同じ（時間が来たチップでは朱になる）。読み上げは名前で行うので隠す
export function ShopTimerGlyph({ icon, className = 'shop-timer-glyph' }: { icon: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {shopTimerIcon(icon).paths.map(d => <path key={d} d={d} />)}
  </svg>;
}
