import { useEffect, useRef } from 'react';

interface Props {
  unpaidTables: number;   // 会計前の卓の数（0なら警告を出さない）
  onConfirm(): void;
  onClose(): void;
  returnFocus: HTMLElement | null;
}
// 全卓消去の確認。押し間違いで消さないよう、最初のフォーカスは「やめる」に置く
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
  return <div className="panel-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="panel" role="alertdialog" aria-modal="true" aria-labelledby="clear-all-title" aria-describedby="clear-all-message clear-all-warning">
      <strong id="clear-all-title" className="panel-status">全卓を消去しますか？</strong>
      <p id="clear-all-message" className="clear-all-message">すべての卓の案内・時刻・お会計の記録を消します。ほかの端末の画面からも消え、元に戻せません。</p>
      {unpaidTables > 0 && <p id="clear-all-warning" className="clear-all-warning">会計前の卓が {unpaidTables} 卓あります</p>}
      <div className="panel-actions">
        <button ref={cancel} className="panel-button" onClick={onClose}>やめる</button>
        <button className="panel-button danger" onClick={() => { onConfirm(); onClose(); }}>全卓を消去</button>
      </div>
    </section>
  </div>;
}
