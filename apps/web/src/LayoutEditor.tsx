import type { CSSProperties } from 'react';
import { GRID, type SeatKind } from '@table-check/core/layout';
import { LABEL_MAX_LENGTH, NOTICE_AREAS, type ShopLayout } from '@table-check/core/shopLayout';
import { LAYOUT_BLOCKS, useLayoutEditor } from '@table-check/core/useLayoutEditor';

type Box = { col: number; colSpan: number; row: number; rowSpan: number };
const area = (box: Box): CSSProperties => ({ gridColumn: `${box.col} / span ${box.colSpan}`, gridRow: `${box.row} / span ${box.rowSpan}` });

// 席の配置を作り直す画面（No.75。設定から開く）。中身（下書き・確かめ・保存）は core の useLayoutEditor で、iOS と同じ
export function LayoutEditor({ layout, occupied, onSave, onClose, inert }: { layout: ShopLayout; occupied: Set<string>; onSave(layout: ShopLayout): Promise<void>; onClose(): void; inert?: boolean }) {
  const { draft, block, setBlock, selected, select, seat, label, locked, isOccupied, pressCell, resize, remove, setSeatId, setSeatKind, setLabelText,
    conflict, reload, resetToDefault, changed, saving, canSave, save, status } = useLayoutEditor({ layout, occupied, onSave, onClose });
  const cells = [];
  for (let row = 1; row <= GRID.rows; row++) for (let col = 1; col <= GRID.cols; col++) {
    cells.push(<button key={`${col}-${row}`} className="layout-cell" style={area({ col, row, colSpan: 1, rowSpan: 1 })}
      aria-label={`${row}行${col}列（${seat || label ? 'ここへ動かす' : 'ここに置く'}）`} onClick={() => pressCell(col, row)} />);
  }
  return <section className="layout-editor" aria-labelledby="layout-title" inert={inert}>
    <div className="layout-head">
      <h1 id="layout-title" className="settings-title">席の配置</h1>
      <p className="settings-help">左のブロックを選んでマス目を押すと置けます。置いた卓を押すと、卓番・種類・大きさを変えたり、別のマスを押して動かしたりできます。</p>
    </div>
    <div className="layout-body">
      <div className="layout-side glass">
        {selected === null ? <>
          <h2 className="settings-group-title">ブロック</h2>
          <div className="layout-blocks" role="radiogroup" aria-label="置くブロック">
            {LAYOUT_BLOCKS.map(b => <button key={b.key} role="radio" aria-checked={block === b.key} className="layout-block" onClick={() => setBlock(b.key)}>
              <span className={`layout-block-shape ${b.kind}`} style={{ width: b.colSpan * 12, height: b.rowSpan * 12 }} aria-hidden="true" />{b.name}
            </button>)}
          </div>
        </> : <>
          <h2 className="settings-group-title">{seat ? `${seat.id}番` : `「${label?.text}」`}を直す</h2>
          {seat && <>
            <label className="field-label" htmlFor="layout-id">卓番</label>
            <input id="layout-id" className="field-select" inputMode="numeric" value={seat.id} disabled={locked}
              onChange={event => setSeatId(event.target.value)} />
            <label className="field-label" htmlFor="layout-kind">種類</label>
            <select id="layout-kind" className="field-select" value={seat.kind} onChange={event => setSeatKind(event.target.value as SeatKind)}>
              <option value="table">テーブル</option><option value="counter">カウンター席</option>
            </select>
            {locked && <p className="settings-help">お客さんがいる卓なので、卓番を変えたり消したりできません（動かす・大きさを変えるのはできます）</p>}
          </>}
          {label && <>
            <label className="field-label" htmlFor="layout-text">ことば</label>
            <input id="layout-text" className="field-select" maxLength={LABEL_MAX_LENGTH} value={label.text} onChange={event => setLabelText(event.target.value)} />
          </>}
          {/* No.75：テーブルの大きさを大きく・小さくできるように（ユーザーの希望） */}
          <div className="layout-size" role="group" aria-label="大きさ">
            <span>幅</span><button className="panel-button small" aria-label="幅を狭く" onClick={() => resize(-1, 0)}>−</button><strong>{(seat ?? label)!.colSpan}マス</strong><button className="panel-button small" aria-label="幅を広く" onClick={() => resize(1, 0)}>＋</button>
            <span>高さ</span><button className="panel-button small" aria-label="高さを低く" onClick={() => resize(0, -1)}>−</button><strong>{(seat ?? label)!.rowSpan}マス</strong><button className="panel-button small" aria-label="高さを高く" onClick={() => resize(0, 1)}>＋</button>
          </div>
          <p className="settings-help">動かすときは、マス目の空いているところを押します。</p>
          <div className="panel-actions">
            <button className="panel-button" onClick={() => select(null)}>直し終わる</button>
            <button className="panel-button danger" disabled={locked} onClick={remove}>消す</button>
          </div>
        </>}
      </div>
      <div className="layout-grid" style={{ '--cols': GRID.cols, '--rows': GRID.rows } as CSSProperties}>
        {cells}
        {NOTICE_AREAS.map((notice, i) => <div key={i} className="layout-notice" style={area(notice)} aria-hidden="true">{i === 0 ? '通知の場所' : '縦向きの通知'}</div>)}
        {draft.labels.map((l, i) => <button key={`label-${i}`} className={`layout-item label ${selected?.type === 'label' && selected.index === i ? 'selected' : ''}`} style={area(l)}
          aria-label={`ことば「${l.text}」（押すと直す）`} onClick={() => select({ type: 'label', index: i })}>{l.text}</button>)}
        {draft.seats.map((s, i) => <button key={`seat-${i}`} className={`layout-item ${s.kind} ${selected?.type === 'seat' && selected.index === i ? 'selected' : ''} ${isOccupied(i) ? 'occupied' : ''}`} style={area(s)}
          aria-label={`${s.id}番 ${s.kind === 'table' ? 'テーブル' : 'カウンター席'}（押すと直す）`} onClick={() => select({ type: 'seat', index: i })}>{s.id}</button>)}
      </div>
    </div>
    <div className="layout-foot">
      <p className="layout-message" role="status">{status}</p>
      {conflict && <button className="panel-button" disabled={saving} onClick={reload}>最新を読み込む</button>}
      <button className="panel-button" onClick={resetToDefault}>最初の配置に戻す</button>
      <button className="panel-button" onClick={onClose}>{changed ? '保存せずにもどる' : 'もどる'}</button>
      <button className="panel-button primary" disabled={!canSave} onClick={save}>{saving ? '保存しています…' : '保存して使う'}</button>
    </div>
  </section>;
}
