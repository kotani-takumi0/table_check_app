import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { alertOf, dishProgress, displayOf, STATUS_LABEL, STATUS_SHORT, type Session, REASON_LABEL } from '@table-check/core/domain';
import { bandOf, dialLabel, dialOf, remainingLabel, remainingOf } from '@table-check/core/dial';
import type { Seat } from '@table-check/core/layout';
import { Dial } from './Dial';

interface CardProps {
  seat: Seat;
  session?: Session;
  time: number;
  onSeat(tableId: string): void;
  onOpen(session: Session, from: string): void;
  editing?: boolean;   // ほかの端末でこの卓の詳細を開いている（No.72）
  timeLimitOff: boolean;   // 店全体で時間制限を切っている（L.O.・お席の時間の警告と帯を出さない）
  mini: boolean;   // スマホ：卓番・段階・時:分だけ出し、タップで詳細パネル
  picking: boolean; // 移動先・追加先を選んでいる間：空席だけ押せる
}
// 卓カード。テーブルは文字盤（大きい卓は真ん中、低い卓・細い卓は横）と四隅の情報、カウンターは円の文字盤。
// テーブルはタップで詳細パネル（退店済はご案内）、カウンターはタップで次の状態へ。どちらも長押し（600ms）で詳細パネル
export function SeatCard({ seat, session, time, editing = false, timeLimitOff, onSeat, onOpen, mini, picking }: CardProps) {
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
    // 詳細をこの卓のそばに出すため、App が位置を探す目印
    'data-seat': seat.id,
  };
  const modes = `${mini ? 'mini' : ''} ${seat.colSpan === 1 ? 'slim' : ''} ${picking ? session ? 'pick-disabled' : 'pick-target' : ''} ${pressing ? 'pressing' : ''}`;
  if (!session) {
    return <button {...handlers} className={`card ${shape} empty ${modes}`} aria-label={picking ? `${seat.id}番を選ぶ` : `${seat.id}番 ご案内`} onClick={() => onSeat(seat.id)}>
      <span className="seat-number">{seat.id}</span>
    </button>;
  }
  const alert = alertOf(session, time, timeLimitOff);
  const dial = dialOf(session, time);
  const remaining = remainingOf(session, time, timeLimitOff);
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
  const label = `${editing ? 'ほかの端末で編集中 ' : ''}${seat.id}番${group}${guests === undefined ? '' : guests === null ? ' 人数未入力' : ` ${guests}名`} ${STATUS_LABEL[display]} ${meter}${alert.reason ? ` ${REASON_LABEL[alert.reason]}` : ''}${paid ? ' お会計済み' : ''}`;
  const className = `card ${shape} occupied ${tone} ${modes} ${editing ? 'editing' : ''}`;
  // 段階：警告のときは理由の札（塗り）、ふだんは段階名
  const stage = alert.reason
    ? <span className="badge">{REASON_LABEL[alert.reason]}</span>
    : <strong className="status">{STATUS_SHORT[display]}</strong>;
  const number = <span className="seat-number">{seat.id}{groupMark && <span className="group-mark">{groupMark}</span>}</span>;

  if (mini) {
    // スマホ：上に卓番（人数）、真ん中に文字盤（中に時:分）、下に段階。警告は淡い地の色と文字盤の色。
    // カウンターのような低いマスは段階を省き、卓番と文字盤だけにする（CSS の @container）。
    // カウンターは iPad と同じく L.O.の帯を出さない（No.73）
    return <button {...handlers} className={className} disabled={picking} aria-label={`${label}（押すと詳細）`} onClick={() => onOpen(session, seat.id)}>
      {editing && <span className="editing-tag" aria-hidden="true">編集中</span>}
      <span className="seat-number">{seat.id}{groupMark && <span className="group-mark">{groupMark}</span>}{paid && <span className="paid-inline" aria-hidden="true">¥✓</span>}
        {guests !== undefined && <span className={`guest-count ${guests === null ? 'unknown' : ''}`}><span className="guest-num">{guests ?? '?'}</span>名</span>}</span>
      <span className="dial-box"><Dial dial={dial} label={meter} band={seat.kind === 'table' && !timeLimitOff ? bandOf(session) : null} /></span>
      <strong className="status">{alert.reason ? REASON_LABEL[alert.reason] : STATUS_SHORT[display]}</strong>
    </button>;
  }
  if (seat.kind === 'counter') {
    // カウンター：卓番は円の上、時間は円の中、段階は円の下。テーブルと同じくタップで詳細（退店済はご案内）。
    // 押しただけで状態が進むと、押し間違いや複数人での同時操作で気づかずに進んでしまうため（No.70）
    return <button {...handlers} className={className} disabled={picking} aria-label={`${label}（${exited ? '押すとご案内、長押しで詳細' : '押すと詳細'}）`} onClick={() => exited ? onSeat(seat.id) : onOpen(session, seat.id)}>
      {editing && <span className="editing-tag" aria-hidden="true">編集中</span>}
      {number}
      <span className="dial-box"><Dial dial={dial} label={meter} band={null} />{paid && <span className="paid-mark" aria-hidden="true">¥✓</span>}</span>
      <strong className="status">{alert.reason ? REASON_LABEL[alert.reason] : STATUS_SHORT[display]}</strong>
    </button>;
  }
  // 右上：人数・コース（料理の進み）・会計済。低い卓・細い卓は1行に収まるよう「3/8」「¥✓」と短くする
  const full = shape === 'table full';
  const meta = <span className="meta">
    {guests !== undefined && <span className={`guest-count ${guests === null ? 'unknown' : ''}`}><span className="guest-num">{guests ?? '?'}</span>名</span>}
    {session.course !== null && <span className="course-meta">{full || !progress ? 'コース' : ''}{progress && <span className="dish-progress">{full ? ' ' : ''}{progress.served}/{progress.total}</span>}</span>}
    {paid && <span className="paid-meta">{full ? '会計済' : '¥✓'}</span>}
  </span>;
  return <button {...handlers} className={className} disabled={picking} aria-label={`${label}（${exited ? '押すとご案内、長押しで詳細' : '押すと詳細'}）`}
    onClick={() => exited ? onSeat(seat.id) : onOpen(session, seat.id)}>
      {editing && <span className="editing-tag" aria-hidden="true">編集中</span>}
    {full ? <>
      <span className="corner tl">{number}</span>
      <span className="corner tr">{meta}</span>
      <span className="dial-box"><Dial dial={dial} label={meter} band={timeLimitOff ? null : bandOf(session)} /></span>
      <span className="corner bl">{stage}</span>
      <span className="corner br">{corner}</span>
    </> : <>
      {/* 低い卓・細い卓：左（細い卓は上）に卓番・段階・残り時間、右（下）に小さめの文字盤 */}
      <span className="info">
        <span className="info-head">{number}{meta}</span>
        {stage}
        <span className="remaining">{corner}</span>
      </span>
      <span className="dial-box"><Dial dial={dial} label={meter} band={timeLimitOff ? null : bandOf(session)} /></span>
    </>}
  </button>;
}
