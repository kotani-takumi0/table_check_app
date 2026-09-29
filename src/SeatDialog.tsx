import { useEffect, useRef } from 'react';

interface Props {
  tableId: string;
  previousUnpaid: boolean;   // 退店した前のお客さんがお会計前のまま
  onConfirm(): void;
  onClose(): void;
  returnFocus: HTMLElement | null;
}
// 退店済の卓への案内の確認。押し間違いで前のお客さんを置き換えないよう、最初のフォーカスは「やめる」に置く
export function SeatAfterExitDialog({ tableId, previousUnpaid, onConfirm, onClose, returnFocus }: Props) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus();
    return () => returnFocus?.focus();
  }, [returnFocus]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="panel-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="panel" role="alertdialog" aria-modal="true" aria-labelledby="seat-after-exit-title" aria-describedby="seat-after-exit-message seat-after-exit-warning">
      <strong id="seat-after-exit-title" className="panel-status">{tableId}番にご案内しますか？</strong>
      <p id="seat-after-exit-message" className="confirm-message">{tableId}番は退店済みです。ご案内すると、前のお客さんの表示は新しいお客さんに置き換わります。</p>
      {previousUnpaid && <p id="seat-after-exit-warning" className="confirm-warning">前のお客さんはお会計済みになっていません</p>}
      <div className="panel-actions">
        <button ref={cancel} className="panel-button" onClick={onClose}>やめる</button>
        <button className="panel-button primary" onClick={() => { onConfirm(); onClose(); }}>ご案内</button>
      </div>
    </section>
  </div>;
}
