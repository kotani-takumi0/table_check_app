import { describe, expect, it } from 'vitest';
import { cellAt, dragBox, sameBox } from './layoutDrag';

// 15列×7行。マス 60px・間 4px なら、幅 15*60+14*4=956、高さ 7*60+6*4=444
const W = 956, H = 444, GAP = 4;
describe('指の位置からマスを求める', () => {
  it('左上・右下・マスの間の真ん中で区切る', () => {
    expect(cellAt(0, 0, W, H, GAP)).toEqual({ col: 1, row: 1 });
    expect(cellAt(61, 61, W, H, GAP)).toEqual({ col: 1, row: 1 });
    expect(cellAt(63, 63, W, H, GAP)).toEqual({ col: 2, row: 2 });
    expect(cellAt(W - 1, H - 1, W, H, GAP)).toEqual({ col: 15, row: 7 });
  });
  it('マス目の外は、いちばん近い端のマス', () => {
    expect(cellAt(-50, -50, W, H, GAP)).toEqual({ col: 1, row: 1 });
    expect(cellAt(W + 50, H + 50, W, H, GAP)).toEqual({ col: 15, row: 7 });
  });
});
describe('ドラッグ中の行き先', () => {
  const table = { col: 7, colSpan: 3, row: 3, rowSpan: 2 };
  it('動かすときは、つかんだマスとの差だけずらす', () => {
    expect(dragBox('move', table, { col: 8, row: 3 }, { col: 10, row: 5 })).toEqual({ ...table, col: 9, row: 5 });
  });
  it('動かしても、マス目からはみ出さない', () => {
    expect(dragBox('move', table, { col: 8, row: 3 }, { col: 15, row: 7 })).toEqual({ ...table, col: 13, row: 6 });
    expect(dragBox('move', table, { col: 8, row: 3 }, { col: 1, row: 1 })).toEqual({ ...table, col: 1, row: 1 });
  });
  it('大きさは右下の角を指のマスに合わせ、1マスより小さく・はみ出すほど大きくしない', () => {
    expect(dragBox('resize', table, { col: 9, row: 4 }, { col: 11, row: 6 })).toEqual({ ...table, colSpan: 5, rowSpan: 4 });
    expect(dragBox('resize', table, { col: 9, row: 4 }, { col: 2, row: 1 })).toEqual({ ...table, colSpan: 1, rowSpan: 1 });
    expect(dragBox('resize', table, { col: 9, row: 4 }, { col: 15, row: 7 })).toEqual({ ...table, colSpan: 9, rowSpan: 5 });
  });
  it('同じ場所・大きさか', () => {
    expect(sameBox(table, { ...table })).toBe(true);
    expect(sameBox(table, { ...table, col: 8 })).toBe(false);
  });
});
