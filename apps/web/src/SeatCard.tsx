import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { alertOf, dishProgress, displayOf, STATUS_LABEL, STATUS_SHORT, type Session } from '@table-check/core/domain';
import { dialLabel, dialOf, formatHourMinute, remainingLabel, remainingOf } from '@table-check/core/dial';
import type { Seat } from '@table-check/core/layout';
import { Dial } from './Dial';

const REASONS = { otoshi_missing: 'お通し未提供', last_order: 'L.O.の時間', seat_limit: 'お席の時間' };
interface CardProps {
  seat: Seat;
  session?: Session;
  time: number;
  onSeat(tableId: string): void;
  onNext(session: Session): void;
  onOpen(session: Session, from: string): void;
  mini: boolean;   // スマホ：卓番・段階・時:分だけ出し、タップで詳細パネル
  picking: boolean; // 移動先・追加先を選んでいる間：空席だけ押せる
}
// 卓カード。テーブルは文字盤（大きい卓は真ん中、低い卓・細い卓は横）と四隅の情報、カウンターは円の文字盤。
// テーブルはタップで詳細パネル（退店済はご案内）、カウンターはタップで次の状態へ。どちらも長押し（600ms）で詳細パネル
export function SeatCard({ seat, session, time, onSeat, onNext, onOpen, mini, picking }: CardProps) {
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
    if (!session || picking) return;
    setPressing(true);
    timeout.current = setTimeout(() => {
      timeout.current = null;
      suppressClick.current = true;
      setPressing(false);
      onOpen(session, seat.id);
    }, 600);
  };
  const captureClick = (event: MouseEvent<HTMLElement>) => {
    if (suppressClick.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick.current = false;
    }
  };
  // 大きい卓（高さ2行以上・幅2列以上）、低い卓（上段の高さ1行）、細い卓（縦向きの幅1列）
  const shape = seat.kind === 'counter' ? 'counter' : mini ? 'table' : seat.rowSpan === 1 ? 'table low' : seat.colSpan === 1 ? 'table low narrow' : 'table full';
  const style = { gridColumn: `${seat.col} / span ${seat.colSpan}`, gridRow: `${seat.row} / span ${seat.rowSpan}` } as CSSProperties;
  const handlers = {
    style,
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onClickCapture: captureClick,
    onContextMenu: (event: MouseEvent<HTMLElement>) => event.preventDefault(),
  };
  const modes = `${mini ? 'mini' : ''} ${seat.colSpan === 1 ? 'slim' : ''} ${picking ? session ? 'pick-disabled' : 'pick-target' : ''} ${pressing ? 'pressing' : ''}`;
  if (!session) {
    return <button {...handlers} className={`card ${shape} empty ${modes}`} aria-label={picking ? `${seat.id}番を選ぶ` : `${seat.id}番 ご案内`} onClick={() => onSeat(seat.id)}>
      <span className="seat-number">{seat.id}</span>
    </button>;
  }
  const alert = alertOf(session, time);
  const dial = dialOf(session, time);
  const remaining = remainingOf(session, time);
  const exited = session.status === 'exited';
  const paid = session.paidAt !== null;
  // コースの「開始待ち」「ファーストドリンク提供済み」は通常と名前を変える（色は変えない）
  const display = displayOf(session.status, session.course);
  // 卓の色は警告の段階だけで決める（もうすぐ＝琥珀、いま対応＝朱）。ふだんは無彩色で、退店済は全体を薄くする
  const tone = alert.level !== 'none' ? `alert-${alert.level}` : exited ? 'exited' : '';
  // 団体：同じセッションの他の卓番を添える
  const others = session.tableIds.filter(id => id !== seat.id);
  const groupMark = others.length > 0 ? `+${others.length <= 2 ? others.join('+') : `${others.length}卓`}` : '';
  const group = others.length > 0 ? `（${session.tableIds.join('・')}番の団体）` : '';
  // 人数・コースの料理の進みはテーブル卓だけ。団体はどの卓にも全員の人数を出す
  const guests = seat.kind === 'table' ? session.guests : undefined;
  const progress = seat.kind === 'table' ? dishProgress(session) : null;
  // 右下：L.O.まで・退席まで。退店済は「押すとご案内」、コースの開始待ちはタイマー停止中
  const corner = remaining ? remainingLabel(remaining)
    : exited ? '押すとご案内'
      : 'タイマー停止中';
  const meter = dialLabel(dial, remaining);
  const label = `${seat.id}番${group}${guests === undefined ? '' : guests === null ? ' 人数未入力' : ` ${guests}名`} ${STATUS_LABEL[display]} ${meter}${alert.reason ? ` ${REASONS[alert.reason]}` : ''}${paid ? ' お会計済み' : ''}`;
  const className = `card ${shape} occupied ${tone} ${modes}`;
  // 段階：警告のときは理由の札（塗り）、ふだんは段階名
  const stage = alert.reason
    ? <span className="badge">{REASONS[alert.reason]}</span>
    : <strong className="status">{STATUS_SHORT[display]}</strong>;
  const number = <span className="seat-number">{seat.id}{groupMark && <span className="group-mark">{groupMark}</span>}</span>;
  const time_ = dial.elapsedMin === null ? '--:--' : formatHourMinute(dial.elapsedMin);

  if (mini) {
    // スマホ：文字盤は出さず、卓番・段階・時:分。警告は淡い地の色だけ
    return <button {...handlers} className={className} disabled={picking} aria-label={`${label}（押すと詳細）`} onClick={() => onOpen(session, seat.id)}>
      <span className="seat-number">{seat.id}{groupMark && <span className="group-mark">{groupMark}</span>}{paid && <span className="paid-inline" aria-hidden="true">¥✓</span>}
        {guests !== undefined && <span className={`guest-count ${guests === null ? 'unknown' : ''}`}><span className="guest-num">{guests ?? '?'}</span>名</span>}</span>
      <strong className="status">{STATUS_SHORT[display]}</strong>
      <span className="timer">{time_}</span>
    </button>;
  }
  if (seat.kind === 'counter') {
    // カウンター：卓番は円の上、時間は円の中、段階は円の下。タップで次の状態へ（退店済はご案内）
    return <button {...handlers} className={className} disabled={picking} aria-label={`${label}${exited ? '（押すとご案内）' : ''}`} onClick={() => exited ? onSeat(seat.id) : onNext(session)}>
      {number}
      <span className="dial-box"><Dial dial={dial} label={meter} />{paid && <span className="paid-mark" aria-hidden="true">¥✓</span>}</span>
      <strong className="status">{alert.reason ? REASONS[alert.reason] : STATUS_SHORT[display]}</strong>
    </button>;
  }
  const meta = <span className="meta">
    {guests !== undefined && <span className={`guest-count ${guests === null ? 'unknown' : ''}`}><span className="guest-num">{guests ?? '?'}</span>名</span>}
    {session.course !== null && <span className="course-meta">コース{progress && <span className="dish-progress"> {progress.served}/{progress.total}</span>}</span>}
    {paid && <span className="paid-meta">会計済</span>}
  </span>;
  return <button {...handlers} className={className} disabled={picking} aria-label={`${label}（${exited ? '押すとご案内、長押しで詳細' : '押すと詳細'}）`}
    onClick={() => exited ? onSeat(seat.id) : onOpen(session, seat.id)}>
    {shape === 'table full' ? <>
      <span className="corner tl">{number}</span>
      <span className="corner tr">{meta}</span>
      <span className="dial-box"><Dial dial={dial} label={meter} /></span>
      <span className="corner bl">{stage}</span>
      <span className="corner br">{corner}</span>
    </> : <>
      {/* 低い卓・細い卓：左（細い卓は上）に卓番・段階・残り時間、右（下）に小さめの文字盤 */}
      <span className="info">
        <span className="info-head">{number}{meta}</span>
        {stage}
        <span className="remaining">{corner}</span>
      </span>
      <span className="dial-box"><Dial dial={dial} label={meter} /></span>
    </>}
  </button>;
}
