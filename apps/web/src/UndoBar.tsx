import { UNDO_MS } from '@table-check/core/undo';

// 画面の下に数秒だけ出す「〜しました［元に戻す］」（No.102・No.121）。下の細い線が縮みきったら消える。
// 戻せなかったとき（ほかの端末で変わった）は、ボタンを出さずに理由だけを出す
export function UndoBar({ message, runKey, onUndo }: { message: string; runKey: number; onUndo?(): void }) {
  return <div className="undo-bar" role="status">
    <span className="undo-message">{message}</span>
    {onUndo && <button className="undo-button" onClick={onUndo}>元に戻す</button>}
    <span key={runKey} className="undo-drain" aria-hidden="true" style={{ animationDuration: `${UNDO_MS}ms` }} />
  </div>;
}
