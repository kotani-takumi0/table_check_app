import type { Ref } from 'react';

// パネル・ダイアログの右上の × ボタン（iOS 26 のシートと同じ置き方）。押すと閉じる
export function CloseButton({ onClick, ref }: { onClick(): void; ref?: Ref<HTMLButtonElement> }) {
  return <button ref={ref} className="close-x" aria-label="閉じる" title="閉じる" onClick={onClick}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
  </button>;
}
