import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

// 押した卓のそばに出すときの位置（No.71。詳細パネルとご案内で使う）。卓の右に入らなければ左、どちらにも入らない狭い画面（スマホ）は真ん中に出す
// TOP はヘッダー（高さ56）の下から出す。どの卓のそばかは、矢印ではなく卓の緑の枠で示す（No.107）
export const POPOVER_WIDTH = 360;
const GAP = 14, EDGE = 8, TOP = 64;
export type BesidePlace = { panel: CSSProperties; side: 'left' | 'right' };
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
    panel: { position: 'absolute', top, left: panelLeft, width: POPOVER_WIDTH },
  };
}
// 高さは中身で変わる（変更するを開く・料理の欄が出るなど）ので、描いたあとに測って位置を決め直す
export function useBeside(panel: RefObject<HTMLElement | null>, anchor: DOMRect | null): BesidePlace | null {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [panel]);
  return placeBeside(anchor, height);
}
