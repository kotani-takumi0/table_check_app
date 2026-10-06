import { useRef, type PointerEvent } from 'react';

// 下から出すシート（No.110。スマホの詳細パネルとご案内）の上の引き手。下へ引っ張って離すと閉じる。
// 引っ張っている間はシートごと指について下がり、少ししか引かなければ元に戻る。キーボード・読み上げでは右上の × で閉じる
const CLOSE_DISTANCE = 80;
export function SheetGrip({ onClose }: { onClose(): void }) {
  const drag = useRef<{ y: number; sheet: HTMLElement } | null>(null);
  const move = (sheet: HTMLElement, dy: number) => { sheet.style.transform = dy > 0 ? `translateY(${dy}px)` : ''; };
  const start = (event: PointerEvent<HTMLDivElement>) => {
    const sheet = event.currentTarget.closest<HTMLElement>('.panel');
    if (!sheet || !event.isPrimary) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    sheet.style.transition = 'none';
    drag.current = { y: event.clientY, sheet };
  };
  const end = (event: PointerEvent<HTMLDivElement>, cancel: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    d.sheet.style.transition = '';
    if (!cancel && event.clientY - d.y >= CLOSE_DISTANCE) onClose();
    else move(d.sheet, 0);
  };
  return <div className="sheet-grip" aria-hidden="true" onPointerDown={start}
    onPointerMove={event => { if (drag.current) move(drag.current.sheet, event.clientY - drag.current.y); }}
    onPointerUp={event => end(event, false)} onPointerCancel={event => end(event, true)} />;
}
