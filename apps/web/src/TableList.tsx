import { alertOf, dishProgress, displayOf, REASON_LABEL, STATUS_SHORT, type Session } from '@table-check/core/domain';
import { dialOf, formatHourMinute } from '@table-check/core/dial';
import { urgentOrder } from '@table-check/core/tableList';

interface Props {
  sessions: Session[];
  time: number;
  onOpen(session: Session, from: string): void;   // 行を押すと詳細パネル
  inert?: boolean;
}
// 全卓一覧：ツールバーの「一覧」で左から出す。フロアの上に重ねる（フロアは縮めない）。
// 急ぐ順（いま対応 → もうすぐ → 経過の長い順）に、卓番・段階・経過・人数・コース・料理の進みを並べる
export function TableList({ sessions, time, onOpen, inert }: Props) {
  const rows = urgentOrder(sessions, time);
  return <aside id="table-list" className="table-list glass" aria-label="全卓一覧" inert={inert}>
    <h2 className="table-list-title">全卓一覧 <span className="table-list-count">{rows.length}組</span></h2>
    {rows.length === 0 ? <p className="table-list-empty">ご案内中の卓はありません</p>
      : <ul className="table-list-rows">
        {rows.map(session => {
          const alert = alertOf(session, time);
          const dial = dialOf(session, time);
          const display = displayOf(session.status, session.course);
          const progress = dishProgress(session);
          const elapsed = session.status === 'exited' ? '退店済' : dial.elapsedMin === null ? '開始前' : formatHourMinute(dial.elapsedMin);
          const tables = session.tableIds.join('・');
          return <li key={session.id}>
            <button className={`table-row ${alert.level !== 'none' ? `alert-${alert.level}` : ''} ${session.status === 'exited' ? 'exited' : ''}`}
              aria-label={`${tables}番 ${STATUS_SHORT[display]} ${alert.reason ? REASON_LABEL[alert.reason] : ''} 経過${elapsed} ${session.guests === null ? '人数未入力' : `${session.guests}名`}${session.course !== null ? ' コース' : ''}${progress ? ` 料理${progress.served}/${progress.total}` : ''}（押すと詳細）`}
              onClick={() => onOpen(session, session.tableIds[0])}>
              <span className="table-row-number">{tables}</span>
              <span className="table-row-main">
                <span className="table-row-stage">{alert.reason ? <span className="badge">{REASON_LABEL[alert.reason]}</span> : <strong className="status">{STATUS_SHORT[display]}</strong>}</span>
                <span className="table-row-meta">{session.guests === null ? '人数未入力' : `${session.guests}名`}{session.course !== null && ' · コース'}{progress && ` · 料理 ${progress.served}/${progress.total}`}</span>
              </span>
              <span className="table-row-time">{elapsed}</span>
            </button>
          </li>;
        })}
      </ul>}
  </aside>;
}
