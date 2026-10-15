import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { alertOf, dishProgress, displayOf, drinkPlanName, isPickable, sessionRules, STATUS_LABEL, STATUS_SHORT, type Session, REASON_LABEL } from '@table-check/core/domain';
import type { ShopSettings } from '@table-check/core/shopSettings';
import { bandOf, dialLabel, dialOf, formatHourMinute, remainingLabel, remainingOf } from '@table-check/core/dial';
import type { Seat } from '@table-check/core/layout';
import { Ruler } from './Ruler';

interface CardProps {
  seat: Seat;
  session?: Session;
  time: number;
  onSeat(tableId: string): void;
  onOpen(session: Session, from: string): void;
  editing?: boolean;   // ほかの端末でこの卓の詳細を開いている（No.72）
  settings: ShopSettings;   // 店の設定（時間のルール・飲み放題の区分・コース。No.14・No.89・No.90）
  mini: boolean;   // スマホ：卓番・段階・時:分だけ出し、タップで詳細パネル
  picking: boolean; // 移動先・追加先を選んでいる間：空席と退店済みの卓だけ押せる（No.133）
  selected?: boolean; // 詳細・ご案内を開いている卓（緑の枠で囲む。No.107）
  flashing?: boolean; // 通知のベルで動かした卓を、少しのあいだ光らせる（No.146）
}
// 卓カード（No.107）。卓番・人数・区分・大きな経過・120分の物差し（L.O.の目盛り付き）と、下に段階の帯。
// テーブルはタップで詳細パネル（退店済はご案内）、カウンターはタップで次の状態へ。どちらも長押し（600ms）で詳細パネル
export function SeatCard({ seat, session, time, editing = false, settings, onSeat, onOpen, mini, picking, selected = false, flashing = false }: CardProps) {
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
  const modes = `${mini ? 'mini' : ''} ${seat.colSpan === 1 ? 'slim' : ''} ${picking ? isPickable(session) ? 'pick-target' : 'pick-disabled' : ''} ${pressing ? 'pressing' : ''} ${selected ? 'selected' : ''} ${flashing ? 'seat-flash' : ''}`;
  if (!session) {
    return <button {...handlers} className={`card ${shape} empty ${modes}`} aria-label={picking ? `${seat.id}番を選ぶ` : `${seat.id}番 ご案内`} onClick={() => onSeat(seat.id)}>
      <span className="seat-number">{seat.id}</span>
    </button>;
  }
  // 移動先・追加先を選んでいる間は、退店済みの卓も空席と同じ形で出し、押すと選ぶ（No.133）
  if (picking && session.status === 'exited') {
    return <button {...handlers} className={`card ${shape} empty ${modes}`} aria-label={`${seat.id}番を選ぶ（退店済）`} onClick={() => onSeat(seat.id)}>
      <span className="seat-number">{seat.id}</span>
    </button>;
  }
  // その卓に使う時間のルール（コースごとの L.O.・お席の時間。No.89）
  const rules = sessionRules(settings, session, settings.courseMenus);
  const alert = alertOf(session, time, rules);
  const dial = dialOf(session, time, rules);
  const remaining = remainingOf(session, time, rules);
  const exited = session.status === 'exited';
  const paid = session.paidAt !== null;
  // コースの「開始待ち」「ファーストドリンク提供済み」は通常と名前を変える（色は変えない）
  const display = displayOf(session.status, session.course, rules);
  // 卓の色は警告の段階だけで決める（もうすぐ＝橙、いま対応＝赤）。ふだんは白と黒だけで、退店済は全体を薄くする
  const tone = alert.level !== 'none' ? `alert-${alert.level}` : exited ? 'exited' : '';
  // 団体：同じセッションの他の卓番を添える
  const others = session.tableIds.filter(id => id !== seat.id);
  const groupMark = others.length > 0 ? `+${others.length <= 2 ? others.join('+') : `${others.length}卓`}` : '';
  const group = others.length > 0 ? `（${session.tableIds.join('・')}番の団体）` : '';
  // 人数・コースの料理の進みはテーブル卓だけ。団体はどの卓にも全員の人数を出す
  const guests = seat.kind === 'table' ? session.guests : undefined;
  const progress = seat.kind === 'table' ? dishProgress(session, settings.courseMenus) : null;
  // 右下：L.O.まで・退席まで。退店済は「押すとご案内」、お通し前・コースの開始待ちはタイマー停止中
  const corner = remaining ? remainingLabel(remaining)
    : exited ? '押すとご案内'
      : 'タイマー停止中';
  const meter = dialLabel(dial, remaining);
  const label = `${editing ? 'ほかの端末で編集中 ' : ''}${seat.id}番${group}${guests === undefined ? '' : guests === null ? ' 人数未入力' : ` ${guests}名`} ${STATUS_LABEL[display]} ${meter}${alert.reason ? ` ${REASON_LABEL[alert.reason]}` : ''}${paid ? ' お会計済み' : ''}`;
  const className = `card ${shape} occupied ${tone} ${modes} ${editing ? 'editing' : ''}`;
  const number = <span className="seat-number">{seat.id}{groupMark && <span className="group-mark">{groupMark}</span>}</span>;

  const ruler = <Ruler dial={dial} label={meter} lo={rules.timeLimitOff ? null : bandOf(session, rules).from} />;
  const elapsed = <span className={`elapsed ${dial.elapsedMin === null ? 'waiting' : ''}`} aria-hidden="true">{dial.elapsedMin === null ? '開始前' : formatHourMinute(dial.elapsedMin)}</span>;
  const tag = editing && <span className="editing-tag" aria-hidden="true">編集中</span>;
  // 下の帯：左に段階（警告のときは理由）、右に残り時間。警告の卓は帯を赤・橙で塗る
  const stageText = alert.reason ? REASON_LABEL[alert.reason] : STATUS_SHORT[display];
  const guestCount = guests !== undefined && <span className={`guest-count ${guests === null ? 'unknown' : ''}`}><span className="guest-num">{guests ?? '?'}</span>名</span>;
  if (mini || seat.kind === 'counter') {
    // スマホ・カウンター：上から卓番（人数）、経過、物差し、段階の帯。
    // カウンターは押すと詳細（退店済はご案内）。押しただけで状態が進むと、押し間違いや複数人での同時操作で気づかずに進んでしまうため（No.70）
    const onClick = mini ? () => onOpen(session, seat.id) : () => exited ? onSeat(seat.id) : onOpen(session, seat.id);
    const hint = mini ? '押すと詳細' : exited ? '押すとご案内、長押しで詳細' : '押すと詳細';
    return <button {...handlers} className={className} disabled={picking} aria-label={`${label}（${hint}）`} onClick={onClick}>
      {tag}
      <span className="card-body">
        <span className="seat-number">{seat.id}{groupMark && <span className="group-mark">{groupMark}</span>}{paid && <span className="paid-inline" aria-hidden="true">¥✓</span>}
          {mini && guestCount}</span>
        {elapsed}
        {ruler}
      </span>
      <strong className="card-status"><span className="stage">{stageText}</span></strong>
    </button>;
  }
  // 2行目：飲み放題の区分（通常）・コースの料理の進み・会計済
  const full = shape === 'table full';
  const sub = <span className="card-sub">
    {session.course === null ? '通常' : drinkPlanName(settings.drinkPlans, session.course)}
    {progress && <span className="dish-progress">・料理 {progress.served}/{progress.total}</span>}
    {paid && <span className="paid-meta">・会計済</span>}
  </span>;
  return <button {...handlers} className={className} disabled={picking} aria-label={`${label}（${exited ? '押すとご案内、長押しで詳細' : '押すと詳細'}）`}
    onClick={() => exited ? onSeat(seat.id) : onOpen(session, seat.id)}>
    {tag}
    {full ? <span className="card-body">
      {number}
      {guestCount}
      {sub}
      {elapsed}
      {ruler}
    </span> : shape === 'table low' ? <span className="card-body">
      {/* 低い卓（No.108。正方形のマスで高さが1マスしかない）：卓番・人数・段階・経過を1行に、その下に物差し。下の帯は出さない */}
      {number}
      <span className="who-inline">{guestCount}{paid && <span className="paid-inline" aria-hidden="true">¥✓</span>}</span>
      <span className="stage-inline">{stageText}</span>
      {elapsed}
      {ruler}
    </span> : <span className="card-body">
      {/* 細い卓（縦向き）：上から卓番・人数と区分・経過・物差し */}
      {number}
      <span className="who">{guestCount}{sub}</span>
      {elapsed}
      {ruler}
    </span>}
    <strong className="card-status"><span className="stage">{stageText}</span><span className="card-meta">{corner}</span></strong>
  </button>;
}
