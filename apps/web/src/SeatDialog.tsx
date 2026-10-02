import { useEffect, useState } from 'react';
import type { Course, DrinkPlan } from '@table-check/core/domain';
import { CoursePicker } from './CoursePicker';
import { MenuPicker } from './MenuPicker';
import { GuestPicker } from './GuestPicker';
import { CloseButton } from './CloseButton';

interface Props {
  tableId: string;
  exited: boolean;           // 退店済の卓への案内
  previousUnpaid: boolean;   // 退店した前のお客さんがお会計前のまま
  onSeat(guests: number | null, course: Course | null, menu: string | null): void;
  drinkPlans: DrinkPlan[];   // 飲み放題の区分（No.90。店の設定）
  onClose(): void;
  returnFocus: HTMLElement | null;
}
// ご案内（No.71）：最初の案内は人数・コース・料理と入力が多いので、詳細のポップオーバーとは別に、真ん中の画面で聞く。
// どれもドロップダウンで、最後に大きな「ご案内」を1つだけ押す（いちばん見てほしいのは人数とこのボタン）。
// テーブルもカウンターも同じ画面にする。押し間違いで案内しない・前のお客さんを置き換えないよう、最初のフォーカスは人数に置く
export function SeatDialog({ tableId, exited, previousUnpaid, onSeat, drinkPlans, onClose, returnFocus }: Props) {
  const [guests, setGuests] = useState<number | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  // どのコースか。コースを選んだときだけ聞く（任意）
  const [menu, setMenu] = useState<string | null>(null);
  useEffect(() => {
    document.getElementById('seat-guests')?.focus();
    return () => returnFocus?.focus();
  }, [returnFocus]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const seat = () => { onSeat(guests, course, course === null ? null : menu); onClose(); };
  const describedBy = [exited && 'seat-dialog-message', exited && previousUnpaid && 'seat-dialog-warning'].filter(Boolean).join(' ') || undefined;
  return <div className="panel-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="panel seat-panel" role={exited ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="seat-dialog-title" aria-describedby={describedBy}>
      <h2 id="seat-dialog-title" className="panel-title">{tableId}番にご案内</h2>
      {exited && <p id="seat-dialog-message" className="confirm-message">{tableId}番は退店済みです。ご案内すると、前のお客さんの表示は新しいお客さんに置き換わります。</p>}
      {exited && previousUnpaid && <p id="seat-dialog-warning" className="confirm-warning">前のお客さんはお会計済みになっていません</p>}
      <div className="field-rows">
        <label className="field-label" htmlFor="seat-guests">人数</label>
        <GuestPicker id="seat-guests" value={guests} onChange={setGuests} emptyLabel="あとで入れる" />
        <label className="field-label" htmlFor="seat-course">コース</label>
        <CoursePicker id="seat-course" value={course} plans={drinkPlans} onChange={setCourse} />
        {course !== null && <>
          <label className="field-label" htmlFor="seat-menu">料理</label>
          <MenuPicker id="seat-menu" value={menu} onChange={setMenu} />
        </>}
      </div>
      <button className="panel-button primary seat-go" onClick={seat}>{guests === null ? 'ご案内（人数はあとで）' : `${guests}名でご案内`}</button>
      <CloseButton onClick={onClose} />
    </section>
  </div>;
}
