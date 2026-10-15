// 配置図のマスを、指で押せる大きさより小さくしない（No.146）。
// 横15×縦10のマスを縦向きで回すと横が10列になり、画面幅に押し込むと1マスが44pxを切る。
// 画面の縦横に入る正方形まで縮めるが、下限で止め、はみ出した分は配置図だけをスクロールする。
// 下限に当たらない画面（iPad や、マスが下限より大きいスマホ）は、今までと同じ大きさになる。

// 1マスの卓も、押せる範囲はこの一辺以上
export const MIN_TAP_PX = 44;
// 卓番・段階など、卓に出す文字の下限
export const MIN_LABEL_PX = 11;
// 経過時間（時:分）の文字の下限
export const MIN_TIME_PX = 14;
// 枠の余白・マスの間・下限。Web の配置図（通常とスマホ）と同じ値
export const FLOOR_CHROME = {
  regular: { gap: 6, padX: 16, padY: 14, minCell: 56 },
  mini: { gap: 4, padX: 8, padY: 8, minCell: MIN_TAP_PX },
} as const;

export interface FloorFrame {
  width: number;   // 配置図の枠の内側（スクロールする領域）
  height: number;
  cols: number;
  rows: number;
  gap: number;
  padX: number;
  padY: number;
  minCell: number;
}
// 余白を除いた長さに、count 個のマスと間の隙間を入れるときの1マス
function fitPx(inner: number, count: number, gap: number): number {
  return (inner - (count - 1) * gap) / count;
}
// 1マスの一辺。画面に収まる大きさか、収まりきらないときの下限の、大きい方
export function floorCellPx(frame: FloorFrame): number {
  if (!(frame.cols >= 1 && frame.rows >= 1) || !(frame.width > 0 && frame.height > 0)) return frame.minCell;
  const fitW = fitPx(frame.width - 2 * frame.padX, frame.cols, frame.gap);
  const fitH = fitPx(frame.height - 2 * frame.padY, frame.rows, frame.gap);
  return Math.max(frame.minCell, Math.min(fitW, fitH));
}
// 下限で止めたために、枠より配置図がはみ出す方向（その方向だけスクロールする）
export function floorOverflows(frame: FloorFrame, cell = floorCellPx(frame)): { x: boolean; y: boolean } {
  const width = frame.cols * cell + Math.max(0, frame.cols - 1) * frame.gap + 2 * frame.padX;
  const height = frame.rows * cell + Math.max(0, frame.rows - 1) * frame.gap + 2 * frame.padY;
  // 小数の端数だけでスクロールバーを出さない
  return { x: width > frame.width + 0.5, y: height > frame.height + 0.5 };
}
// 卓の押せる範囲。1マスの卓はマスそのもの、複数マスは隙間を足す
export function seatTapPx(cell: number, span: number, gap: number): number {
  return span * cell + Math.max(0, span - 1) * gap;
}
