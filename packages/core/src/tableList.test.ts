import { describe, expect, it } from 'vitest';
import { advance, newSession, type Session } from './domain';
import { urgentOrder } from './tableList';

const m = 60_000;
const now = 200 * m;
const seatedAgo = (id: string, table: string, ago: number, course: Session['course'] = null) => newSession(id, table, now - ago * m, 2, course);
describe('全卓一覧の並び', () => {
  it('いま対応 → もうすぐ → 経過の長い順', () => {
    const fresh = advance(seatedAgo('fresh', '31', 10), now - 8 * m);          // お通し済・10分
    const older = advance(seatedAgo('older', '34', 60), now - 58 * m);         // お通し済・60分
    const lastOrder = advance(seatedAgo('lo', '36', 95), now - 90 * m);        // L.O.の時間（もうすぐ）
    const noOtoshi = seatedAgo('otoshi', '12', 20);                            // お通し未提供（いま対応）
    const overTime = advance(advance(seatedAgo('over', '14', 130), now - 120 * m), now - 30 * m); // お席の時間（いま対応）
    expect(urgentOrder([fresh, older, lastOrder, noOtoshi, overTime], now).map(r => r.session.id)).toEqual(['over', 'otoshi', 'lo', 'older', 'fresh']);
  });
  it('コースの開始待ちは経過のある卓のあと、退店済は一番最後', () => {
    const waiting = seatedAgo('wait', '13', 50, 'drinks');
    const exited = advance(advance(advance(seatedAgo('exit', '11', 100), now - 95 * m), now - 92 * m), now - 2 * m);
    const normal = advance(seatedAgo('normal', '21', 5), now - 4 * m);
    expect(urgentOrder([exited, waiting, normal], now).map(r => r.session.id)).toEqual(['normal', 'wait', 'exit']);
  });
  it('空席（表示が終わった退店済）は出さず、団体は1行', () => {
    const gone = advance(advance(advance(seatedAgo('gone', '11', 100), now - 95 * m), now - 92 * m), now - 10 * m);
    const group = { ...seatedAgo('group', '12', 30), tableIds: ['12', '14'] };
    expect(urgentOrder([gone, group], now).map(r => r.session.id)).toEqual(['group']);
  });
  it('同じ順位は卓番の小さい順', () => {
    const a = advance(seatedAgo('a', '22', 30), now - 29 * m);
    const b = advance(seatedAgo('b', '8', 30), now - 29 * m);
    expect(urgentOrder([a, b], now).map(r => r.session.id)).toEqual(['b', 'a']);
  });
});
describe('全卓一覧に出す卓', () => {
  const exitedGroup = { ...advance(advance(advance(seatedAgo('old', '12', 100), now - 95 * m), now - 92 * m), now - 2 * m), tableIds: ['12', '14'] };
  const next = seatedAgo('new', '12', 1);
  it('退店済の卓に次のお客さんを案内したら、前のお客さんはその卓では出さない（団体の残りの卓では出す）', () => {
    expect(urgentOrder([exitedGroup, next], now).map(r => [r.session.id, r.tables])).toEqual([['new', ['12']], ['old', ['14']]]);
  });
  it('全部の卓が置き換わったら前のお客さんは出さない', () => {
    expect(urgentOrder([{ ...exitedGroup, tableIds: ['12'] }, next], now).map(r => r.session.id)).toEqual(['new']);
  });
});
