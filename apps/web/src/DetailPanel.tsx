import { useEffect, useRef, useState } from 'react';
import { alertOf, limitsOf, clockTimeNear, dishProgress, displayOf, formatClock, formatElapsed, nextStatus, STATUS_LABEL, timerOf, type Course, type EditableTime, sessionRules, type Rules, type Session, REASON_LABEL } from '@table-check/core/domain';
import type { ShopSettings } from '@table-check/core/shopSettings';
import { CoursePicker } from './CoursePicker';
import { MenuPicker } from './MenuPicker';
import { GuestPicker } from './GuestPicker';
import { remainingLabel, remainingOf } from '@table-check/core/dial';
import { CloseButton } from './CloseButton';
import { menuOf } from '@table-check/core/courseMenus';
import { useBeside } from './placeBeside';


interface Props {
  session: Session;
  time: number;
  othersEditing?: boolean;   // ほかの端末でもこの卓の詳細を開いている（No.72）
  settings: ShopSettings;   // 店の設定（時間のルール・飲み放題の区分・コース。No.14・No.89・No.90）
  onClose(): void;
  onNext(session: Session): void;
  onSeat(tableId: string): void;  // 退店済の卓に次のお客さんを案内する
  onBack(session: Session): void;
  onRetime(session: Session, field: EditableTime, at: number): boolean;
  onPay(session: Session): void;
  onGuests(session: Session, guests: number | null): void;
  onLeaveAt(session: Session, at: number | null): boolean;   // この卓の退店の時刻を決める（null でふつうに戻す）
  onCourse(session: Session, course: Course | null): void;
  onMenu(session: Session, menu: string | null): void;
  onServe(session: Session): void;     // コースの次の料理を出した
  onUnserve(session: Session): void;   // 1品戻す
  from: string;                 // パネルを開いた卓（移動するのはこの卓）
  onPick(mode: 'move' | 'add'): void;
  onRelease(session: Session, tableId: string): void;
  returnFocus: HTMLElement | null;
  anchor: DOMRect | null;       // 押した卓の位置。そのそばに出す（無ければ真ん中）
}
function TimeRow({ label, value, order, onSave }: { label: string; value: number | null; order: string; onSave(hhmm: string): boolean }) {
  const [draft, setDraft] = useState(value === null ? '' : formatClock(value));
  const [error, setError] = useState(false);
  if (value === null) return <div className="time-row"><span>{label}</span><span className="muted">未提供</span></div>;
  const changed = draft !== formatClock(value);
  return <div className="time-row">
    <label htmlFor={`time-${label}`}>{label}</label>
    <input id={`time-${label}`} type="time" value={draft} onChange={event => { setDraft(event.target.value); setError(false); }} />
    <button className="panel-button" disabled={!changed} onClick={() => setError(!onSave(draft))}>修正</button>
    {error && <span className="time-error" role="alert">{order} の順になる時刻にしてください</span>}
  </div>;
}
// 退店の時刻（No.80）：時間によって早めに退店してもらう卓だけ決める。L.O.はその「お席の時間 − L.O.」（ふつう30分）前になる。
// ふつうは数え始めからお席の時間（120分）の時刻を出し、「決める」で保存、「ふつうに戻す」で消す
function LeaveRow({ session, rules, onSave }: { session: Session; rules: Rules; onSave(at: number | null): boolean }) {
  const limits = limitsOf(session, rules);
  const value = limits?.seatEndAt ?? null;
  const [draft, setDraft] = useState(value === null ? '' : formatClock(value));
  const [error, setError] = useState(false);
  if (value === null) return <div className="time-row"><span>退店</span><span className="muted">ファーストドリンクのあとで決められます</span></div>;
  const changed = draft !== formatClock(value);
  return <div className="time-row leave-row">
    <label htmlFor="time-leave">退店</label>
    <input id="time-leave" type="time" value={draft} aria-describedby="leave-help" onChange={event => { setDraft(event.target.value); setError(false); }} />
    <button className="panel-button" disabled={!changed} onClick={() => { const at = clockTimeNear(draft, value); setError(at === null || !onSave(at)); }}>決める</button>
    <span id="leave-help" className="leave-help">{session.leaveAt === null ? `ふつう（${rules.seatLimitMin}分）。早めに退店してもらう卓だけ決めます` : `L.O.は ${formatClock(limits!.lastOrderAt)}`}
      {session.leaveAt !== null && <button className="text-button" onClick={() => { setError(false); onSave(null); }}>ふつうに戻す</button>}</span>
    {error && <span className="time-error" role="alert">案内より後の時刻にしてください</span>}
  </div>;
}
export function DetailPanel({ session, time, othersEditing = false, settings, onClose, onNext, onSeat, onBack, onRetime, onPay, onGuests, onLeaveAt, onCourse, onMenu, onServe, onUnserve, from, onPick, onRelease, returnFocus, anchor }: Props) {
  const panel = useRef<HTMLElement>(null);
  // 開いたらパネルにフォーカスを移し、閉じたら開く前の要素に戻す（背景は App 側で inert）
  useEffect(() => {
    panel.current?.focus();
    return () => returnFocus?.focus();
  }, [returnFocus]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // 長押しで開いた直後の指離しで閉じないよう、背景で押し始めたときだけ閉じる
  const downOnBackdrop = useRef(false);
  // 長押しで開いた直後、指を離したときのクリックが指の下のボタンに届かないよう、
  // パネル内で押し始めたクリックだけを受け付ける（キーボード操作のクリックは detail が 0）
  const downInPanel = useRef(false);
  const timer = timerOf(session, time);
  const next = nextStatus(session.status);
  // その卓に使う時間のルール（コースごとの L.O.・お席の時間。No.89）
  const rules = sessionRules(settings, session, settings.courseMenus);
  const display = displayOf(session.status, session.course, rules);
  // コースはお通しを出さず、同じ欄にファーストドリンクの時刻を入れる
  // お通しを出さない店（No.14）も同じ欄にファーストドリンクの時刻を入れる
  const otoshi = session.course === null && rules.otoshi;
  const otoshiLabel = otoshi ? 'お通し' : 'ドリンク';
  const order = `案内 → ${otoshi ? 'お通し' : 'ファーストドリンク'} → L.O.確認・現在`;
  const progress = dishProgress(session, settings.courseMenus);
  const dishes = menuOf(session.menu, settings.courseMenus)?.dishes ?? [];
  const save = (field: EditableTime, near: number) => (hhmm: string) => {
    const at = clockTimeNear(hhmm, near);
    return at !== null && onRetime(session, field, at);
  };
  const alert = alertOf(session, time, rules);
  const remaining = remainingOf(session, time, rules);
  const paid = session.paidAt !== null;
  // 押した卓のそばに出す（中身の高さで位置を決め直す）
  const place = useBeside(panel, anchor);
  return <div className={`panel-backdrop ${place ? 'beside' : ''}`}
    onPointerDown={event => { downOnBackdrop.current = event.target === event.currentTarget; }}
    onClick={event => { if (downOnBackdrop.current && event.target === event.currentTarget) onClose(); downOnBackdrop.current = false; }}>
    <section ref={panel} tabIndex={-1} className={`panel detail-panel ${place ? `beside-${place.side}` : ''}`} style={place?.panel}
      onPointerDownCapture={() => { downInPanel.current = true; }}
      onClickCapture={event => { if (!downInPanel.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); } downInPanel.current = false; }}
      role="dialog" aria-modal="true" aria-labelledby="panel-title">
      {/* No.71：いちばん見てほしいのは「次にやること」1つ。大きいボタンはそれだけにし、戻す・お会計は小さく、ほかは「変更する」にしまう */}
      <div className={`panel-head ${alert.level !== 'none' ? `alert-${alert.level}` : ''}`}>
        <h2 id="panel-title" className="panel-title"><span className="panel-seat">{session.tableIds.join('・')}番</span> <span className="panel-status">{STATUS_LABEL[display]}</span></h2>
        <span className="timer">{timer.label} {timer.elapsedMs === null ? '--:--' : formatElapsed(timer.elapsedMs)}{remaining && <span className="panel-remaining"> ・ {remainingLabel(remaining)}</span>}</span>
        {othersEditing && <p className="panel-editing" role="status">ほかの端末でもこの卓を開いています。操作がぶつからないよう声をかけてください</p>}
        {/* 退店の時刻を決めた卓は、変更するを開かなくても分かるように出す */}
        {session.leaveAt !== null && <span className="panel-leave">退店 {formatClock(session.leaveAt)}</span>}
        {alert.reason && <span className="badge">{REASON_LABEL[alert.reason]}</span>}
      </div>
      {next ? <button className="panel-button primary panel-next" onClick={() => onNext(session)}>{STATUS_LABEL[displayOf(next, session.course, rules)]}</button>
        : session.status === 'exited' && <button className="panel-button primary panel-next" onClick={() => { onSeat(from); onClose(); }}>{session.tableIds.length > 1 ? `${from}番にご案内` : 'ご案内'}</button>}
      <div className="panel-quick">
        <button className="text-button" onClick={() => onBack(session)}>{session.status === 'seated' ? '案内を取り消す' : '1つ戻す'}</button>
        {/* お会計：今の状態を左に、押すと切り替える */}
        <span className={`pay-state ${paid ? '' : 'muted'}`} id="panel-pay">{paid ? `会計済（${formatClock(session.paidAt ?? 0)}）` : '未払い'}</span>
        <button className="panel-button small" aria-pressed={paid} aria-describedby="panel-pay" onClick={() => onPay(session)}>{paid ? '未払いに戻す' : 'お会計済みにする'}</button>
      </div>
      {session.course !== null && <section className="panel-section" aria-labelledby="panel-dishes">
        <h3 id="panel-dishes" className="panel-heading">料理{progress && <span className="panel-heading-sub">{progress.served}/{progress.total}品</span>}</h3>
        {progress ? <>
          {/* 料理はメニューの順に1品ずつ進める。進みのバーと次に出す料理 */}
          <div className="dish-bar" role="progressbar" aria-label="料理の進み" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.served}
            aria-valuetext={`${progress.total}品中${progress.served}品提供済み`}><span style={{ width: `${progress.total === 0 ? 0 : progress.served / progress.total * 100}%` }} /></div>
          <p className="dish-next">{progress.next === null ? '全部出しました' : <>次：<strong>{progress.next}</strong></>}</p>
          <div className="panel-actions">
            <button className="panel-button" disabled={progress.served === 0} onClick={() => onUnserve(session)}>1品戻す</button>
            <button className="panel-button primary" disabled={progress.next === null} onClick={() => onServe(session)}>
              {progress.next === null ? '全部出しました' : `${progress.served + 1}品目を出した`}
            </button>
          </div>
          <details className="dish-details">
            <summary>料理をすべて見る</summary>
            <ol className="dish-list" aria-label={`料理 ${progress.total}品中${progress.served}品提供済み`}>
              {dishes.map((dish, i) => <li key={i} className={i < progress.served ? 'served' : i === progress.served ? 'next' : ''} aria-current={i === progress.served ? 'step' : undefined}>
                <span className="dish-mark" aria-hidden="true">{i < progress.served ? '✓' : i + 1}</span>{dish}
              </li>)}
            </ol>
          </details>
        </> : <>
          {/* どのコースかが未定なら、ここで選ぶと料理の進みを付けられる */}
          <div className="field-rows">
            <label className="field-label" htmlFor="panel-menu-now">どのコース</label>
            <MenuPicker id="panel-menu-now" value={session.menu} menus={settings.courseMenus} onChange={menu => onMenu(session, menu)} />
          </div>
        </>}
      </section>}
      {/* 変更する：人数・コース・時刻の修正・卓の移動と団体。ふだんは閉じておく */}
      <details className="panel-change">
        <summary className="panel-heading">変更する（人数・コース・時刻・卓）</summary>
        <div className="change-body">
          <div className="time-row">
            <label htmlFor="panel-guests">人数</label>
            <GuestPicker id="panel-guests" value={session.guests} onChange={guests => onGuests(session, guests)} emptyLabel="未入力" />
          </div>
          <div className="time-row">
            <label htmlFor="panel-course">コース</label>
            <CoursePicker id="panel-course" value={session.course} plans={settings.drinkPlans} onChange={course => onCourse(session, course)} />
          </div>
          {session.course !== null && progress && <div className="time-row">
            <label htmlFor="panel-menu">料理</label>
            <MenuPicker id="panel-menu" value={session.menu} menus={settings.courseMenus} onChange={menu => onMenu(session, menu)} />
          </div>}
          <TimeRow key={`seated-${session.seatedAt}`} label="案内" value={session.seatedAt} order={order} onSave={save('seatedAt', session.seatedAt)} />
          <TimeRow key={`otoshi-${session.otoshiAt}`} label={otoshiLabel} value={session.otoshiAt} order={order} onSave={save('otoshiAt', session.otoshiAt ?? session.seatedAt)} />
          <LeaveRow key={`leave-${limitsOf(session, rules)?.seatEndAt}`} session={session} rules={rules} onSave={at => onLeaveAt(session, at)} />
          <div className="time-row">
            <span id="panel-tables">卓</span>
            <span className="table-chips" role="group" aria-labelledby="panel-tables">
              {session.tableIds.map(id => <span key={id} className="table-chip">{id}番
                {session.tableIds.length > 1 && <button className="chip-remove" aria-label={`${id}番を団体から外す`} onClick={() => onRelease(session, id)}>×</button>}
              </span>)}
            </span>
          </div>
          <div className="panel-actions">
            <button className="panel-button" onClick={() => onPick('move')}>{from}番を移動</button>
            <button className="panel-button" onClick={() => onPick('add')}>卓を追加（団体）</button>
          </div>
        </div>
      </details>
      <CloseButton onClick={onClose} />
    </section>
    {place && <span className={`panel-arrow ${place.side}`} aria-hidden="true" style={place.arrow} />}
  </div>;
}
