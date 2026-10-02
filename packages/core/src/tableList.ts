import { alertOf, isVisible, occupantOf, startOf, type Session } from './domain';

const LEVEL_ORDER = { now: 0, soon: 1, none: 2 } as const;
export interface TableListRow {
  session: Session;
  tables: string[];   // いまこのお客さんが出ている卓（退店済の卓に次のお客さんを案内したら、その卓は外す）
}
// 全卓一覧の並び：急ぐ順（いま対応 → もうすぐ → 経過の長い順）。空席は出さない。
// フロアと同じく、卓ごとに「最後に案内したお客さん」だけを出す（退店済の卓に次のお客さんを案内したら前のお客さんは出さない）。
// 警告のない卓のうち、コースの開始待ち（経過を数えていない）は経過のある卓のあと、退店済は一番最後。
// 団体は1行（セッションごと）。同じ順位どうしは卓番の小さい順にして、並びが揺れないようにする
export function urgentOrder(sessions: Session[], now: number): TableListRow[] {
  const key = (s: Session, tables: string[]) => {
    const start = startOf(s);
    return {
      level: LEVEL_ORDER[alertOf(s, now).level],
      kind: s.status === 'exited' ? 2 : start === null ? 1 : 0,
      start: start ?? s.seatedAt,   // 早く数え始めた（経過の長い）卓ほど前
      table: Math.min(...tables.map(Number)),
    };
  };
  return sessions
    .filter(s => isVisible(s, now))
    .map(session => ({ session, tables: session.tableIds.filter(id => occupantOf(sessions, id, now)?.id === session.id) }))
    .filter(row => row.tables.length > 0)
    .map(row => ({ row, k: key(row.session, row.tables) }))
    .sort((a, b) => a.k.level - b.k.level || a.k.kind - b.k.kind || a.k.start - b.k.start || a.k.table - b.k.table)
    .map(({ row }) => row);
}
