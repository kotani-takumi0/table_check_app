export type SeatKind = 'table' | 'counter';
export interface Seat { id: string; kind: SeatKind; col: number; colSpan: number; row: number; rowSpan: number; }
// フロアのマス目（横向き）。No.108 で 15×7 から 15×10 に広げ、横向きのタブレットで1マスが正方形になるようにした。
// 古い版（v2.2.x 以前）は7行目までしか読めず、8行目より下に置いた配置は壊れているとみなして最初の配置を出す
export const GRID = { cols: 15, rows: 10 } as const;
// 最初の配置（No.112 でマス目いっぱいに広げた）。席の配置を保存していない店と「最初の配置に戻す」で使う
export const SEATS: Seat[] = [
  { id: '31', kind: 'table', col: 1, colSpan: 3, row: 1, rowSpan: 2 },
  { id: '33', kind: 'table', col: 4, colSpan: 3, row: 1, rowSpan: 2 },
  { id: '34', kind: 'table', col: 7, colSpan: 3, row: 1, rowSpan: 2 },
  { id: '36', kind: 'table', col: 10, colSpan: 3, row: 1, rowSpan: 2 },
  { id: '38', kind: 'table', col: 13, colSpan: 3, row: 1, rowSpan: 2 },
  { id: '10', kind: 'counter', col: 1, colSpan: 1, row: 4, rowSpan: 1 },
  { id: '9', kind: 'counter', col: 2, colSpan: 1, row: 4, rowSpan: 1 },
  { id: '8', kind: 'counter', col: 3, colSpan: 1, row: 4, rowSpan: 1 },
  { id: '7', kind: 'counter', col: 4, colSpan: 1, row: 5, rowSpan: 1 },
  { id: '6', kind: 'counter', col: 4, colSpan: 1, row: 6, rowSpan: 1 },
  { id: '5', kind: 'counter', col: 4, colSpan: 1, row: 7, rowSpan: 1 },
  { id: '4', kind: 'counter', col: 4, colSpan: 1, row: 8, rowSpan: 1 },
  { id: '1', kind: 'counter', col: 1, colSpan: 1, row: 9, rowSpan: 1 },
  { id: '2', kind: 'counter', col: 2, colSpan: 1, row: 9, rowSpan: 1 },
  { id: '3', kind: 'counter', col: 3, colSpan: 1, row: 9, rowSpan: 1 },
  { id: '12', kind: 'table', col: 6, colSpan: 3, row: 4, rowSpan: 2 },
  { id: '14', kind: 'table', col: 9, colSpan: 3, row: 4, rowSpan: 2 },
  { id: '22', kind: 'table', col: 12, colSpan: 4, row: 4, rowSpan: 3 },
  { id: '11', kind: 'table', col: 6, colSpan: 3, row: 7, rowSpan: 2 },
  { id: '13', kind: 'table', col: 9, colSpan: 3, row: 7, rowSpan: 2 },
  { id: '21', kind: 'table', col: 12, colSpan: 4, row: 7, rowSpan: 3 },
];
// 縦向きの画面では、手描きの配置図と同じ向き（今の配置を時計回りに90°）で並べる。卓とことばに使う。
// within.rows は回す前（横向き）の行の数で、回したあとの列の数になる（shopLayout の portraitOf が、置いてある行までに絞って渡す）
export function rotateClockwise<T extends { col: number; colSpan: number; row: number; rowSpan: number }>(box: T, within: { rows: number }): T {
  return { ...box, col: within.rows + 2 - box.row - box.rowSpan, colSpan: box.rowSpan, row: box.col, rowSpan: box.colSpan };
}
