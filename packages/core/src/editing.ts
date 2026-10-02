// 「編集中」の印（No.72）：複数人で使うとき、誰かが詳細を開いている卓を、ほかの端末に知らせる。
// 詳細を開いている端末は、開いているお客さん（セッション）を HEARTBEAT_MS ごとに書き直し、閉じたら消す。
// 端末が落ちて消せなかった印は、FRESH_MS を過ぎたら出さない
export const EDITING_HEARTBEAT_MS = 20_000;
export const EDITING_FRESH_MS = 60_000;
// これより古い印は、見た端末が消す（閉じずにアプリを落とした端末の印が溜まり続けないように）
export const EDITING_STALE_MS = 10 * 60_000;
export interface EditingMark { sessionId: string; at: number }
export interface EditingStore {
  // ほかの端末が開いているお客さんの ID（自分の端末は含めない）
  subscribe(cb: (marks: EditingMark[]) => void): () => void;
  // この端末で詳細を開いた（null で閉じた）
  setEditing(sessionId: string | null): void;
}
// 新しい印だけを、お客さんの ID の集まりにする
export function editingSessionIds(marks: EditingMark[], now: number): Set<string> {
  return new Set(marks.filter(mark => now - mark.at < EDITING_FRESH_MS).map(mark => mark.sessionId));
}
// Firebase につながないとき（1台だけで試す）は、ほかの端末が無いので何もしない
export class NoEditingStore implements EditingStore {
  subscribe(cb: (marks: EditingMark[]) => void): () => void { cb([]); return () => undefined; }
  setEditing(): void { /* ほかの端末が無い */ }
}
