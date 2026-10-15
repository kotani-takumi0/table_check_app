import { expect, it } from 'vitest';
import { FLOOR_CHROME, MIN_LABEL_PX, MIN_TAP_PX, MIN_TIME_PX, floorCellPx, floorOverflows, seatTapPx, type FloorFrame } from './floorScale';

// 以前の計算：幅には必ず合わせ、高さだけ下限で止めて縦にスクロールしていた
const legacyCellPx = (frame: FloorFrame) => {
  const fitW = (frame.width - 2 * frame.padX - (frame.cols - 1) * frame.gap) / frame.cols;
  const fitH = (frame.height - 2 * frame.padY - (frame.rows - 1) * frame.gap) / frame.rows;
  return Math.min(fitW, Math.max(fitH, frame.minCell));
};
const frame = (partial: FloorFrame): FloorFrame => partial;

it('文字と押せる範囲の下限', () => {
  expect(MIN_TAP_PX).toBe(44);
  expect(MIN_LABEL_PX).toBe(11);
  expect(MIN_TIME_PX).toBe(14);
  expect(FLOOR_CHROME.mini.minCell).toBe(MIN_TAP_PX);
  expect(FLOOR_CHROME.regular.minCell).toBeGreaterThanOrEqual(MIN_TAP_PX);
});

it('幅が下限以上の画面は、今までと同じマスの大きさ', () => {
  // 横向きタブレット（1080×810、帯56、15列×10行）と、縦向きの iPad（768×1024、帯56、回した9列×15行）
  const tablets = [
    frame({ width: 1080, height: 810 - 56, cols: 15, rows: 10, ...FLOOR_CHROME.regular }),
    frame({ width: 768, height: 1024 - 56, cols: 9, rows: 15, ...FLOOR_CHROME.regular }),
  ];
  for (const item of tablets) {
    expect(legacyCellPx(item)).toBeGreaterThan(item.minCell);
    expect(floorCellPx(item)).toBe(legacyCellPx(item));
    expect(floorOverflows(item)).toEqual({ x: false, y: false });
  }
  // 大きいスマホの横向き（高さ側だけ下限に当たる。幅は足りているので、今までと同じく縦だけスクロール）
  const landscape = frame({ width: 926, height: 428 - 48, cols: 15, rows: 9, ...FLOOR_CHROME.mini });
  expect(legacyCellPx(landscape)).toBeGreaterThanOrEqual(landscape.minCell);
  expect(floorCellPx(landscape)).toBe(legacyCellPx(landscape));
  expect(floorOverflows(landscape)).toEqual({ x: false, y: true });
});

it('幅375px・320pxの縦向きは1マスを44pxで止め、配置図だけがはみ出す', () => {
  // ヘッダーは48px。回した配置は、置いてある行までなら9列、マス目いっぱいなら10列
  for (const width of [375, 320]) {
    for (const cols of [9, 10]) {
      const phone = frame({ width, height: (width === 375 ? 667 : 568) - 48, cols, rows: 15, ...FLOOR_CHROME.mini });
      expect(legacyCellPx(phone)).toBeLessThan(MIN_TAP_PX);
      expect(floorCellPx(phone)).toBe(MIN_TAP_PX);
      expect(seatTapPx(floorCellPx(phone), 1, phone.gap)).toBeGreaterThanOrEqual(MIN_TAP_PX);
      expect(seatTapPx(floorCellPx(phone), 2, phone.gap)).toBeGreaterThan(MIN_TAP_PX);
      const over = floorOverflows(phone);
      expect(over.x || over.y).toBe(true);
    }
  }
});

it('幅だけ足りないときは横にはみ出し、高さだけ足りないときは縦にはみ出す', () => {
  const narrow = frame({ width: 200, height: 900, cols: 4, rows: 2, gap: 4, padX: 8, padY: 8, minCell: 44 });
  expect(floorCellPx(narrow)).toBe(44);
  expect(floorOverflows(narrow)).toEqual({ x: true, y: false });
  const short = frame({ width: 900, height: 80, cols: 4, rows: 6, gap: 4, padX: 8, padY: 8, minCell: 44 });
  expect(floorOverflows(short)).toEqual({ x: false, y: true });
});
