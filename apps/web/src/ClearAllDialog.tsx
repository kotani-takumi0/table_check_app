import { useEffect, useRef } from 'react';

interface Props {
  unpaidTables: number;   // 会計前の卓の数（0なら警告を出さない）
  onConfirm(): void;
  onClose(): void;
  returnFocus: HTMLElement | null;
}
// 全卓消去の確認。押し間違いで消さないよう、最初のフォーカスは「やめる」に置く。後ろを暗くして止めるのはこの確認だけ（No.107）
export function ClearAllDialog({ unpaidTables, onConfirm, onClose, returnFocus }: Props) {
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
  return <div className="panel-backdrop popover-backdrop from-end dim" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="panel alert popover" role="alertdialog" aria-modal="true" aria-labelledby="clear-all-title" aria-describedby="clear-all-message clear-all-warning">
      <h2 id="clear-all-title" className="panel-title">全卓を消去しますか？</h2>
      <p id="clear-all-message" className="confirm-message">すべての卓のお客さんを画面から消します。ほかの端末の画面からも消え、元に戻せません（記録には残り、書き出しで見られます）。</p>
      {unpaidTables > 0 && <p id="clear-all-warning" className="confirm-warning">会計前の卓が {unpaidTables} 卓あります</p>}
      <div className="panel-actions">
        <button ref={cancel} className="panel-button" onClick={onClose}>やめる</button>
        <button className="panel-button danger" onClick={() => { onConfirm(); onClose(); }}>全卓を消去</button>
      </div>
    </section>
  </div>;
}
