import { useEffect, useRef, useState } from 'react';
import { clockTimeNear, formatClock, formatElapsed, nextStatus, STATUS_LABEL, timerOf, type EditableTime, type Session } from './domain';

interface Props {
  session: Session;
  time: number;
  onClose(): void;
  onNext(session: Session): void;
  onBack(session: Session): void;
  onRetime(session: Session, field: EditableTime, at: number): boolean;
  onPay(session: Session): void;
  from: string;                 // パネルを開いた卓（移動するのはこの卓）
  onPick(mode: 'move' | 'add'): void;
  onRelease(session: Session, tableId: string): void;
  returnFocus: HTMLElement | null;
}
function TimeRow({ label, value, onSave }: { label: string; value: number | null; onSave(hhmm: string): boolean }) {
  const [draft, setDraft] = useState(value === null ? '' : formatClock(value));
  const [error, setError] = useState(false);
  if (value === null) return <div className="time-row"><span>{label}</span><span className="muted">未提供</span></div>;
  const changed = draft !== formatClock(value);
  return <div className="time-row">
    <label htmlFor={`time-${label}`}>{label}</label>
    <input id={`time-${label}`} type="time" value={draft} onChange={event => { setDraft(event.target.value); setError(false); }} />
    <button className="panel-button" disabled={!changed} onClick={() => setError(!onSave(draft))}>修正</button>
    {error && <span className="time-error" role="alert">案内 → お通し → L.O.確認・現在 の順になる時刻にしてください</span>}
  </div>;
}
export function DetailPanel({ session, time, onClose, onNext, onBack, onRetime, onPay, from, onPick, onRelease, returnFocus }: Props) {
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
  const save = (field: EditableTime, near: number) => (hhmm: string) => {
    const at = clockTimeNear(hhmm, near);
    return at !== null && onRetime(session, field, at);
  };
  return <div className="panel-backdrop"
    onPointerDown={event => { downOnBackdrop.current = event.target === event.currentTarget; }}
    onClick={event => { if (downOnBackdrop.current && event.target === event.currentTarget) onClose(); downOnBackdrop.current = false; }}>
    <section ref={panel} tabIndex={-1} className="panel"
      onPointerDownCapture={() => { downInPanel.current = true; }}
      onClickCapture={event => { if (!downInPanel.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); } downInPanel.current = false; }}
      role="dialog" aria-modal="true" aria-label={`${session.tableIds.join('・')}番の詳細`}>
      <div className="panel-head">
        <span className="panel-seat">{session.tableIds.join('・')}番</span>
        <strong className="panel-status" style={{ color: `var(--${session.status})` }}>{STATUS_LABEL[session.status]}</strong>
        <span className="timer">{timer.label} {formatElapsed(timer.elapsedMs)}</span>
      </div>
      <TimeRow key={`seated-${session.seatedAt}`} label="案内" value={session.seatedAt} onSave={save('seatedAt', session.seatedAt)} />
      <TimeRow key={`otoshi-${session.otoshiAt}`} label="お通し" value={session.otoshiAt} onSave={save('otoshiAt', session.otoshiAt ?? session.seatedAt)} />
      <div className="time-row">
        <span>お会計</span>
        <span className={session.paidAt === null ? '' : 'muted'}>{session.paidAt === null ? '未払い' : `お会計済み（${formatClock(session.paidAt)}）`}</span>
        <button className="panel-button" onClick={() => onPay(session)}>{session.paidAt === null ? 'お会計済みにする' : '未払いに戻す'}</button>
      </div>
      <div className="time-row">
        <span>卓</span>
        <span className="table-chips">
          {session.tableIds.map(id => <span key={id} className="table-chip">{id}番
            {session.tableIds.length > 1 && <button className="chip-remove" aria-label={`${id}番を団体から外す`} onClick={() => onRelease(session, id)}>×</button>}
          </span>)}
        </span>
      </div>
      <div className="panel-actions">
        <button className="panel-button" onClick={() => onPick('move')}>{from}番を移動</button>
        <button className="panel-button" onClick={() => onPick('add')}>卓を追加（団体）</button>
      </div>
      <div className="panel-actions">
        <button className="panel-button" onClick={() => onBack(session)}>{session.status === 'seated' ? '案内を取り消す' : '1つ戻す'}</button>
        {next && <button className="panel-button primary" onClick={() => onNext(session)}>{STATUS_LABEL[next]}</button>}
        <button className="panel-button" onClick={onClose}>閉じる</button>
      </div>
    </section>
  </div>;
}
