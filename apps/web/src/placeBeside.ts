import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

// 押した卓のそばに出すときの位置（No.71。詳細パネルとご案内で使う）。卓の右に入らなければ左、どちらにも入らない狭い画面（スマホ）は真ん中に出す
// TOP はヘッダー（高さ56）の下から出す。どの卓のそばかは、矢印ではなく卓の緑の枠で示す（No.107）
export const POPOVER_WIDTH = 360;
const GAP = 14, EDGE = 8, TOP = 64;
export type BesidePlace = { panel: CSSProperties & { top: number; maxHeight: number }; side: 'left' | 'right' };
// height は開いたときの中身の高さ。上の位置はそれで決め、あとで中身が増えても下へ伸ばす（maxHeight を超えたら中をスクロール）
export function placeBeside(anchor: DOMRect | null, height: number): BesidePlace | null {
  if (!anchor) return null;
  const vw = window.innerWidth, vh = window.innerHeight;
  const right = anchor.right + GAP, left = anchor.left - GAP - POPOVER_WIDTH;
  const side = right + POPOVER_WIDTH <= vw - EDGE ? 'right' : left >= EDGE ? 'left' : null;
  if (side === null) return null;
  const center = anchor.top + anchor.height / 2;
  const top = Math.min(Math.max(TOP, center - height / 2), Math.max(TOP, vh - height - EDGE));
  const panelLeft = side === 'right' ? right : left;
  return {
    side,
    panel: { position: 'absolute', top, left: panelLeft, width: POPOVER_WIDTH, maxHeight: vh - top - EDGE },
  };
}
// 開いたときに一度だけ中身の高さを測る。key（卓の位置・画面の大きさ）が変わったときだけ測り直す
function useOpenedHeight(panel: RefObject<HTMLElement | null>, key: string): number {
  const [opened, setOpened] = useState<{ key: string; height: number } | null>(null);
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el || !key) return;
    // 前の maxHeight で縮んでいても、中身の高さで測る
    setOpened(current => current?.key === key ? current : { key, height: Math.max(el.offsetHeight, el.scrollHeight) });
  }, [panel, key]);
  return opened?.key === key ? opened.height : 0;
}
const screenKey = () => `${window.innerWidth},${window.innerHeight}`;
// 卓のそばに出す位置は、開いたときの高さで決める。コースを選んで料理の欄が出る・変更するを開くなどで中身が増えても
// 位置を決め直すとパネルが約200px跳んで、次のタップが別のボタンに当たるため（No.124）
export function useBeside(panel: RefObject<HTMLElement | null>, anchor: DOMRect | null): BesidePlace | null {
  const key = anchor ? `${anchor.left},${anchor.top},${anchor.width},${anchor.height},${screenKey()}` : '';
  return placeBeside(anchor, useOpenedHeight(panel, key));
}
// スマホの下からのシート（No.110）も同じ。下に付いているので中身が増えると上へ伸び、ボタンが動く。
// 開いたときの高さで止めて、増えた分は中をスクロールさせる（シートの上限 86dvh は CSS と同じ）
export function useSheetHold(panel: RefObject<HTMLElement | null>, sheet: boolean): CSSProperties | undefined {
  const height = useOpenedHeight(panel, sheet ? `sheet,${screenKey()}` : '');
  return sheet && height > 0 ? { maxHeight: Math.min(height, window.innerHeight * 0.86) } : undefined;
}
