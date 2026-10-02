import { useMemo, useState, type CSSProperties } from 'react';
import { GRID, type Seat, type SeatKind } from '@table-check/core/layout';
import { DEFAULT_LAYOUT, LABEL_MAX_LENGTH, layoutProblems, nextSeatId, NOTICE_AREAS, overlaps, type LayoutLabel, type ShopLayout } from '@table-check/core/shopLayout';

// 左に並べるブロック（No.75）。選んでからマス目の空いているところを押すと置く。大きさはあとで幅・高さを変えられる
const BLOCKS = [
  { key: 'big', name: '大きいテーブル', kind: 'table', colSpan: 3, rowSpan: 2 },
  { key: 'long', name: '細長いテーブル', kind: 'table', colSpan: 3, rowSpan: 1 },
  { key: 'small', name: '小さいテーブル', kind: 'table', colSpan: 1, rowSpan: 1 },
  { key: 'counter', name: 'カウンター席', kind: 'counter', colSpan: 1, rowSpan: 1 },
  { key: 'label', name: 'ことば（カウンターなど）', kind: 'label', colSpan: 4, rowSpan: 1 },
] as const;
type BlockKey = typeof BLOCKS[number]['key'];
type Selected = { type: 'seat' | 'label'; index: number } | null;
type Box = { col: number; colSpan: number; row: number; rowSpan: number };
const area = (box: Box): CSSProperties => ({ gridColumn: `${box.col} / span ${box.colSpan}`, gridRow: `${box.row} / span ${box.rowSpan}` });
const fits = (box: Box) => box.col >= 1 && box.row >= 1 && box.col + box.colSpan - 1 <= GRID.cols && box.row + box.rowSpan - 1 <= GRID.rows;

// 席の配置を作り直す画面（No.75。設定から開く）。下書きを直して「保存して使う」で全端末に反映する。
// お客さんがいる卓（occupied）は、案内の記録とずれないよう卓番を変えたり消したりできない
// onSave は保存に失敗したら拒否する（そのときは下書きを残して、理由を出す）
export function LayoutEditor({ layout, occupied, onSave, onClose, inert }: { layout: ShopLayout; occupied: Set<string>; onSave(layout: ShopLayout): Promise<void>; onClose(): void; inert?: boolean }) {
  const [draft, setDraft] = useState<ShopLayout>(layout);
  const [block, setBlock] = useState<BlockKey | null>('big');
  const [selected, setSelected] = useState<Selected>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  // 使っている卓が配置から無くなると、案内中のお客さんが画面から消えるので保存させない
  const problems = useMemo(() => [...layoutProblems(draft),
    ...[...occupied].filter(id => !draft.seats.some(s => s.id === id)).map(id => `${id}番はお客さんがいるので残してください`)], [draft, occupied]);
  const changed = JSON.stringify(draft) !== JSON.stringify(layout);
  const seat = selected?.type === 'seat' ? draft.seats[selected.index] : undefined;
  const label = selected?.type === 'label' ? draft.labels[selected.index] : undefined;
  // ほかの卓・ことば・通知の場所と重ならず、マス目に収まるか（動かす・大きさを変えるものは自分を除いて調べる）
  const free = (box: Box, except?: Selected) => fits(box) && !NOTICE_AREAS.some(notice => overlaps(box, notice))
    && draft.seats.every((s, i) => (except?.type === 'seat' && except.index === i) || !overlaps(box, s))
    && draft.labels.every((l, i) => (except?.type === 'label' && except.index === i) || !overlaps(box, l));
  const updateSeat = (index: number, change: Partial<Seat>) => setDraft(d => ({ ...d, seats: d.seats.map((s, i) => i === index ? { ...s, ...change } : s) }));
  const updateLabel = (index: number, change: Partial<LayoutLabel>) => setDraft(d => ({ ...d, labels: d.labels.map((l, i) => i === index ? { ...l, ...change } : l) }));
  // 空いているマスを押した：選んでいる卓・ことばがあればそこへ動かし、無ければ選んでいるブロックを置く
  const pressCell = (col: number, row: number) => {
    setMessage('');
    if (seat || label) {
      const target = seat ?? label!;
      const box = { ...target, col, row };
      if (!free(box, selected)) { setMessage('そこには入りません（ほかの卓・通知の場所に重なるか、はみ出します）'); return; }
      if (selected?.type === 'seat') updateSeat(selected.index, { col, row }); else updateLabel((selected as { index: number }).index, { col, row });
      return;
    }
    const chosen = BLOCKS.find(b => b.key === block);
    if (!chosen) return;
    const box = { col, row, colSpan: chosen.colSpan, rowSpan: chosen.rowSpan };
    if (!free(box)) { setMessage('そこには入りません。空いているところを押すか、小さいブロックを選んでください'); return; }
    if (chosen.kind === 'label') {
      setDraft(d => ({ ...d, labels: [...d.labels, { text: 'ことば', ...box }] }));
      setSelected({ type: 'label', index: draft.labels.length });
      return;
    }
    const id = nextSeatId(draft, chosen.kind as SeatKind);
    setDraft(d => ({ ...d, seats: [...d.seats, { id, kind: chosen.kind as SeatKind, ...box }] }));
    setSelected({ type: 'seat', index: draft.seats.length });
  };
  // 大きさを変える（幅・高さをマス1つずつ）。入らなければ変えない
  const resize = (dCol: number, dRow: number) => {
    const target = seat ?? label;
    if (!target) return;
    const box = { ...target, colSpan: target.colSpan + dCol, rowSpan: target.rowSpan + dRow };
    if (box.colSpan < 1 || box.rowSpan < 1) return;
    if (!free(box, selected)) { setMessage('その大きさにすると、ほかの卓や通知の場所に重なるか、はみ出します'); return; }
    setMessage('');
    if (selected?.type === 'seat') updateSeat(selected.index, { colSpan: box.colSpan, rowSpan: box.rowSpan }); else updateLabel((selected as { index: number }).index, { colSpan: box.colSpan, rowSpan: box.rowSpan });
  };
  const remove = () => {
    if (selected?.type === 'seat') { const index = selected.index; setDraft(d => ({ ...d, seats: d.seats.filter((_, i) => i !== index) })); }
    else if (selected?.type === 'label') { const index = selected.index; setDraft(d => ({ ...d, labels: d.labels.filter((_, i) => i !== index) })); }
    setSelected(null);
  };
  const cells = [];
  for (let row = 1; row <= GRID.rows; row++) for (let col = 1; col <= GRID.cols; col++) {
    cells.push(<button key={`${col}-${row}`} className="layout-cell" style={area({ col, row, colSpan: 1, rowSpan: 1 })}
      aria-label={`${row}行${col}列（${seat || label ? 'ここへ動かす' : 'ここに置く'}）`} onClick={() => pressCell(col, row)} />);
  }
  // お客さんがいる卓は卓番の欄を押せないので、今の卓番で判断できる
  const locked = seat !== undefined && occupied.has(seat.id);
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
            {BLOCKS.map(b => <button key={b.key} role="radio" aria-checked={block === b.key} className="layout-block" onClick={() => setBlock(b.key)}>
              <span className={`layout-block-shape ${b.kind}`} style={{ width: b.colSpan * 12, height: b.rowSpan * 12 }} aria-hidden="true" />{b.name}
            </button>)}
          </div>
        </> : <>
          <h2 className="settings-group-title">{seat ? `${seat.id}番` : `「${label?.text}」`}を直す</h2>
          {seat && <>
            <label className="field-label" htmlFor="layout-id">卓番</label>
            <input id="layout-id" className="field-select" inputMode="numeric" value={seat.id} disabled={locked}
              onChange={event => updateSeat((selected as { index: number }).index, { id: event.target.value.replace(/\D/g, '').slice(0, 3) })} />
            <label className="field-label" htmlFor="layout-kind">種類</label>
            <select id="layout-kind" className="field-select" value={seat.kind} onChange={event => updateSeat((selected as { index: number }).index, { kind: event.target.value as SeatKind })}>
              <option value="table">テーブル</option><option value="counter">カウンター席</option>
            </select>
            {locked && <p className="settings-help">お客さんがいる卓なので、卓番を変えたり消したりできません（動かす・大きさを変えるのはできます）</p>}
          </>}
          {label && selected?.type === 'label' && <>
            <label className="field-label" htmlFor="layout-text">ことば</label>
            <input id="layout-text" className="field-select" maxLength={LABEL_MAX_LENGTH} value={label.text} onChange={event => updateLabel(selected.index, { text: event.target.value })} />
          </>}
          {/* No.75：テーブルの大きさを大きく・小さくできるように（ユーザーの希望） */}
          <div className="layout-size" role="group" aria-label="大きさ">
            <span>幅</span><button className="panel-button small" aria-label="幅を狭く" onClick={() => resize(-1, 0)}>−</button><strong>{(seat ?? label)!.colSpan}マス</strong><button className="panel-button small" aria-label="幅を広く" onClick={() => resize(1, 0)}>＋</button>
            <span>高さ</span><button className="panel-button small" aria-label="高さを低く" onClick={() => resize(0, -1)}>−</button><strong>{(seat ?? label)!.rowSpan}マス</strong><button className="panel-button small" aria-label="高さを高く" onClick={() => resize(0, 1)}>＋</button>
          </div>
          <p className="settings-help">動かすときは、マス目の空いているところを押します。</p>
          <div className="panel-actions">
            <button className="panel-button" onClick={() => setSelected(null)}>直し終わる</button>
            <button className="panel-button danger" disabled={locked} onClick={remove}>消す</button>
          </div>
        </>}
      </div>
      <div className="layout-grid" style={{ '--cols': GRID.cols, '--rows': GRID.rows } as CSSProperties}>
        {cells}
        {NOTICE_AREAS.map((notice, i) => <div key={i} className="layout-notice" style={area(notice)} aria-hidden="true">{i === 0 ? '通知の場所' : '縦向きの通知'}</div>)}
        {draft.labels.map((l, i) => <button key={`label-${i}`} className={`layout-item label ${selected?.type === 'label' && selected.index === i ? 'selected' : ''}`} style={area(l)}
          aria-label={`ことば「${l.text}」（押すと直す）`} onClick={() => { setMessage(''); setSelected({ type: 'label', index: i }); }}>{l.text}</button>)}
        {draft.seats.map((s, i) => <button key={`seat-${i}`} className={`layout-item ${s.kind} ${selected?.type === 'seat' && selected.index === i ? 'selected' : ''} ${occupied.has(s.id) ? 'occupied' : ''}`} style={area(s)}
          aria-label={`${s.id}番 ${s.kind === 'table' ? 'テーブル' : 'カウンター席'}（押すと直す）`} onClick={() => { setMessage(''); setSelected({ type: 'seat', index: i }); }}>{s.id}</button>)}
      </div>
    </div>
    <div className="layout-foot">
      <p className="layout-message" role="status">{message || (problems.length ? `直すところ：${problems.join('／')}` : changed ? '保存すると、すべての端末の配置が変わります' : '')}</p>
      <button className="panel-button" onClick={() => { setDraft(DEFAULT_LAYOUT); setSelected(null); }}>最初の配置に戻す</button>
      <button className="panel-button" onClick={onClose}>{changed ? '保存せずにもどる' : 'もどる'}</button>
      <button className="panel-button primary" disabled={!changed || problems.length > 0 || saving} onClick={() => {
        setSaving(true);
        onSave(draft).then(onClose, (error: unknown) => setMessage(`保存できませんでした。もう一度押してください（${error instanceof Error ? error.message : '理由が分かりません'}）`)).finally(() => setSaving(false));
      }}>{saving ? '保存しています…' : '保存して使う'}</button>
    </div>
  </section>;
}
