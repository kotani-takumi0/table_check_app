import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { GRID, type SeatKind } from '@table-check/core/layout';
import { cellAt, DRAG_THRESHOLD, dragBox, sameBox, type Cell, type DragKind } from '@table-check/core/layoutDrag';
import { LABEL_MAX_LENGTH, NOTICE_AREAS, type ShopLayout } from '@table-check/core/shopLayout';
import { LAYOUT_BLOCKS, useLayoutEditor } from '@table-check/core/useLayoutEditor';

type Box = { col: number; colSpan: number; row: number; rowSpan: number };
type Target = { type: 'seat' | 'label'; index: number };
// マス目の内側の余白とマスの間（App.css の .layout-grid の padding・gap と同じ値）
const GRID_PADDING = 8, GRID_GAP = 4;
const area = (box: Box): CSSProperties => ({ gridColumn: `${box.col} / span ${box.colSpan}`, gridRow: `${box.row} / span ${box.rowSpan}` });

// 席の配置を作り直す画面（No.75。設定から開く）。中身（下書き・確かめ・保存）は core の useLayoutEditor で、iOS と同じ
export function LayoutEditor({ layout, occupied, onSave, onClose, inert }: { layout: ShopLayout; occupied: Set<string>; onSave(layout: ShopLayout): Promise<void>; onClose(): void; inert?: boolean }) {
  const { draft, block, setBlock, selected, select, seat, label, locked, isOccupied, pressCell, resize, canPlace, placeAt, remove, setSeatId, setSeatKind, setLabelText,
    conflict, reload, resetToDefault, changed, saving, canSave, save, status } = useLayoutEditor({ layout, occupied, onSave, onClose });
  // ドラッグ（No.93）：置いた卓・ことばをつかんで動かし、選んでいるものは右下のつまみで大きさを変える。
  // 指を離すまでは下書きを変えず、行き先を影で見せる（置けない場所は朱）。少ししか動かさなければ、今までどおり押して選ぶ
  const grid = useRef<HTMLDivElement>(null);
  const drag = useRef<{ target: Target; kind: DragKind; item: Box; start: Cell; x: number; y: number; moved: boolean; box: Box } | null>(null);
  const [preview, setPreview] = useState<{ target: Target; box: Box } | null>(null);
  // ドラッグのあとに届く「押した」は受けない（置けなかった理由を消さないため）
  const dragged = useRef(false);
  const press = (target: Target) => { if (dragged.current) { dragged.current = false; return; } select(target); };
  const cellOf = (event: PointerEvent) => {
    const rect = grid.current!.getBoundingClientRect();
    return cellAt(event.clientX - rect.left - GRID_PADDING, event.clientY - rect.top - GRID_PADDING, rect.width - GRID_PADDING * 2, rect.height - GRID_PADDING * 2, GRID_GAP);
  };
  const startDrag = (event: PointerEvent, target: Target, item: Box, kind: DragKind) => {
    dragged.current = false;
    if (event.button !== 0 || !grid.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { target, kind, item, start: cellOf(event), x: event.clientX, y: event.clientY, moved: false, box: item };
  };
  const moveDrag = (event: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(event.clientX - d.x, event.clientY - d.y) < DRAG_THRESHOLD) return;
    d.moved = true;
    d.box = dragBox(d.kind, d.item, d.start, cellOf(event));
    setPreview({ target: d.target, box: d.box });
  };
  const endDrag = (cancel: boolean) => {
    const d = drag.current;
    drag.current = null;
    dragged.current = Boolean(d?.moved && !cancel);
    if (d?.moved && !cancel && !sameBox(d.box, d.item)) placeAt(d.target, d.box);
    else if (d?.moved && !cancel) select(d.target);
    setPreview(null);
  };
  const dragProps = (target: Target, item: Box, kind: DragKind) => ({
    onPointerDown: (event: PointerEvent) => startDrag(event, target, item, kind),
    onPointerMove: moveDrag,
    onPointerUp: () => endDrag(false),
    onPointerCancel: () => endDrag(true),
  });
  const isDragged = (target: Target) => preview?.target.type === target.type && preview.target.index === target.index;
  const selectedBox = seat ?? label;
  const cells = [];
  for (let row = 1; row <= GRID.rows; row++) for (let col = 1; col <= GRID.cols; col++) {
    cells.push(<button key={`${col}-${row}`} className="layout-cell" style={area({ col, row, colSpan: 1, rowSpan: 1 })}
      aria-label={`${row}行${col}列（${seat || label ? 'ここへ動かす' : 'ここに置く'}）`} onClick={() => pressCell(col, row)} />);
  }
  return <section className="layout-editor" aria-labelledby="layout-title" inert={inert}>
    <div className="layout-head">
      <h1 id="layout-title" className="settings-title">席の配置</h1>
      <p className="settings-help">左のブロックを選んでマス目を押すと置けます。置いた卓はつかんで動かせます。押すと、卓番・種類・大きさを変えられます。</p>
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
          <p className="settings-help">動かすときは、つかんで動かすか、マス目の空いているところを押します。右下の丸をつかむと大きさを変えられます。</p>
          <div className="panel-actions">
            <button className="panel-button" onClick={() => select(null)}>直し終わる</button>
            <button className="panel-button danger" disabled={locked} onClick={remove}>消す</button>
          </div>
        </>}
      </div>
      <div ref={grid} className="layout-grid" style={{ '--cols': GRID.cols, '--rows': GRID.rows } as CSSProperties}>
        {cells}
        {NOTICE_AREAS.map((notice, i) => <div key={i} className="layout-notice" style={area(notice)} aria-hidden="true">{i === 0 ? '通知の場所' : '縦向きの通知'}</div>)}
        {draft.labels.map((l, i) => <button key={`label-${i}`} className={`layout-item label ${selected?.type === 'label' && selected.index === i ? 'selected' : ''} ${isDragged({ type: 'label', index: i }) ? 'dragging' : ''}`} style={area(l)}
          aria-label={`ことば「${l.text}」（押すと直す）`} onClick={() => press({ type: 'label', index: i })} {...dragProps({ type: 'label', index: i }, l, 'move')}>{l.text}</button>)}
        {draft.seats.map((s, i) => <button key={`seat-${i}`} className={`layout-item ${s.kind} ${selected?.type === 'seat' && selected.index === i ? 'selected' : ''} ${isOccupied(i) ? 'occupied' : ''} ${isDragged({ type: 'seat', index: i }) ? 'dragging' : ''}`} style={area(s)}
          aria-label={`${s.id}番 ${s.kind === 'table' ? 'テーブル' : 'カウンター席'}（押すと直す）`} onClick={() => press({ type: 'seat', index: i })} {...dragProps({ type: 'seat', index: i }, s, 'move')}>{s.id}</button>)}
        {/* 大きさを変えるつまみ：選んでいる卓・ことばの右下の角。キーボードでは左の幅・高さの −／＋ を使う。
            つかんでいる間も消さない（消すと指を離したことが届かない） */}
        {selected && selectedBox && <div className={`layout-handle ${preview ? 'hidden' : ''}`} aria-hidden="true"
          style={area({ col: selectedBox.col + selectedBox.colSpan - 1, row: selectedBox.row + selectedBox.rowSpan - 1, colSpan: 1, rowSpan: 1 })}
          {...dragProps(selected, selectedBox, 'resize')}><span /></div>}
        {preview && <div className={`layout-ghost ${canPlace(preview.target, preview.box) ? '' : 'blocked'}`} aria-hidden="true" style={area(preview.box)} />}
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
