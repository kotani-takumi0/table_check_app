import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, isLandmarkKind, landmarkName, LANDMARK_KINDS, layoutProblems, MemoryShopLayoutStore, nextSeatId, occupiedSeatIds, parseShopLayout, portraitOf, seatIdsOf, usedRows, type ShopLayout } from './shopLayout';
import { rotateClockwise } from './layout';
import { newSession } from './domain';

const table = (id: string, col: number, row: number, colSpan = 3, rowSpan = 2) => ({ id, kind: 'table' as const, col, row, colSpan, rowSpan });
describe('お客さんがいる卓', () => {
  it('表示中のお客さんの卓を団体の卓も含めて返す', () => {
    const group = { ...newSession('団体', '11', 0), tableIds: ['11', '12'] };
    expect(occupiedSeatIds({ '11': '団体', '12': '団体', '13': '別の客' }, [group, newSession('別の客', '13', 0)], 600_000))
      .toEqual(new Set(['11', '12', '13']));
  });
  it('退店から5分未満は含み、5分ちょうどと過ぎた卓は含まない', () => {
    const exited = { ...newSession('退店した客', '11', 0), status: 'exited' as const, otoshiAt: 1, loDoneAt: 2, exitedAt: 60_000 };
    expect(occupiedSeatIds({ '11': exited.id }, [exited], 359_999)).toEqual(new Set(['11']));
    expect(occupiedSeatIds({ '11': exited.id }, [exited], 360_000)).toEqual(new Set());
    expect(occupiedSeatIds({ '11': exited.id }, [exited], 360_001)).toEqual(new Set());
  });
  it('別のセッションを指す卓・参照のない卓・空席は含まない', () => {
    const group = { ...newSession('前の客', '11', 0), tableIds: ['11', '12', '13', '14'] };
    expect(occupiedSeatIds({ '11': '前の客', '12': '次の客', '13': null }, [group], 100))
      .toEqual(new Set(['11']));
  });
  it('セッション側に卓番がない参照や、セッションが見つからない参照は含まない', () => {
    expect(occupiedSeatIds({ '11': '客', '12': '客', '13': '不明' }, [newSession('客', '11', 0)], 100))
      .toEqual(new Set(['11']));
    expect(occupiedSeatIds({}, [], 100)).toEqual(new Set());
  });
});
describe('席の配置', () => {
  it('今までの配置はそのまま使える', () => {
    expect(layoutProblems(DEFAULT_LAYOUT)).toEqual([]);
  });
  it('重なり・はみ出し・卓番の重複を見つける', () => {
    const layout: ShopLayout = { seats: [table('11', 1, 1), table('11', 2, 2), table('12', 14, 6)], labels: [] };
    expect(layoutProblems(layout)).toEqual(expect.arrayContaining([
      '11番が2つあります', '12番がマス目からはみ出しています', '11番と11番が重なっています',
    ]));
  });
  it('通知はポップアップにしたので、前の通知の場所（2行目の右・6列目）にも置ける（No.109）', () => {
    expect(layoutProblems({ seats: [table('13', 7, 2, 1, 1), table('14', 6, 4, 1, 1)], labels: [] })).toEqual([]);
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
  it('目印（No.128）：種類を読み、種類の無い前の「ことば」は店が足した目印として読む', () => {
    const box = { col: 5, colSpan: 2, row: 10, rowSpan: 1 };
    const layout = parseShopLayout({ seats: [table('11', 1, 1)], labels: [{ text: 'カウンター', col: 1, colSpan: 2, row: 9, rowSpan: 1 }, { kind: 'entrance', text: '入口', ...box }, { kind: 'warp', text: '階段', col: 8, colSpan: 1, row: 10, rowSpan: 1 }] });
    expect(layout?.labels.map(l => [l.kind, l.text])).toEqual([['custom', 'カウンター'], ['entrance', '入口'], ['custom', '階段']]);
    expect(DEFAULT_LAYOUT.labels[0].kind).toBe('custom');
  });
  it('目印の種類は入口・キッチン・ドリンク場・トイレ・レジと、店が足すもの', () => {
    expect(LANDMARK_KINDS.map(item => item.name)).toEqual(['入口', 'キッチン', 'ドリンク場', 'トイレ', 'レジ']);
    expect(landmarkName('kitchen')).toBe('キッチン');
    expect(landmarkName('custom')).toBeNull();
    expect(isLandmarkKind('custom')).toBe(true);
    expect(isLandmarkKind('stairs')).toBe(false);
  });
  it('店が足す目印は名前が要る', () => {
    expect(layoutProblems({ seats: [table('11', 1, 1)], labels: [{ kind: 'custom', text: ' ', col: 5, colSpan: 1, row: 5, rowSpan: 1 }] }))
      .toContain('目印の名前は1〜12文字にしてください');
  });
  it('新しい卓の番号は、使っていないいちばん小さい番号（カウンター1〜、テーブル11〜）', () => {
    expect(nextSeatId(DEFAULT_LAYOUT, 'counter')).toBe('15');
    expect(nextSeatId({ seats: [], labels: [] }, 'counter')).toBe('1');
    expect(nextSeatId(DEFAULT_LAYOUT, 'table')).toBe('15');
    expect(seatIdsOf({ seats: [table('12', 1, 3), table('3', 7, 3)], labels: [] })).toEqual(['3', '12']);
  });
  it('目印も卓と同じく縦向きに回す', () => {
    const { kind: _kind, text: _text, ...box } = DEFAULT_LAYOUT.labels[0];
    const asSeat = rotateClockwise({ id: 'x', kind: 'table' as const, ...box }, { rows: usedRows(DEFAULT_LAYOUT) });
    const { text: _, kind: __, ...rotated } = portraitOf(DEFAULT_LAYOUT).labels[0];
    expect(rotated).toEqual({ col: asSeat.col, colSpan: asSeat.colSpan, row: asSeat.row, rowSpan: asSeat.rowSpan });
  });
  it('マス目は15×10。8〜10行目にも置ける（No.108）', () => {
    expect(layoutProblems({ seats: [table('11', 1, 9)], labels: [] })).toEqual([]);
    expect(layoutProblems({ seats: [table('11', 1, 10)], labels: [] })).toEqual(['11番がマス目からはみ出しています']);
  });
  it('縦向きは置いてある行までを回す。最初の配置は9行なので、縦向きは9列（No.112）', () => {
    expect(usedRows(DEFAULT_LAYOUT)).toBe(9);
    const portrait = portraitOf(DEFAULT_LAYOUT);
    expect(portrait.grid).toEqual({ cols: 9, rows: 15 });
    const deeper = { seats: [...DEFAULT_LAYOUT.seats, table('15', 6, 9)], labels: DEFAULT_LAYOUT.labels };
    expect(usedRows(deeper)).toBe(10);
    expect(portraitOf(deeper).grid).toEqual({ cols: 10, rows: 15 });
    const shallow = { seats: [table('11', 1, 1)], labels: [] };
    expect(usedRows(shallow)).toBe(2);
    expect(portraitOf(shallow).grid).toEqual({ cols: 2, rows: 15 });
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
