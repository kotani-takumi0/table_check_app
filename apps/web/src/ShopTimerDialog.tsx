import { useEffect, useRef } from 'react';
import { formatClock } from '@table-check/core/domain';

interface Props {
  label: string;
  icon: string;
  doneAt: number | undefined;   // 前回済にした時刻（まだなら undefined）
  onReset(): void;              // 済にしてタイマーを最初から数え直す
  onClose(): void;
  returnFocus: HTMLElement | null;
}
// ヘッダーのトイレタイマーの詳細。押しただけでリセットしないよう、最初のフォーカスは「閉じる」に置く
export function ShopTimerDialog({ label, icon, doneAt, onReset, onClose, returnFocus }: Props) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    return () => returnFocus?.focus();
  }, [returnFocus]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="panel-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="panel" role="dialog" aria-modal="true" aria-labelledby="shop-timer-title">
      <h2 id="shop-timer-title" className="panel-title"><span aria-hidden="true">{icon}</span> {label}</h2>
      <div className="time-row">
        <span>前回</span>
        <span className={doneAt === undefined ? 'muted' : ''}>{doneAt === undefined ? 'まだ済にしていません' : `${formatClock(doneAt)} に済`}</span>
      </div>
      <div className="panel-actions">
        <button ref={close} className="panel-button" onClick={onClose}>閉じる</button>
        <button className="panel-button primary" onClick={() => { onReset(); onClose(); }}>済にしてリセット</button>
      </div>
    </section>
  </div>;
}
