import { useEffect, useRef, useState } from 'react';
import { drinkPlanName, QUICK_GUESTS, stepGuests, type Course } from '@table-check/core/domain';
import { priceLabel } from '@table-check/core/courseMenus';
import type { ShopSettings } from '@table-check/core/shopSettings';
import { CloseButton } from './CloseButton';
import { useBeside } from './placeBeside';

interface Props {
  tableId: string;
  exited: boolean;           // 退店済の卓への案内
  previousUnpaid: boolean;   // 退店した前のお客さんがお会計前のまま
  onSeat(guests: number | null, course: Course | null, menu: string | null): void;
  settings: ShopSettings;   // 店の設定（時間のルール・飲み放題の区分・コース。No.14・No.89・No.90）
  onClose(): void;
  returnFocus: HTMLElement | null;
  anchor: DOMRect | null;   // 押した卓の位置。そのそばに出す（無ければ真ん中）
}
// ご案内（No.85）：詳細パネルと同じく押した卓のそばに小さく出し、後ろは暗くしない（スマホは真ん中）。
// 人数は −／＋ と「よく来る人数」、コース・料理はボタンで選ぶ（ドロップダウンを開いて選ぶ手間をなくす）。
// 最後に大きな「ご案内」を1つだけ押す。押し間違いで案内しない・前のお客さんを置き換えないよう、最初のフォーカスはパネルに置く
export function SeatDialog({ tableId, exited, previousUnpaid, onSeat, settings, onClose, returnFocus, anchor }: Props) {
  const [guests, setGuests] = useState<number | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  // どのコースか。コースを選んだときだけ聞く（任意）
  const [menu, setMenu] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.focus();
    return () => returnFocus?.focus();
  }, [returnFocus]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // 背景で押し始めたときだけ閉じる（パネルの中から外へ指をずらしたときに閉じない）
  const downOnBackdrop = useRef(false);
  const place = useBeside(panel, anchor);
  const seat = () => { onSeat(guests, course, course === null ? null : menu); onClose(); };
  const describedBy = [exited && 'seat-dialog-message', exited && previousUnpaid && 'seat-dialog-warning'].filter(Boolean).join(' ') || undefined;
  const plans: { id: Course | null; name: string }[] = [{ id: null, name: '通常' }, ...settings.drinkPlans.map(plan => ({ id: plan.id, name: drinkPlanName(settings.drinkPlans, plan.id) }))];
  return <div className={`panel-backdrop ${place ? 'beside' : ''}`}
    onPointerDown={event => { downOnBackdrop.current = event.target === event.currentTarget; }}
    onClick={event => { if (downOnBackdrop.current && event.target === event.currentTarget) onClose(); downOnBackdrop.current = false; }}>
    <section ref={panel} tabIndex={-1} className={`panel seat-panel ${place ? `beside-${place.side}` : ''}`} style={place?.panel}
      role={exited ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="seat-dialog-title" aria-describedby={describedBy}>
      <h2 id="seat-dialog-title" className="panel-title">{tableId}番にご案内</h2>
      {exited && <p id="seat-dialog-message" className="confirm-message">{tableId}番は退店済みです。ご案内すると、前のお客さんの表示は新しいお客さんに置き換わります。</p>}
      {exited && previousUnpaid && <p id="seat-dialog-warning" className="confirm-warning">前のお客さんはお会計済みになっていません</p>}
      <h3 id="seat-guests" className="field-label">人数</h3>
      <div className="guest-stepper" role="group" aria-labelledby="seat-guests">
        <button className="stepper-button" aria-label="1人へらす" disabled={guests === null} onClick={() => setGuests(g => stepGuests(g, -1))}>−</button>
        <output className={`stepper-value ${guests === null ? 'muted' : ''}`} aria-live="polite">{guests === null ? 'あとで' : `${guests}名`}</output>
        <button className="stepper-button" aria-label="1人ふやす" onClick={() => setGuests(g => stepGuests(g, 1))}>＋</button>
      </div>
      <div className="quick-guests" role="group" aria-label="よく来る人数">
        {QUICK_GUESTS.map(n => <button key={n} className="choice" aria-pressed={guests === n} onClick={() => setGuests(n)}>{n}名</button>)}
      </div>
      <h3 id="seat-course" className="field-label">コース</h3>
      <div className="choice-grid" role="radiogroup" aria-labelledby="seat-course">
        {plans.map(plan => <button key={plan.id ?? ''} role="radio" className="choice" aria-checked={course === plan.id}
          onClick={() => setCourse(plan.id)}>{plan.name}</button>)}
      </div>
      {course !== null && <>
        <h3 id="seat-menu" className="field-label">料理</h3>
        <div className="choice-grid" role="radiogroup" aria-labelledby="seat-menu">
          <button role="radio" className="choice" aria-checked={menu === null} onClick={() => setMenu(null)}>未定</button>
          {settings.courseMenus.map(m => <button key={m.id} role="radio" className="choice" aria-checked={menu === m.id} onClick={() => setMenu(m.id)}>
            {priceLabel(m)}{m.short && <span className="choice-sub">{m.short}</span>}
          </button>)}
        </div>
      </>}
      <button className="panel-button primary seat-go" onClick={seat}>{guests === null ? 'ご案内（人数はあとで）' : `${guests}名でご案内`}</button>
      <CloseButton onClick={onClose} />
    </section>
    {place && <span className={`panel-arrow ${place.side}`} aria-hidden="true" style={place.arrow} />}
  </div>;
}
