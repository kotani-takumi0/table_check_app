// 店のタイマーのアイコン（No.99）。絵文字をやめ、ツールバーの線のアイコン（メニュー・ゴミ箱）と同じ描き方にする：
// 24 の枠に太さ 1.8 の線、角は丸。色は持たず、文字と同じ色（currentColor）で描く。Web と iOS で同じ線を使う
// ShopTimer の icon には id を保存する。前の版が保存した絵文字は、近いアイコンに読み替える（書き換えはしない）
export interface ShopTimerIcon { id: string; name: string; paths: string[] }
export const SHOP_TIMER_ICONS: ShopTimerIcon[] = [
  { id: 'patrol', name: '見回り', paths: ['M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z', 'M9.2 12a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0-5.6 0'] },
  { id: 'toilet', name: 'トイレ', paths: ['M6.5 3.5h5v6.5h-5z', 'M4 10h16c0 3.3-3.6 6-8 6s-8-2.7-8-6z', 'M9.5 16l-1 4.5h7l-1-4.5'] },
  { id: 'clean', name: '清掃', paths: ['M16 3.5l-3.2 8', 'M7.5 11.5h9l1 9h-11z', 'M10 15.5v5M14 15.5v5'] },
  { id: 'spray', name: '消毒', paths: ['M8.5 10.5h6a1 1 0 0 1 1 1V20h-8v-8.5a1 1 0 0 1 1-1z', 'M9.5 10.5V6.5h4.5l2 1.5', 'M19 5.5h.01M20.5 8h.01M19 10.5h.01'] },
  { id: 'drop', name: '手洗い', paths: ['M12 3.5s-6 6.6-6 10.6a6 6 0 0 0 12 0c0-4-6-10.6-6-10.6z', 'M9.2 14.5a2.8 2.8 0 0 0 2.8 2.8'] },
  { id: 'bag', name: 'ゴミ出し', paths: ['M6.5 9h11l1 11h-13z', 'M9.5 9l2.5-4 2.5 4'] },
  { id: 'wind', name: '換気', paths: ['M3.5 9h10a2.5 2.5 0 1 0-2.5-2.5', 'M3.5 13h14a2.5 2.5 0 1 1-2.5 2.5', 'M3.5 17h6'] },
  { id: 'box', name: '補充', paths: ['M4 7.8l8-4 8 4v8.4l-8 4-8-4z', 'M4 7.8l8 4 8-4', 'M12 11.8v8.4'] },
  { id: 'clock', name: '時計', paths: ['M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0', 'M12 7.5V12l3 2'] },
];
// 新しく足したタイマーのアイコン。知らない値（壊れた値・前の版の見知らぬ絵文字）もこれで描く
export const FALLBACK_SHOP_TIMER_ICON = 'clock';
// 前の版で入れられた絵文字（最初の一覧と、設定の例に出していたもの）
const LEGACY_EMOJI: Record<string, string> = { '👀': 'patrol', '🧽': 'clean', '🧹': 'clean', '⏰': 'clock', '🗑️': 'bag', '🗑': 'bag', '🚽': 'toilet' };
export function shopTimerIcon(icon: string): ShopTimerIcon {
  const id = LEGACY_EMOJI[icon] ?? icon;
  return SHOP_TIMER_ICONS.find(item => item.id === id) ?? SHOP_TIMER_ICONS.find(item => item.id === FALLBACK_SHOP_TIMER_ICON)!;
}
