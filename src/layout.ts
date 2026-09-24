export type SeatKind = 'table' | 'counter';
export interface Seat { id: string; kind: SeatKind; col: number; colSpan: number; row: number; rowSpan: number; }
export const GRID = { cols: 15, rows: 7 } as const;
export const SEATS: Seat[] = [
  { id: '31', kind: 'table', col: 1, colSpan: 3, row: 1, rowSpan: 1 },
  { id: '33', kind: 'table', col: 4, colSpan: 3, row: 1, rowSpan: 1 },
  { id: '34', kind: 'table', col: 7, colSpan: 3, row: 1, rowSpan: 1 },
  { id: '36', kind: 'table', col: 10, colSpan: 3, row: 1, rowSpan: 1 },
  { id: '38', kind: 'table', col: 13, colSpan: 3, row: 1, rowSpan: 1 },
  { id: '10', kind: 'counter', col: 1, colSpan: 1, row: 2, rowSpan: 1 },
  { id: '9', kind: 'counter', col: 2, colSpan: 1, row: 2, rowSpan: 1 },
  { id: '8', kind: 'counter', col: 3, colSpan: 1, row: 2, rowSpan: 1 },
  { id: '7', kind: 'counter', col: 4, colSpan: 1, row: 2, rowSpan: 1 },
  { id: '6', kind: 'counter', col: 5, colSpan: 1, row: 3, rowSpan: 1 },
  { id: '5', kind: 'counter', col: 5, colSpan: 1, row: 4, rowSpan: 1 },
  { id: '4', kind: 'counter', col: 5, colSpan: 1, row: 5, rowSpan: 1 },
  { id: '3', kind: 'counter', col: 5, colSpan: 1, row: 6, rowSpan: 1 },
  { id: '1', kind: 'counter', col: 2, colSpan: 1, row: 7, rowSpan: 1 },
  { id: '2', kind: 'counter', col: 3, colSpan: 1, row: 7, rowSpan: 1 },
  { id: '12', kind: 'table', col: 7, colSpan: 3, row: 3, rowSpan: 2 },
  { id: '14', kind: 'table', col: 10, colSpan: 3, row: 3, rowSpan: 2 },
  { id: '22', kind: 'table', col: 13, colSpan: 3, row: 3, rowSpan: 2 },
  { id: '11', kind: 'table', col: 7, colSpan: 3, row: 5, rowSpan: 2 },
  { id: '13', kind: 'table', col: 10, colSpan: 3, row: 5, rowSpan: 2 },
  { id: '21', kind: 'table', col: 13, colSpan: 3, row: 5, rowSpan: 2 },
];
