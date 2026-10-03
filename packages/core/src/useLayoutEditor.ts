import { useEffect, useMemo, useState } from 'react';
import { GRID, type Seat, type SeatKind } from './layout';
import { DEFAULT_LAYOUT, layoutProblems, nextSeatId, NOTICE_AREAS, overlaps, type LayoutLabel, type ShopLayout } from './shopLayout';

// 席の配置を作り直す画面（No.75）の中身。Web と iOS（No.86）で同じものを使い、見た目だけそれぞれで作る
// 左に並べるブロック。選んでからマス目の空いているところを押すと置く。大きさはあとで幅・高さを変えられる
export const LAYOUT_BLOCKS = [
  { key: 'big', name: '大きいテーブル', kind: 'table', colSpan: 3, rowSpan: 2 },
  { key: 'long', name: '細長いテーブル', kind: 'table', colSpan: 3, rowSpan: 1 },
  { key: 'small', name: '小さいテーブル', kind: 'table', colSpan: 1, rowSpan: 1 },
  { key: 'counter', name: 'カウンター席', kind: 'counter', colSpan: 1, rowSpan: 1 },
  { key: 'label', name: 'ことば（カウンターなど）', kind: 'label', colSpan: 4, rowSpan: 1 },
] as const;
export type BlockKey = typeof LAYOUT_BLOCKS[number]['key'];
export type LayoutSelected = { type: 'seat' | 'label'; index: number } | null;
type Box = { col: number; colSpan: number; row: number; rowSpan: number };
const fits = (box: Box) => box.col >= 1 && box.row >= 1 && box.col + box.colSpan - 1 <= GRID.cols && box.row + box.rowSpan - 1 <= GRID.rows;

// 下書きを直して「保存して使う」で全端末に反映する。
// お客さんがいる卓（occupied）は、案内の記録とずれないよう卓番を変えたり消したりできない
// onSave は保存に失敗したら拒否する（そのときは下書きを残して、理由を出す）
export function useLayoutEditor({ layout, occupied, onSave, onClose }: { layout: ShopLayout; occupied: Set<string>; onSave(layout: ShopLayout): Promise<void>; onClose(): void }) {
  const [draft, setDraft] = useState<ShopLayout>(layout);
  // 読み込んだ配置と卓番を残し、入力途中の番号に編集制限を引きずらせない
  const [baseline, setBaseline] = useState<ShopLayout>(layout);
  const [origIds, setOrigIds] = useState<(string | null)[]>(() => layout.seats.map(seat => seat.id));
  const [dirty, setDirty] = useState(false);
  const [block, setBlock] = useState<BlockKey | null>('big');
  const [selected, setSelected] = useState<LayoutSelected>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const layoutChanged = JSON.stringify(layout) !== JSON.stringify(baseline);
  const conflict = dirty && layoutChanged;
  // 初回の遅れた読み込みも、まだ直していなければそのまま取り込む
  useEffect(() => {
    if (dirty || !layoutChanged) return;
    setDraft(layout);
    setBaseline(layout);
    setOrigIds(layout.seats.map(seat => seat.id));
    setSelected(null);
    setMessage('');
  }, [layout, dirty, layoutChanged]);
  const reload = () => {
    setDraft(layout);
    setBaseline(layout);
    setOrigIds(layout.seats.map(seat => seat.id));
    setDirty(false);
    setSelected(null);
    setMessage('');
  };
  // 読み込み後にお客さんが入った場合も、もとの卓を消したり改番していれば保存させない
  const problems = useMemo(() => [...layoutProblems(draft),
    ...[...occupied].filter(id => !draft.seats.some(s => s.id === id)
      || (baseline.seats.some(s => s.id === id) && !draft.seats.some((s, i) => origIds[i] === id && s.id === id)))
      .map(id => `${id}番はお客さんがいるので残してください`)], [draft, occupied, baseline, origIds]);
  const changed = JSON.stringify(draft) !== JSON.stringify(baseline);
  const seat = selected?.type === 'seat' ? draft.seats[selected.index] : undefined;
  const label = selected?.type === 'label' ? draft.labels[selected.index] : undefined;
  // ほかの卓・ことば・通知の場所と重ならず、マス目に収まるか（動かす・大きさを変えるものは自分を除いて調べる）
  const free = (box: Box, except?: LayoutSelected) => fits(box) && !NOTICE_AREAS.some(notice => overlaps(box, notice))
    && draft.seats.every((s, i) => (except?.type === 'seat' && except.index === i) || !overlaps(box, s))
    && draft.labels.every((l, i) => (except?.type === 'label' && except.index === i) || !overlaps(box, l));
  const updateSeat = (index: number, change: Partial<Seat>) => {
    setDirty(true);
    setDraft(d => ({ ...d, seats: d.seats.map((s, i) => i === index ? { ...s, ...change } : s) }));
  };
  const updateLabel = (index: number, change: Partial<LayoutLabel>) => {
    setDirty(true);
    setDraft(d => ({ ...d, labels: d.labels.map((l, i) => i === index ? { ...l, ...change } : l) }));
  };
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
    const chosen = LAYOUT_BLOCKS.find(b => b.key === block);
    if (!chosen) return;
    const box = { col, row, colSpan: chosen.colSpan, rowSpan: chosen.rowSpan };
    if (!free(box)) { setMessage('そこには入りません。空いているところを押すか、小さいブロックを選んでください'); return; }
    setDirty(true);
    if (chosen.kind === 'label') {
      setDraft(d => ({ ...d, labels: [...d.labels, { text: 'ことば', ...box }] }));
      setSelected({ type: 'label', index: draft.labels.length });
      return;
    }
    const id = nextSeatId(draft, chosen.kind as SeatKind);
    setDraft(d => ({ ...d, seats: [...d.seats, { id, kind: chosen.kind as SeatKind, ...box }] }));
    setOrigIds(ids => [...ids, null]);
    setSelected({ type: 'seat', index: draft.seats.length });
  };
  // 置いた卓・ことばを押した：直すものとして選ぶ
  const select = (next: LayoutSelected) => { setMessage(''); setSelected(next); };
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
  // ドラッグ（No.93）：つかんだ卓・ことばを、その場所・大きさに置けるか（ドラッグ中の影の色に使う）
  const canPlace = (target: NonNullable<LayoutSelected>, box: Box) => free(box, target);
  // 指を離したところに置き、直すものとして選ぶ。置けなければ動かさず、理由を出す
  const placeAt = (target: NonNullable<LayoutSelected>, box: Box) => {
    setSelected(target);
    if (!free(box, target)) { setMessage('そこには入りません（ほかの卓・通知の場所に重なるか、はみ出します）'); return; }
    setMessage('');
    const change = { col: box.col, row: box.row, colSpan: box.colSpan, rowSpan: box.rowSpan };
    if (target.type === 'seat') updateSeat(target.index, change); else updateLabel(target.index, change);
  };
  const remove = () => {
    setDirty(true);
    if (selected?.type === 'seat') {
      const index = selected.index;
      setDraft(d => ({ ...d, seats: d.seats.filter((_, i) => i !== index) }));
      setOrigIds(ids => ids.filter((_, i) => i !== index));
    }
    else if (selected?.type === 'label') { const index = selected.index; setDraft(d => ({ ...d, labels: d.labels.filter((_, i) => i !== index) })); }
    setSelected(null);
  };
  // 卓番は数字だけ・3けたまで
  const setSeatId = (text: string) => { if (selected?.type === 'seat') updateSeat(selected.index, { id: text.replace(/\D/g, '').slice(0, 3) }); };
  const setSeatKind = (kind: SeatKind) => { if (selected?.type === 'seat') updateSeat(selected.index, { kind }); };
  const setLabelText = (text: string) => { if (selected?.type === 'label') updateLabel(selected.index, { text }); };
  const resetToDefault = () => {
    setDraft(DEFAULT_LAYOUT);
    // 最初の配置に戻す操作も編集。読み込み時に存在した卓だけ、もとの卓番を引き継ぐ
    setOrigIds(DEFAULT_LAYOUT.seats.map(seat => baseline.seats.some(s => s.id === seat.id) ? seat.id : null));
    setDirty(true);
    setSelected(null);
  };
  const save = () => {
    setSaving(true);
    onSave(draft).then(onClose, (error: unknown) => setMessage(`保存できませんでした。もう一度押してください（${error instanceof Error ? error.message : '理由が分かりません'}）`)).finally(() => setSaving(false));
  };
  // 打ち換え途中にほかの使用中の番号になっても、もとの卓が空席なら直し続けられる
  const originalId = selected?.type === 'seat' ? origIds[selected.index] : null;
  const locked = originalId != null && occupied.has(originalId);
  // お客さんがいる卓（もとの卓番で見る）。マス目で色を変える
  const isOccupied = (index: number) => origIds[index] != null && occupied.has(origIds[index]);
  const status = conflict ? 'ほかの端末で配置が変わりました。「最新を読み込む」を押してから直してください'
    : message || (problems.length ? `直すところ：${problems.join('／')}` : changed ? '保存すると、すべての端末の配置が変わります' : '');
  const canSave = changed && problems.length === 0 && !saving && !layoutChanged;
  return { draft, block, setBlock, selected, select, seat, label, locked, isOccupied, pressCell, resize, canPlace, placeAt, remove, setSeatId, setSeatKind, setLabelText,
    conflict, reload, resetToDefault, changed, saving, canSave, save, status };
}
