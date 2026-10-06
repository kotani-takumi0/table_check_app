import { expect, it } from 'vitest';
import { GRID, SEATS, type Seat } from './layout';
import { DEFAULT_LAYOUT, portraitOf } from './shopLayout';
it('21席、IDは一意で32/35/37は存在しない', () => {
  expect(SEATS).toHaveLength(21);
  expect(new Set(SEATS.map(s => s.id)).size).toBe(21);
  for (const id of ['32', '35', '37']) expect(SEATS.some(s => s.id === id)).toBe(false);
});
const fitsWithoutOverlap = (seats: Seat[], grid: { cols: number; rows: number }) => {
  const occupied = new Set<string>();
  for (const seat of seats) {
    expect(seat.col).toBeGreaterThanOrEqual(1);
    expect(seat.row).toBeGreaterThanOrEqual(1);
    expect(seat.colSpan).toBeGreaterThanOrEqual(1);
    expect(seat.rowSpan).toBeGreaterThanOrEqual(1);
    expect(seat.col + seat.colSpan - 1).toBeLessThanOrEqual(grid.cols);
    expect(seat.row + seat.rowSpan - 1).toBeLessThanOrEqual(grid.rows);
    for (let col = seat.col; col < seat.col + seat.colSpan; col++) {
      for (let row = seat.row; row < seat.row + seat.rowSpan; row++) {
        const cell = `${col},${row}`;
        expect(occupied.has(cell)).toBe(false);
        occupied.add(cell);
      }
    }
  }
};
it('すべての席はグリッド内に収まり、互いに重ならない', () => {
  fitsWithoutOverlap(SEATS, GRID);
});
it('縦向き（時計回りに90°）でもグリッド内に収まり、互いに重ならない', () => {
  const portrait = portraitOf(DEFAULT_LAYOUT);
  fitsWithoutOverlap(portrait.seats, portrait.grid);
});
it('縦向きは、最初の配置（9行）を時計回りに90°回した並びになる', () => {
  const portrait = portraitOf(DEFAULT_LAYOUT);
  const at = (id: string) => { const s = portrait.seats.find(seat => seat.id === id)!; return [s.col, s.colSpan, s.row, s.rowSpan]; };
  expect(portrait.grid).toEqual({ cols: 9, rows: 15 });
  expect(at('31')).toEqual([8, 2, 1, 3]);   // 右の列の一番上
  expect(at('38')).toEqual([8, 2, 13, 3]);  // 右の列の一番下
  expect(at('10')).toEqual([6, 1, 1, 1]);   // カウンターの右側の上
  expect(at('7')).toEqual([5, 1, 4, 1]);    // カウンターの下辺
  expect(at('4')).toEqual([2, 1, 4, 1]);
  expect(at('1')).toEqual([1, 1, 1, 1]);    // 左の列
  expect(at('3')).toEqual([1, 1, 3, 1]);
  expect(at('11')).toEqual([2, 2, 6, 3]);   // 11 の右に 12
  expect(at('12')).toEqual([5, 2, 6, 3]);
  expect(at('21')).toEqual([1, 3, 12, 4]);  // 21 の右に 22
  expect(at('22')).toEqual([4, 3, 12, 4]);
});
