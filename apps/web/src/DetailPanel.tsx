import { useEffect, useRef, useState } from 'react';
import { alertOf, clockTimeNear, dishProgress, displayOf, formatClock, formatElapsed, GUESTS_MAX, nextStatus, STATUS_LABEL, timerOf, type Course, type EditableTime, type Session, REASON_LABEL } from '@table-check/core/domain';
import { CoursePicker } from './CoursePicker';
import { MenuPicker } from './MenuPicker';
import { menuOf } from '@table-check/core/courseMenus';


interface Props {
  session: Session;
  time: number;
  onClose(): void;
  onNext(session: Session): void;
  onSeat(tableId: string): void;  // 退店済の卓に次のお客さんを案内する
  onBack(session: Session): void;
  onRetime(session: Session, field: EditableTime, at: number): boolean;
  onPay(session: Session): void;
  onGuests(session: Session, guests: number | null): void;
  onCourse(session: Session, course: Course | null): void;
  onMenu(session: Session, menu: string | null): void;
  onServe(session: Session): void;     // コースの次の料理を出した
  onUnserve(session: Session): void;   // 1品戻す
  from: string;                 // パネルを開いた卓（移動するのはこの卓）
  onPick(mode: 'move' | 'add'): void;
  onRelease(session: Session, tableId: string): void;
  returnFocus: HTMLElement | null;
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
export function DetailPanel({ session, time, onClose, onNext, onSeat, onBack, onRetime, onPay, onGuests, onCourse, onMenu, onServe, onUnserve, from, onPick, onRelease, returnFocus }: Props) {
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
  const display = displayOf(session.status, session.course);
  // コースはお通しを出さず、同じ欄にファーストドリンクの時刻を入れる
  const otoshiLabel = session.course === null ? 'お通し' : 'ドリンク';
  const order = `案内 → ${session.course === null ? 'お通し' : 'ファーストドリンク'} → L.O.確認・現在`;
  const progress = dishProgress(session);
  const dishes = menuOf(session.menu)?.dishes ?? [];
  const save = (field: EditableTime, near: number) => (hhmm: string) => {
    const at = clockTimeNear(hhmm, near);
    return at !== null && onRetime(session, field, at);
  };
  const alert = alertOf(session, time);
  const paid = session.paidAt !== null;
  return <div className="panel-backdrop"
    onPointerDown={event => { downOnBackdrop.current = event.target === event.currentTarget; }}
    onClick={event => { if (downOnBackdrop.current && event.target === event.currentTarget) onClose(); downOnBackdrop.current = false; }}>
    <section ref={panel} tabIndex={-1} className="panel"
      onPointerDownCapture={() => { downInPanel.current = true; }}
      onClickCapture={event => { if (!downInPanel.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); } downInPanel.current = false; }}
      role="dialog" aria-modal="true" aria-labelledby="panel-title">
      {/* よく使う順：状態と経過 → 段階を進める・戻す → お会計 → 料理 → 変更する（折りたたみ） */}
      <div className={`panel-head ${alert.level !== 'none' ? `alert-${alert.level}` : ''}`}>
        <h2 id="panel-title" className="panel-title"><span className="panel-seat">{session.tableIds.join('・')}番</span> <span className="panel-status">{STATUS_LABEL[display]}</span></h2>
        <span className="timer">{timer.label} {timer.elapsedMs === null ? '--:--' : formatElapsed(timer.elapsedMs)}</span>
        {alert.reason && <span className="badge">{REASON_LABEL[alert.reason]}</span>}
      </div>
      <div className="panel-actions">
        <button className="panel-button" onClick={() => onBack(session)}>{session.status === 'seated' ? '案内を取り消す' : '1つ戻す'}</button>
        {next ? <button className="panel-button primary" onClick={() => onNext(session)}>{STATUS_LABEL[displayOf(next, session.course)]}</button>
          : session.status === 'exited' && <button className="panel-button primary" onClick={() => { onSeat(from); onClose(); }}>{session.tableIds.length > 1 ? `${from}番にご案内` : 'ご案内'}</button>}
      </div>
      <section className="panel-section" aria-labelledby="panel-pay">
        <h3 id="panel-pay" className="panel-heading">お会計</h3>
        <div className="pay-row">
          <span className={paid ? '' : 'muted'}>{paid ? `お会計済み（${formatClock(session.paidAt ?? 0)}）` : '未払い'}</span>
          <button className="panel-button" aria-pressed={paid} onClick={() => onPay(session)}>{paid ? '未払いに戻す' : 'お会計済みにする'}</button>
        </div>
      </section>
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
          <span id="panel-menu-now" className="menu-question">どのコースですか？</span>
          <MenuPicker value={session.menu} onChange={menu => onMenu(session, menu)} labelledBy="panel-menu-now" />
        </>}
      </section>}
      {/* 変更する：人数・コース・時刻の修正・卓の移動と団体。ふだんは閉じておく */}
      <details className="panel-change">
        <summary className="panel-heading">変更する（人数・コース・時刻・卓）</summary>
        <div className="change-body">
          <div className="time-row">
            <span id="panel-guests">人数</span>
            <div className="guest-stepper" role="group" aria-labelledby="panel-guests">
              <button className="guest-step" aria-label="1名減らす" disabled={session.guests === null || session.guests <= 1} onClick={() => onGuests(session, (session.guests ?? 1) - 1)}>−</button>
              <span className={`guest-many ${session.guests === null ? 'muted' : ''}`} aria-live="polite">{session.guests === null ? '未入力' : `${session.guests}名`}</span>
              <button className="guest-step" aria-label="1名増やす" disabled={session.guests !== null && session.guests >= GUESTS_MAX} onClick={() => onGuests(session, (session.guests ?? 0) + 1)}>＋</button>
            </div>
          </div>
          <div className="time-row">
            <span id="panel-course">コース</span>
            <CoursePicker value={session.course} onChange={course => onCourse(session, course)} labelledBy="panel-course" />
          </div>
          {session.course !== null && progress && <div className="time-row">
            <span id="panel-menu">料理</span>
            <MenuPicker value={session.menu} onChange={menu => onMenu(session, menu)} labelledBy="panel-menu" />
          </div>}
          <TimeRow key={`seated-${session.seatedAt}`} label="案内" value={session.seatedAt} order={order} onSave={save('seatedAt', session.seatedAt)} />
          <TimeRow key={`otoshi-${session.otoshiAt}`} label={otoshiLabel} value={session.otoshiAt} order={order} onSave={save('otoshiAt', session.otoshiAt ?? session.seatedAt)} />
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
      <div className="panel-actions">
        <button className="panel-button" onClick={onClose}>閉じる</button>
      </div>
    </section>
  </div>;
}
