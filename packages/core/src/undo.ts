import { useCallback, useEffect, useState } from 'react';
import { displayOf, RULES, STATUS_LABEL, type Rules, type Session } from './domain';
import type { ShopTimerDone, ShopTimerId } from './shopTimers';

// 押し間違えを数秒のうちだけ戻せるようにする（No.102・No.121）。「案内を取り消す」「1つ戻す」「L.O.確認済みにする」「済にする」と、詳細の次の状態へのボタン（No.122）が対象。
// 確認ダイアログを出すより速く、営業中の手を止めない。戻すときは前の中身（ID・時刻）をそのまま書き戻す
export type Undo =
  // after が null は、お客さんの記録を消した（案内を取り消した）
  | { kind: 'session'; message: string; before: Session; after: Session | null }
  // before が undefined は、一度も済にしていなかった
  | { kind: 'shop_timer'; message: string; id: ShopTimerId; before: number | undefined; after: number };
// 「元に戻す」を出しておく長さ
export const UNDO_MS = 6000;
// ok：戻せる / changed：ほかの端末などで中身が変わった / taken：取り消した卓に別のお客さんを案内した
export type UndoCheck = 'ok' | 'changed' | 'taken';
export const UNDO_REFUSED: Record<Exclude<UndoCheck, 'ok'>, string> = {
  changed: 'ほかの端末で変わったので、元に戻せませんでした',
  taken: 'その卓にはもう次のお客さんがいるので、元に戻せませんでした',
};

const tables = (session: Session) => `${session.tableIds.join('・')}番`;
// 段階と時刻・卓が同じなら、そのあと誰も触っていないとみなす
function sameStep(a: Session, b: Session): boolean {
  return a.status === b.status && a.seatedAt === b.seatedAt && a.otoshiAt === b.otoshiAt && a.loDoneAt === b.loDoneAt && a.exitedAt === b.exitedAt
    && a.tableIds.join(',') === b.tableIds.join(',');
}

// 「案内を取り消す」「1つ戻す」のあと（after は revert の結果。null は記録を消した）
export function backUndo(before: Session, after: Session | null, rules: Rules = RULES): Undo {
  const message = after === null ? `${tables(before)}の案内を取り消しました`
    : `${tables(before)}を「${STATUS_LABEL[displayOf(after.status, after.course, rules)]}」に戻しました`;
  return { kind: 'session', message, before, after };
}
// 詳細の次の状態へのボタン・通知の「L.O.確認済みにする」のあと
export function nextUndo(before: Session, after: Session, rules: Rules = RULES): Undo {
  return { kind: 'session', message: `${tables(before)}を「${STATUS_LABEL[displayOf(after.status, after.course, rules)]}」にしました`, before, after };
}
export function shopTimerUndo(id: ShopTimerId, label: string, before: number | undefined, after: number): Undo {
  return { kind: 'shop_timer', message: `${label}を済にしました`, id, before, after };
}

// 今の中身を見て、戻してよいかを決める（sessions は卓に出ているお客さん）
export function checkUndo(undo: Undo, sessions: Session[], done: ShopTimerDone): UndoCheck {
  if (undo.kind === 'shop_timer') return done[undo.id] === undo.after ? 'ok' : 'changed';
  const current = sessions.find(s => s.id === undo.before.id);
  if (undo.after === null) {
    if (current) return 'changed';
    // 取り消した卓に、そのあと案内したお客さんがいれば戻さない（戻すと卓を取り返してしまう）。退店済みの表示だけなら置き換えてよい
    const taken = sessions.some(s => s.status !== 'exited' && s.tableIds.some(id => undo.before.tableIds.includes(id)));
    return taken ? 'taken' : 'ok';
  }
  return current && sameStep(current, undo.after) ? 'ok' : 'changed';
}

// 最後の1件だけを数秒出す。新しい操作をしたら前のものは戻せなくなる
export function useUndo(): { undo: (Undo & { key: number }) | null; offer(undo: Undo): void; clear(): void } {
  const [undo, setUndo] = useState<(Undo & { key: number }) | null>(null);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);
  const offer = useCallback((next: Undo) => setUndo(current => ({ ...next, key: (current?.key ?? 0) + 1 })), []);
  const clear = useCallback(() => setUndo(null), []);
  return { undo, offer, clear };
}
