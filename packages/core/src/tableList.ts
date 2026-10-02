import { alertOf, isVisible, startOf, type Session } from './domain';

const LEVEL_ORDER = { now: 0, soon: 1, none: 2 } as const;
// 全卓一覧の並び：急ぐ順（いま対応 → もうすぐ → 経過の長い順）。空席は出さない（表示中のセッションだけ）。
// 警告のない卓のうち、コースの開始待ち（経過を数えていない）は経過のある卓のあと、退店済は一番最後。
// 団体は1行（セッションごと）。同じ順位どうしは卓番の小さい順にして、並びが揺れないようにする
export function urgentOrder(sessions: Session[], now: number): Session[] {
  const key = (s: Session) => {
    const start = startOf(s);
    return {
      level: LEVEL_ORDER[alertOf(s, now).level],
      kind: s.status === 'exited' ? 2 : start === null ? 1 : 0,
      start: start ?? s.seatedAt,   // 早く数え始めた（経過の長い）卓ほど前
      table: Math.min(...s.tableIds.map(Number)),
    };
  };
  return sessions
    .filter(s => isVisible(s, now))
    .map(s => ({ s, k: key(s) }))
    .sort((a, b) => a.k.level - b.k.level || a.k.kind - b.k.kind || a.k.start - b.k.start || a.k.table - b.k.table)
    .map(({ s }) => s);
}
