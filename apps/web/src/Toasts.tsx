export interface Toast {
  key: string;
  message: string;
  tone: 'warning' | 'danger';
  action?: { label: string; onClick(): void };
}
// 閉じるまで残す通知。フロア図の空き（2行目の列6〜15）に置き、行の高さを変えない
// 空きに入る行数（rows）を超えたら先頭だけ出して残りをまとめる（先頭を片付けると繰り上がる）
// 1行しか入らない画面では、まとめを先頭の通知の中に「ほか N件」として出す
export function Toasts({ toasts, onDismiss, rows }: { toasts: Toast[]; onDismiss(key: string): void; rows: 1 | 2 }) {
  if (toasts.length === 0) return null;
  const shown = toasts.length > rows ? toasts.slice(0, 1) : toasts;
  const rest = toasts.slice(shown.length);
  return <div className="toasts" role="status">
    {shown.map(toast => <div key={toast.key} className={`toast ${toast.tone}`}>
      <strong className="toast-message">{toast.message}{rows === 1 && rest.length > 0 && <span className="toast-more">ほか {rest.length}件</span>}</strong>
      {toast.action && <button className="toast-button primary" onClick={toast.action.onClick}>{toast.action.label}</button>}
      <button className="toast-button" onClick={() => onDismiss(toast.key)}>閉じる</button>
    </div>)}
    {rows === 2 && rest.length > 0 && <div className={`toast toast-rest ${rest.some(t => t.tone === 'danger') ? 'danger' : 'warning'}`}>
      <strong className="toast-message">ほか {rest.length}件：{rest.map(t => t.message).join('／')}</strong>
    </div>}
  </div>;
}
