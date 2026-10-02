import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, layoutProblems, MemoryShopLayoutStore, nextSeatId, parseShopLayout, rotateLabelClockwise, seatIdsOf, type ShopLayout } from './shopLayout';
import { rotateClockwise } from './layout';

const table = (id: string, col: number, row: number, colSpan = 3, rowSpan = 2) => ({ id, kind: 'table' as const, col, row, colSpan, rowSpan });
describe('席の配置', () => {
  it('今までの配置はそのまま使える', () => {
    expect(layoutProblems(DEFAULT_LAYOUT)).toEqual([]);
  });
  it('重なり・はみ出し・卓番の重複・通知の場所を見つける', () => {
    const layout: ShopLayout = { seats: [table('11', 1, 1), table('11', 2, 2), table('12', 14, 6), table('13', 7, 2, 1, 1)], labels: [] };
    expect(layoutProblems(layout)).toEqual(expect.arrayContaining([
      '11番が2つあります', '12番がマス目からはみ出しています', '13番が通知の場所に重なっています', '11番と11番が重なっています',
    ]));
  });
  it('卓番は1〜999の数字だけ', () => {
    expect(layoutProblems({ seats: [table('A1', 1, 1)], labels: [] })).toContain('卓番「A1」は 1〜999 の数字にしてください');
    expect(layoutProblems({ seats: [table('0', 1, 1)], labels: [] })).toHaveLength(1);
  });
  it('保存された配置を読み、壊れていれば null', () => {
    const saved = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    expect(parseShopLayout(saved)).toEqual(DEFAULT_LAYOUT);
    expect(parseShopLayout({ seats: [table('11', 1, 1), table('12', 1, 1)], labels: [] })).toBeNull();
    expect(parseShopLayout(undefined)).toBeNull();
  });
  it('新しい卓の番号は、使っていないいちばん小さい番号（カウンター1〜、テーブル11〜）', () => {
    expect(nextSeatId(DEFAULT_LAYOUT, 'counter')).toBe('15');
    expect(nextSeatId({ seats: [], labels: [] }, 'counter')).toBe('1');
    expect(nextSeatId(DEFAULT_LAYOUT, 'table')).toBe('15');
    expect(seatIdsOf({ seats: [table('12', 1, 3), table('3', 7, 3)], labels: [] })).toEqual(['3', '12']);
  });
  it('ことばも卓と同じく縦向きに回す', () => {
    const label = DEFAULT_LAYOUT.labels[0];
    const asSeat = rotateClockwise({ id: 'x', kind: 'table', ...label });
    const { text: _, ...rotated } = rotateLabelClockwise(label);
    expect(rotated).toEqual({ col: asSeat.col, colSpan: asSeat.colSpan, row: asSeat.row, rowSpan: asSeat.rowSpan });
  });
  it('メモリの保存先は保存した配置を購読者に渡す', async () => {
    const store = new MemoryShopLayoutStore();
    const seen: ShopLayout[] = [];
    store.subscribe(layout => seen.push(layout));
    const next = { seats: [table('11', 1, 3)], labels: [] };
    await store.save(next);
    expect(seen).toEqual([DEFAULT_LAYOUT, next]);
  });
});
