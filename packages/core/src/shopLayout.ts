import { GRID, rotateClockwise, SEATS, type Seat, type SeatKind } from './layout';
import { isVisible, RULES, type Rules, type Session } from './domain';
import { resolveSessions } from './firestoreMapping';
import type { SyncState } from './store';

// 卓とセッションの参照が一致し、退店後の表示時間も含めてお客さんが見えている卓
// rules：退店済みを残す時間（No.14）を店の設定に合わせる
export function occupiedSeatIds(tables: Record<string, string | null>, sessions: Session[], now: number, rules: Rules = RULES): Set<string> {
  return new Set(resolveSessions(tables, sessions).filter(session => isVisible(session, now, rules)).flatMap(session => session.tableIds));
}

// 席の配置（No.75）。お店の人が「設定 → 席の配置」でマス目にブロックを置いて作り、全端末で共有する（Firestore の shopLayout/main）。
// 位置は横向き（15列×10行。No.108 より前は15列×7行）のマス目で持ち、縦向き・スマホは時計回りに回して並べる
// 目印（No.128）：入口・キッチンなど、卓のほかに配置に置くもの。分析で「入口から何マス」などを数えるために、種類と場所を持つ
// （距離は持たず、分析するときに場所から計算する）。同じ種類をいくつでも置ける。
// 用意した種類のほかは店が名前を入れて足す（custom）。同じ名前は同じ種類として数える。No.128 より前の「ことば」は custom として読む
export type LandmarkKind = 'entrance' | 'kitchen' | 'drinks' | 'toilet' | 'register' | 'custom';
export const LANDMARK_KINDS: { kind: Exclude<LandmarkKind, 'custom'>; name: string }[] = [
  { kind: 'entrance', name: '入口' }, { kind: 'kitchen', name: 'キッチン' }, { kind: 'drinks', name: 'ドリンク場' }, { kind: 'toilet', name: 'トイレ' }, { kind: 'register', name: 'レジ' },
];
export function isLandmarkKind(value: unknown): value is LandmarkKind {
  return value === 'custom' || LANDMARK_KINDS.some(item => item.kind === value);
}
// 用意した種類の名前（店が足した目印は null）。text には用意した種類でも名前を入れておく（前の版のアプリは text だけを出す）
export function landmarkName(kind: LandmarkKind): string | null {
  return LANDMARK_KINDS.find(item => item.kind === kind)?.name ?? null;
}
export interface LayoutLabel { kind: LandmarkKind; text: string; col: number; colSpan: number; row: number; rowSpan: number }
export interface ShopLayout { seats: Seat[]; labels: LayoutLabel[] }
export const DEFAULT_LAYOUT: ShopLayout = {
  seats: SEATS,
  labels: [{ kind: 'custom', text: 'カウンター', col: 1, colSpan: 3, row: 5, rowSpan: 4 }],
};
// No.109 より前は、通知（L.O.・トイレ）を出す場所（2行目の列6〜15と、6列目の2〜7行目）に卓・目印を置けなかった。
// 通知はフロアの上のポップアップにしたので、どこにでも置ける。古い版はこの場所に置いた配置を壊れているとみなし、最初の配置を出す
export const MAX_SEATS = 60;
export const MAX_LABELS = 20;
export const LABEL_MAX_LENGTH = 12;
// 卓番は 1〜999 の数字（団体の卓番を数の順に並べ、Firestore のルールでも確かめる）
export function isSeatId(id: string): boolean {
  return /^[1-9][0-9]{0,2}$/.test(id);
}
export type Box = { col: number; colSpan: number; row: number; rowSpan: number };
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
  if (layout.labels.length > MAX_LABELS) problems.push(`目印は${MAX_LABELS}までです`);
  const ids = new Set<string>();
  for (const seat of layout.seats) {
    if (!isSeatId(seat.id)) problems.push(`卓番「${seat.id}」は 1〜999 の数字にしてください`);
    else if (ids.has(seat.id)) problems.push(`${seat.id}番が2つあります`);
    ids.add(seat.id);
    if (!inGrid(seat)) problems.push(`${seat.id}番がマス目からはみ出しています`);
  }
  for (const label of layout.labels) {
    if (label.text.trim() === '' || label.text.length > LABEL_MAX_LENGTH) problems.push(`目印の名前は1〜${LABEL_MAX_LENGTH}文字にしてください`);
    if (!inGrid(label)) problems.push(`「${label.text}」がマス目からはみ出しています`);
  }
  const boxes: { name: string; box: Box }[] = [
    ...layout.seats.map(seat => ({ name: `${seat.id}番`, box: seat })),
    ...layout.labels.map(label => ({ name: `「${label.text}」`, box: label })),
  ];
  boxes.forEach((a, i) => {
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
    kind: isLandmarkKind(l?.kind) ? l.kind : 'custom', text: String(l?.text ?? ''), col: num(l?.col), colSpan: num(l?.colSpan), row: num(l?.row), rowSpan: num(l?.rowSpan),
  }));
  const layout = { seats, labels };
  return layoutProblems(layout).length === 0 ? layout : null;
}
// 卓・目印を置いている、いちばん下の行（No.108）。縦向きはここまでを回して出し、何も置いていない下の行は出さない
export function usedRows(layout: ShopLayout): number {
  return Math.max(1, ...[...layout.seats, ...layout.labels].map(box => box.row + box.rowSpan - 1));
}
// 縦向きの並び：置いてある行までを時計回りに90°回す
export function portraitOf(layout: ShopLayout): { grid: { cols: number; rows: number }; seats: Seat[]; labels: LayoutLabel[] } {
  const within = { rows: usedRows(layout) };
  return {
    grid: { cols: within.rows, rows: GRID.cols },
    seats: layout.seats.map(seat => rotateClockwise(seat, within)),
    labels: layout.labels.map(label => rotateClockwise(label, within)),
  };
}
export interface ShopLayoutStore {
  subscribe(cb: (layout: ShopLayout) => void): () => void;
  // rules：お客さんがいる卓を確かめるときの店の時間のルール（退店済みを残す時間）
  save(layout: ShopLayout, rules?: Rules): Promise<void>;
  // 席の配置を一度でも保存したか（最初のページを出すかを決める。No.087）。分からない（オフラインなど）ときは null
  isSaved?(): Promise<boolean | null>;
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
