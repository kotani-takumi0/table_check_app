import { useWindowDimensions } from 'react-native';
import type { Alert } from '@table-check/core/domain';

// 色はアイコンのウチワサボテンから作った4色の役割だけ（Web の App.css・design-system/project/tokens.json のライトと同じ値）。
// 地＝sand（暖かい灰色）、操作＝nopal（茎の緑）、いま対応＝tuna（実の朱）、もうすぐ＝amber（実の琥珀）。
// 状態ごとの色は使わず、段階は文字で出す。ふだんの卓は無彩色
export const COLORS = {
  bg: '#f3f1ee', surface: '#fefdfc', text: '#2d2b28', muted: '#68625c', line: '#dad5d0', lineStrong: '#ccc7c1',
  // 操作：押すボタン・選んでいるもの・移動先を選ぶ表示
  action: '#305a12', onAction: '#ffffff', actionText: '#305a12', actionBg: '#e7f7df',
  // いま対応：お通し未提供・お席の時間・オフライン・消去など
  now: '#f6623a', onNow: '#4d1708', nowText: '#ab340f', nowBg: '#ffede8', nowLine: '#ffb29d',
  // もうすぐ：L.O.・送信待ち
  soon: '#ffc762', onSoon: '#3b2700', soonText: '#825b00', soonBg: '#ffefd5', soonLine: '#ecc176',
} as const;
// 地・枠・文字の組
export interface Tone { bg: string; line: string; text: string }
// 通知の tone（'danger'＝いま対応、'warning'＝もうすぐ）の色
export const TONES: Record<'danger' | 'warning', Tone> = {
  danger: { bg: COLORS.nowBg, line: COLORS.nowLine, text: COLORS.nowText },
  warning: { bg: COLORS.soonBg, line: COLORS.soonLine, text: COLORS.soonText },
};
// 卓の色：警告の段階だけで決める（もうすぐ＝琥珀、いま対応＝朱）。ふだんは無彩色で、退店済は文字を薄くする
export function cardTone(exited: boolean, alert: Alert): Tone {
  if (alert === 'now') return TONES.danger;
  if (alert === 'soon') return TONES.warning;
  return { bg: COLORS.surface, line: COLORS.line, text: exited ? COLORS.muted : COLORS.text };
}
// Web の (orientation: portrait) と (max-width: 600px), (max-height: 600px) に合わせる
export function useScreen(): { portrait: boolean; mini: boolean } {
  const { width, height } = useWindowDimensions();
  return { portrait: height > width, mini: width <= 600 || height <= 600 };
}
// 数字の幅をそろえる（タイマー・時刻）
export const TABULAR = { fontVariant: ['tabular-nums' as const] };
