export interface Toast {
  key: string;
  message: string;
  action?: { label: string; onClick(): void };
}
// 閉じるまで残す通知。フロア図の空き（2行目の列6〜15）に置き、行の高さを変えない
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
