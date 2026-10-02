import { GRID, SEATS, type Seat, type SeatKind } from './layout';
import type { SyncState } from './store';

// 席の配置（No.75）。お店の人が「設定 → 席の配置」でマス目にブロックを置いて作り、全端末で共有する（Firestore の shopLayout/main）。
// 位置は横向き（15列×7行）のマス目で持ち、縦向き・スマホは今までどおり時計回りに回して並べる
export interface LayoutLabel { text: string; col: number; colSpan: number; row: number; rowSpan: number }
export interface ShopLayout { seats: Seat[]; labels: LayoutLabel[] }
export const DEFAULT_LAYOUT: ShopLayout = {
  seats: SEATS,
  labels: [{ text: 'カウンター', col: 1, colSpan: 4, row: 3, rowSpan: 4 }],
};
// 通知（L.O.・トイレ）を出す場所。卓やことばは置けない。
// 横向きは2行目の右（App.css の .toasts）、縦向きは回したあとの6行目の左＝横向きの6列目（.portrait .toasts）
export const NOTICE_AREAS = [{ col: 6, colSpan: 10, row: 2, rowSpan: 1 }, { col: 6, colSpan: 1, row: 2, rowSpan: 6 }] as const;
export const MAX_SEATS = 60;
export const MAX_LABELS = 20;
export const LABEL_MAX_LENGTH = 12;
// 卓番は 1〜999 の数字（団体の卓番を数の順に並べ、Firestore のルールでも確かめる）
export function isSeatId(id: string): boolean {
  return /^[1-9][0-9]{0,2}$/.test(id);
}
type Box = { col: number; colSpan: number; row: number; rowSpan: number };
function inGrid(box: Box): boolean {
  return [box.col, box.colSpan, box.row, box.rowSpan].every(Number.isInteger)
    && box.col >= 1 && box.row >= 1 && box.colSpan >= 1 && box.rowSpan >= 1
    && box.col + box.colSpan - 1 <= GRID.cols && box.row + box.rowSpan - 1 <= GRID.rows;
}
export function overlaps(a: Box, b: Box): boolean {
  return a.col < b.col + b.colSpan && b.col < a.col + a.colSpan && a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan;
}
// 保存する前に確かめる。直すべきことを、お店の人が読める言葉で返す（空なら保存できる）
export function layoutProblems(layout: ShopLayout): string[] {
  const problems: string[] = [];
  if (layout.seats.length === 0) problems.push('卓が1つもありません');
  if (layout.seats.length > MAX_SEATS) problems.push(`卓は${MAX_SEATS}までです`);
  if (layout.labels.length > MAX_LABELS) problems.push(`ことばは${MAX_LABELS}までです`);
  const ids = new Set<string>();
  for (const seat of layout.seats) {
    if (!isSeatId(seat.id)) problems.push(`卓番「${seat.id}」は 1〜999 の数字にしてください`);
    else if (ids.has(seat.id)) problems.push(`${seat.id}番が2つあります`);
    ids.add(seat.id);
    if (!inGrid(seat)) problems.push(`${seat.id}番がマス目からはみ出しています`);
  }
  for (const label of layout.labels) {
    if (label.text.trim() === '' || label.text.length > LABEL_MAX_LENGTH) problems.push(`ことばは1〜${LABEL_MAX_LENGTH}文字にしてください`);
    if (!inGrid(label)) problems.push(`「${label.text}」がマス目からはみ出しています`);
  }
  const boxes: { name: string; box: Box }[] = [
    ...layout.seats.map(seat => ({ name: `${seat.id}番`, box: seat })),
    ...layout.labels.map(label => ({ name: `「${label.text}」`, box: label })),
  ];
  boxes.forEach((a, i) => {
    if (NOTICE_AREAS.some(notice => overlaps(a.box, notice))) problems.push(`${a.name}が通知の場所に重なっています`);
    boxes.slice(i + 1).forEach(b => { if (overlaps(a.box, b.box)) problems.push(`${a.name}と${b.name}が重なっています`); });
  });
  return [...new Set(problems)];
}
// 保存された配置を読む。壊れていたり、確かめて問題があったりすれば null（呼ぶ側は今までの配置を使う）
export function parseShopLayout(data: unknown): ShopLayout | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.seats) || !Array.isArray(d.labels)) return null;
  const num = (v: unknown) => typeof v === 'number' ? v : NaN;
  const seats = d.seats.map((s: Record<string, unknown>): Seat => ({
    id: String(s?.id ?? ''), kind: (s?.kind === 'counter' ? 'counter' : 'table') as SeatKind,
    col: num(s?.col), colSpan: num(s?.colSpan), row: num(s?.row), rowSpan: num(s?.rowSpan),
  }));
  const labels = d.labels.map((l: Record<string, unknown>): LayoutLabel => ({
    text: String(l?.text ?? ''), col: num(l?.col), colSpan: num(l?.colSpan), row: num(l?.row), rowSpan: num(l?.rowSpan),
  }));
  const layout = { seats, labels };
  return layoutProblems(layout).length === 0 ? layout : null;
}
// ことばも卓と同じく、縦向きでは時計回りに回す（layout の rotateClockwise と同じ式）
export function rotateLabelClockwise(label: LayoutLabel): LayoutLabel {
  return { ...label, col: GRID.rows + 2 - label.row - label.rowSpan, colSpan: label.rowSpan, row: label.col, rowSpan: label.colSpan };
}
export interface ShopLayoutStore {
  subscribe(cb: (layout: ShopLayout) => void): () => void;
  save(layout: ShopLayout): Promise<void>;
}
// Firebase につながずに試すときの保存先。アプリを開いている間だけ覚える
export class MemoryShopLayoutStore implements ShopLayoutStore {
  private layout = DEFAULT_LAYOUT;
  private subscribers = new Set<(layout: ShopLayout) => void>();
  subscribe(cb: (layout: ShopLayout) => void): () => void { this.subscribers.add(cb); cb(this.layout); return () => { this.subscribers.delete(cb); }; }
  async save(layout: ShopLayout): Promise<void> { this.layout = layout; this.subscribers.forEach(cb => cb(layout)); }
}
// 卓番を数の順に並べた一覧（Firestore のルールが、案内できる卓かを確かめるのに使う）
export function seatIdsOf(layout: ShopLayout): string[] {
  return layout.seats.map(seat => seat.id).sort((a, b) => Number(a) - Number(b));
}
// 新しく置く卓の番号：その種類で使っていないいちばん小さい番号（カウンターは1から、テーブルは11から）
export function nextSeatId(layout: ShopLayout, kind: SeatKind): string {
  const used = new Set(layout.seats.map(seat => seat.id));
  for (let n = kind === 'counter' ? 1 : 11; n <= 999; n++) if (!used.has(String(n))) return String(n);
  return '';
}
