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
  onBack(session: Session): void;
}
export function SeatCard({ seat, session, time, onSeat, onNext, onBack }: CardProps) {
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
      onBack(session);
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
    className: `card ${seat.kind} ${session ? 'occupied' : 'empty'} ${seat.rowSpan === 1 ? 'compact' : ''} ${pressing ? 'pressing' : ''}`,
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onClickCapture: captureClick,
    onContextMenu: (event: MouseEvent<HTMLElement>) => event.preventDefault(),
  };
  const content = <>
    <span className="seat-number">{seat.id}</span>
    {session && timer && <>
      <strong className="status">{seat.kind === 'table' ? STATUS_LABEL[session.status] : STATUS_SHORT[session.status]}</strong>
      <span className="timer" aria-label={`${timer.label} ${formatElapsed(timer.elapsedMs)}`} title={timer.label}>{formatElapsed(timer.elapsedMs)}</span>
    </>}
  </>;
  if (!session) return <button {...common} aria-label={`${seat.id}番 ご案内`} onClick={() => onSeat(seat.id)}>{content}</button>;
  if (seat.kind === 'counter') return <button {...common} aria-label={`${seat.id}番 ${STATUS_LABEL[session.status]} ${timer ? formatElapsed(timer.elapsedMs) : ''}`} onClick={() => onNext(session)}>{content}</button>;
  return <div {...common}>
    {content}
    {alert?.reason && <span className="alert-reason">{REASONS[alert.reason]}</span>}
    {next && <button className="next-button" onClick={() => onNext(session)}>{STATUS_LABEL[next]}</button>}
  </div>;
}
