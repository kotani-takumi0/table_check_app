import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { alertOf, formatElapsed, nextStatus, STATUS_LABEL, STATUS_SHORT, timerOf, type Alert, type Session, type Status } from './domain';
import type { Seat } from './layout';

function stateColor(status: Status, alert: Alert): string {
  return `var(--${alert === 'none' ? status : alert === 'soon' ? 'warning' : 'danger'})`;
}
const REASONS = { otoshi_missing: 'お通し未提供', last_order: 'L.O.の時間', seat_limit: 'お席の時間' };
interface CardProps {
  seat: Seat;
  session?: Session;
  time: number;
  onSeat(tableId: string): void;
  onNext(session: Session): void;
  onOpen(session: Session): void;
  onPay(session: Session): void;
  mini: boolean;   // スマホ：卓番・状態・タイマーだけ出し、タップで詳細パネル
}
export function SeatCard({ seat, session, time, onSeat, onNext, onOpen, onPay, mini }: CardProps) {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const [pressing, setPressing] = useState(false);
  const cancel = () => {
    if (timeout.current !== null) clearTimeout(timeout.current);
    timeout.current = null;
    setPressing(false);
  };
  useEffect(() => () => { if (timeout.current !== null) clearTimeout(timeout.current); }, [session]);
  const start = (event: PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    cancel();
    suppressClick.current = false;
    if (!session) return;
    setPressing(true);
    timeout.current = setTimeout(() => {
      timeout.current = null;
      suppressClick.current = true;
      setPressing(false);
      onOpen(session);
    }, 600);
  };
  const captureClick = (event: MouseEvent<HTMLElement>) => {
    if (suppressClick.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick.current = false;
    }
  };
  const alert = session ? alertOf(session, time) : null;
  const timer = session ? timerOf(session, time) : null;
  const next = session ? nextStatus(session.status) : null;
  const style = {
    gridColumn: `${seat.col} / span ${seat.colSpan}`,
    gridRow: `${seat.row} / span ${seat.rowSpan}`,
    ...(session && alert ? { '--st': stateColor(session.status, alert.level) } : {}),
  } as CSSProperties;
  const common = {
    style,
    className: `card ${seat.kind} ${session ? 'occupied' : 'empty'} ${mini ? 'mini' : seat.rowSpan === 1 ? 'compact' : seat.colSpan === 1 ? 'narrow' : ''} ${seat.colSpan === 1 ? 'slim' : ''} ${pressing ? 'pressing' : ''}`,
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onClickCapture: captureClick,
    onContextMenu: (event: MouseEvent<HTMLElement>) => event.preventDefault(),
  };
  const content = <>
    {/* スマホは会計済みの印を卓番の横に並べる（小さいカードで重ならないように） */}
    <span className="seat-number">{seat.id}{mini && session?.paidAt != null && <span className="paid-inline" aria-hidden="true">¥✓</span>}</span>
    {session && timer && <>
      {/* カウンター・スマホ・縦向きの細いテーブルは幅が無いので短縮ラベル */}
      <strong className="status">{seat.kind === 'table' && !mini && seat.colSpan > 1 ? STATUS_LABEL[session.status] : STATUS_SHORT[session.status]}</strong>
      <span className="timer" aria-label={`${timer.label} ${formatElapsed(timer.elapsedMs)}`} title={timer.label}>{formatElapsed(timer.elapsedMs)}</span>
      {seat.kind === 'counter' && !mini && session.paidAt !== null && <span className="paid-mark" aria-hidden="true">¥✓</span>}
    </>}
  </>;
  if (!session) return <button {...common} aria-label={`${seat.id}番 ご案内`} onClick={() => onSeat(seat.id)}>{content}</button>;
  if (mini) return <button {...common} aria-label={`${seat.id}番 ${STATUS_LABEL[session.status]} ${timer ? formatElapsed(timer.elapsedMs) : ''}${alert?.reason ? ` ${REASONS[alert.reason]}` : ''}${session.paidAt !== null ? ' お会計済み' : ''}（押すと詳細）`} onClick={() => onOpen(session)}>{content}</button>;
  if (seat.kind === 'counter') return <button {...common} aria-label={`${seat.id}番 ${STATUS_LABEL[session.status]} ${timer ? formatElapsed(timer.elapsedMs) : ''}${session.paidAt !== null ? ' お会計済み' : ''}`} onClick={() => onNext(session)}>{content}</button>;
  return <div {...common}>
    {content}
    {/* 上段の低いカードは状態名と並べる幅が無いので「¥」だけにする */}
    <button className={`pay-toggle ${session.paidAt !== null ? 'paid' : ''}`} aria-pressed={session.paidAt !== null}
      aria-label={session.paidAt !== null ? 'お会計済み（押すと未払いに戻す）' : '未払い（押すとお会計済みにする）'} onClick={() => onPay(session)}>
      {seat.rowSpan === 1 ? (session.paidAt !== null ? '¥✓' : '¥') : session.paidAt !== null ? '会計済み' : '未払い'}
    </button>
    {alert?.reason && <span className="alert-reason">{REASONS[alert.reason]}</span>}
    {next && <button className="next-button" onClick={() => onNext(session)}>{STATUS_LABEL[next]}</button>}
  </div>;
}
