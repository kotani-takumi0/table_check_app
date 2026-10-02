// ツールバーのサボテンの時計の印（24×24）。茎色の楕円の縁に10個の点、針はいまの時刻を指す
export interface Point { x: number; y: number }
const C = 12, RX = 10, RY = 11;
// 楕円の上の点。fraction は12時を0とした時計回りの割合
function onEllipse(fraction: number, scale: number): Point {
  const angle = 2 * Math.PI * fraction - Math.PI / 2;
  const round = (n: number) => Math.round(n * 100) / 100;
  return { x: round(C + RX * scale * Math.cos(angle)), y: round(C + RY * scale * Math.sin(angle)) };
}
const DOTS = Array.from({ length: 10 }, (_, i) => onEllipse(i / 10, 0.78));
export function cactusClock(time: number): { dots: Point[]; hour: Point; minute: Point } {
  const date = new Date(time);
  const minutes = date.getMinutes() + date.getSeconds() / 60;
  const hours = (date.getHours() % 12) + minutes / 60;
  return { dots: DOTS, hour: onEllipse(hours / 12, 0.42), minute: onEllipse(minutes / 60, 0.6) };
}
