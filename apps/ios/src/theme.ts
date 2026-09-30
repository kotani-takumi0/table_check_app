import { useWindowDimensions } from 'react-native';
import type { Alert, Display } from '@table-check/core/domain';

// Web の App.css と同じ色（ライトモード）
export const COLORS = {
  bg: '#f5f6f4', surface: '#ffffff', text: '#24332e', muted: '#76827c', line: '#d9dfda',
  seated: '#3B7DD8', otoshi: '#2E9E6B', lo_done: '#7A5AB8', exited: '#9AA3A0',
  // コースの「開始待ち」「ファーストドリンク提供済み」。通常の案内済み・お通し済みと見分ける
  course_wait: '#1A8A96', first_drink: '#C8559A',
  warning: '#E08A1E', danger: '#D13B2E',
} as const;
const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
// CSS の color-mix(in srgb, color percent%, base) と同じ混ぜ方
export function mix(color: string, percent: number, base: string = COLORS.surface): string {
  const a = rgb(color), b = rgb(base);
  return `rgb(${a.map((v, i) => Math.round(v * percent / 100 + b[i] * (1 - percent / 100))).join(',')})`;
}
// color-mix(in srgb, color percent%, transparent)
export function fade(color: string, percent: number): string {
  return `rgba(${rgb(color).join(',')},${percent / 100})`;
}
// 卓の色：警告がなければ状態の色、あれば警告・危険の色
export function stateColor(display: Display, alert: Alert): string {
  return alert === 'none' ? COLORS[display] : alert === 'soon' ? COLORS.warning : COLORS.danger;
}
// Web の (orientation: portrait) と (max-width: 600px), (max-height: 600px) に合わせる
export function useScreen(): { portrait: boolean; mini: boolean } {
  const { width, height } = useWindowDimensions();
  return { portrait: height > width, mini: width <= 600 || height <= 600 };
}
// 数字の幅をそろえる（タイマー・時刻）
export const TABULAR = { fontVariant: ['tabular-nums' as const] };
