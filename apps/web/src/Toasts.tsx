import type { ReactNode } from 'react';

export interface Toast {
  key: string;
  message: string;
  tone: 'warning' | 'danger';
  icon: ReactNode;
  action: { label: string; onClick(): void };
}
// 通知のポップアップ（No.109）：フロアの上の右下（スマホはヘッダーのすぐ下）に1件ずつ出す。2件目からは「ほか N件」で切り替える。
// 下の細い線が10秒で縮みきったら、ヘッダーの「通知」にしまう（onTuck）。マウスを乗せている間とキーボードで操作している間は線を止める。
// 「閉じる」はしまうだけで、通知は「済にする」などを押すまで残る（見逃しても、ヘッダーの「通知」とタイマー・卓の色で気づける）
// run：開き直すたびに変える数。線を最初から縮め直す
export function Toasts({ toasts, shownKey, run, onShow, onTuck, onAction }: {
  toasts: Toast[]; shownKey: string | null; run: number; onShow(key: string): void; onTuck(): void; onAction(): void;
}) {
  if (toasts.length === 0) return null;
  const index = Math.max(0, toasts.findIndex(toast => toast.key === shownKey));
  const toast = toasts[index];
  const rest = toasts.length - 1;
  return <section className="notice-popup" aria-label="通知">
    <div key={`${toast.key}-${run}`} className={`toast ${toast.tone}`} role="status">
      <span className="toast-icon" aria-hidden="true">{toast.icon}</span>
      <strong className="toast-message">{toast.message}</strong>
      <span className="toast-actions">
        {rest > 0 && <button className="toast-next" aria-label={`ほか${rest}件（押すと次の通知）`} onClick={() => onShow(toasts[(index + 1) % toasts.length].key)}>ほか{rest}件</button>}
        <button className="panel-button small primary" onClick={() => { toast.action.onClick(); onAction(); }}>{toast.action.label}</button>
        <button className="text-button" onClick={onTuck}>閉じる</button>
      </span>
      <span className="toast-drain" aria-hidden="true" onAnimationEnd={onTuck} />
    </div>
  </section>;
}
