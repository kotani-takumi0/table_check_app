import { expect, it } from 'vitest';
import { GRID, SEATS } from './layout';
it('21席、IDは一意で32/35/37は存在しない', () => {
  expect(SEATS).toHaveLength(21);
  expect(new Set(SEATS.map(s => s.id)).size).toBe(21);
  for (const id of ['32', '35', '37']) expect(SEATS.some(s => s.id === id)).toBe(false);
});
it('すべての席はグリッド内に収まり、互いに重ならない', () => {
  const occupied = new Set<string>();
  for (const seat of SEATS) {
    expect(seat.col).toBeGreaterThanOrEqual(1);
    expect(seat.row).toBeGreaterThanOrEqual(1);
    expect(seat.colSpan).toBeGreaterThanOrEqual(1);
    expect(seat.rowSpan).toBeGreaterThanOrEqual(1);
    expect(seat.col + seat.colSpan - 1).toBeLessThanOrEqual(GRID.cols);
    expect(seat.row + seat.rowSpan - 1).toBeLessThanOrEqual(GRID.rows);
    for (let col = seat.col; col < seat.col + seat.colSpan; col++) {
      for (let row = seat.row; row < seat.row + seat.rowSpan; row++) {
        const cell = `${col},${row}`;
        expect(occupied.has(cell)).toBe(false);
        occupied.add(cell);
      }
    }
  }
});
