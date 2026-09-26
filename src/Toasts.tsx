export interface Toast {
  key: string;
  message: string;
  action?: { label: string; onClick(): void };
}
// 画面上部の帯。閉じるまで残す（カードに被らないよう、フロア図の上に並べる）
export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss(key: string): void }) {
  if (toasts.length === 0) return null;
  return <div className="toasts" role="status">
    {toasts.map(toast => <div key={toast.key} className="toast">
      <strong className="toast-message">{toast.message}</strong>
      {toast.action && <button className="toast-button primary" onClick={toast.action.onClick}>{toast.action.label}</button>}
      <button className="toast-button" onClick={() => onDismiss(toast.key)}>閉じる</button>
    </div>)}
  </div>;
}
