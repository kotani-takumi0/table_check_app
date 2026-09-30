import { useEffect, useRef, useState } from 'react';
import { GUESTS_MAX, type Course } from './domain';
import { CoursePicker } from './CoursePicker';

interface Props {
  tableId: string;
  exited: boolean;           // 退店済の卓への案内
  previousUnpaid: boolean;   // 退店した前のお客さんがお会計前のまま
  onSeat(guests: number | null, course: Course | null): void;
  onClose(): void;
  returnFocus: HTMLElement | null;
}
const QUICK_GUESTS = [1, 2, 3, 4, 5, 6, 7, 8];
// ご案内の確認と、コース・人数。テーブルもカウンターも同じ画面にする（卓によって操作が違うと混乱するため）。
// コースは初期値の「通常」のままでよければ触らず、人数のボタンを押したらその場で案内する。
// 押し間違いで案内しない・前のお客さんを置き換えないよう、最初のフォーカスは「やめる」に置く
export function SeatDialog({ tableId, exited, previousUnpaid, onSeat, onClose, returnFocus }: Props) {
  const cancel = useRef<HTMLButtonElement>(null);
  const [course, setCourse] = useState<Course | null>(null);
  // 「9名以上」を押したら −／＋ で選ぶ
  const [many, setMany] = useState<number | null>(null);
  useEffect(() => {
    cancel.current?.focus();
    return () => returnFocus?.focus();
  }, [returnFocus]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const seat = (guests: number | null) => { onSeat(guests, course); onClose(); };
  const describedBy = [exited && 'seat-dialog-message', exited && previousUnpaid && 'seat-dialog-warning'].filter(Boolean).join(' ') || undefined;
  return <div className="panel-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="panel" role={exited ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="seat-dialog-title" aria-describedby={describedBy}>
      <strong id="seat-dialog-title" className="panel-status">{tableId}番にご案内</strong>
      {exited && <p id="seat-dialog-message" className="confirm-message">{tableId}番は退店済みです。ご案内すると、前のお客さんの表示は新しいお客さんに置き換わります。</p>}
      {exited && previousUnpaid && <p id="seat-dialog-warning" className="confirm-warning">前のお客さんはお会計済みになっていません</p>}
      <div className="guest-picker">
        <span id="seat-dialog-course" className="guest-question">コース</span>
        <CoursePicker value={course} onChange={setCourse} labelledBy="seat-dialog-course" />
      </div>
      <div className="guest-picker" role="group" aria-labelledby="seat-dialog-guests">
        <span id="seat-dialog-guests" className="guest-question">何名様ですか？</span>
        <div className="guest-grid">
          {QUICK_GUESTS.map(n => <button key={n} className="guest-button" aria-label={`${n}名でご案内`} onClick={() => seat(n)}>{n}</button>)}
        </div>
        {many === null
          ? <button className="panel-button" onClick={() => setMany(QUICK_GUESTS.length + 1)}>9名以上</button>
          : <div className="guest-stepper">
            <button className="guest-step" aria-label="1名減らす" disabled={many <= 1} onClick={() => setMany(many - 1)}>−</button>
            <span className="guest-many" aria-live="polite">{many}名</span>
            <button className="guest-step" aria-label="1名増やす" disabled={many >= GUESTS_MAX} onClick={() => setMany(many + 1)}>＋</button>
            <button className="panel-button primary" onClick={() => seat(many)}>{many}名でご案内</button>
          </div>}
      </div>
      <div className="panel-actions">
        <button className="panel-button" onClick={() => seat(null)}>人数はあとで</button>
        <button ref={cancel} className="panel-button" onClick={onClose}>やめる</button>
      </div>
    </section>
  </div>;
}
