import { GRID } from './layout';

// 席の配置で、卓・ことばを指でつかんで動かす・角をつまんで大きさを変える（No.93）。
// 指の位置からマスを求める計算と、ドラッグ中の行き先の計算。画面の部品は Web と iOS でそれぞれ作り、ここは共通
export type Box = { col: number; colSpan: number; row: number; rowSpan: number };
export type Cell = { col: number; row: number };
export type DragKind = 'move' | 'resize';
// これより短い動きは、ドラッグではなく「押した」として扱う（押して選ぶ操作を残す）
export const DRAG_THRESHOLD = 8;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
// マス目の左上からの位置（x, y）が、どのマスか。width・height はマス目の中の大きさ（外の余白は除く）、gap はマスの間。
// マス目の外に出ても、いちばん近い端のマスにする
export function cellAt(x: number, y: number, width: number, height: number, gap: number): Cell {
  const colSize = (width - gap * (GRID.cols - 1)) / GRID.cols + gap;
  const rowSize = (height - gap * (GRID.rows - 1)) / GRID.rows + gap;
  return { col: clamp(Math.floor((x + gap / 2) / colSize) + 1, 1, GRID.cols), row: clamp(Math.floor((y + gap / 2) / rowSize) + 1, 1, GRID.rows) };
}
// ドラッグ中の行き先。動かすときはつかんだマスとの差だけずらし、大きさを変えるときは右下の角を指のマスに合わせる。
// どちらもマス目からはみ出さないように止める（ほかの卓との重なりは、置くときに確かめる）
export function dragBox(kind: DragKind, item: Box, start: Cell, current: Cell): Box {
  if (kind === 'move') {
    return {
      ...item,
      col: clamp(item.col + current.col - start.col, 1, GRID.cols - item.colSpan + 1),
      row: clamp(item.row + current.row - start.row, 1, GRID.rows - item.rowSpan + 1),
    };
  }
  return {
    ...item,
    colSpan: clamp(current.col - item.col + 1, 1, GRID.cols - item.col + 1),
    rowSpan: clamp(current.row - item.row + 1, 1, GRID.rows - item.row + 1),
  };
}
export function sameBox(a: Box, b: Box): boolean {
  return a.col === b.col && a.row === b.row && a.colSpan === b.colSpan && a.rowSpan === b.rowSpan;
}
