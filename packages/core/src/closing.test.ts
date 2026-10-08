import { describe, expect, it } from 'vitest';
import { advance, newSession, revert } from './domain';
import { closeOutAtOf, closeOuts, closingAtOf, closingLabel, CLOSING_CHOICES, isClosingMin } from './closing';
import { fromSessionDoc, toSessionDoc } from './firestoreMapping';

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
const H23 = 23 * 60, H1 = 60;

describe('閉店時刻（No.129）', () => {
  it('15分ごとの 0時からの分だけを閉店時刻として読む', () => {
    expect([0, 15, 1410, 1425].every(isClosingMin)).toBe(true);
    expect([null, -15, 1440, 1412, '1410', 23.5].some(isClosingMin)).toBe(false);
  });
  it('選べる時刻は朝4時から次の日の3:45まで、深夜は「深夜」を付けて出す', () => {
    expect(CLOSING_CHOICES[0]).toBe(240);
    expect(CLOSING_CHOICES.at(-1)).toBe(225);
    expect(CLOSING_CHOICES).toHaveLength(96);
    expect([closingLabel(1410), closingLabel(0), closingLabel(90)]).toEqual(['23:30', '深夜0:00', '深夜1:30']);
  });
  it('0〜3時台の閉店時刻は、その営業日の次の日付', () => {
    expect(closingAtOf('2026-10-03', H23)).toBe(at(3, 23));
    expect(closingAtOf('2026-10-03', H1)).toBe(at(4, 1));
    expect(closingAtOf('2026-13-03', H23)).toBeNull();
  });
  it('閉店時刻より後に案内したお客さんは、その営業日の終わり（朝4時）に閉じる', () => {
    expect(closeOutAtOf(newSession('a', '12', at(3, 20)), H23)).toBe(at(3, 23));
    expect(closeOutAtOf(newSession('a', '12', at(3, 23, 10)), H23)).toBe(at(4, 4));
    // 深夜0時を過ぎて案内しても、営業日は前の日
    expect(closeOutAtOf(newSession('a', '12', at(4, 0, 30)), H1)).toBe(at(4, 1));
  });
  it('閉店時刻を過ぎて退店していない卓を、閉店時刻で退店にする', () => {
    const seated = newSession('a', '12', at(3, 20));
    const exited = advance(advance(advance(newSession('b', '13', at(3, 19)), at(3, 19, 5)), at(3, 20, 30)), at(3, 21));
    const cleared = { ...newSession('c', '14', at(3, 20)), clearedAt: at(3, 22) };
    expect(closeOuts([seated, exited, cleared], at(3, 22, 59), H23)).toEqual([]);
    expect(closeOuts([seated, exited, cleared], at(3, 23), H23)).toEqual([{ ...seated, status: 'exited', exitedAt: at(3, 23), exitedByClosing: true }]);
    // 閉店時刻を決めていなければ何もしない
    expect(closeOuts([seated], at(5, 12), null)).toEqual([]);
  });
  it('次の日に開いた端末でも、退店の時刻は閉店時刻', () => {
    const [closed] = closeOuts([newSession('a', '12', at(3, 20))], at(4, 18), H23);
    expect(closed.exitedAt).toBe(at(3, 23));
  });
  it('「1つ戻す」で閉店の前の本当の状態に戻る', () => {
    const seated = newSession('a', '12', at(3, 20));
    const otoshi = advance(seated, at(3, 20, 5));
    for (const before of [seated, otoshi]) {
      const [closed] = closeOuts([before], at(3, 23), H23);
      expect(revert(closed)).toEqual(before);
    }
  });
  it('お通し前に閉店で退店にした卓も、保存して読み直せる', () => {
    const [closed] = closeOuts([newSession('a', '12', at(3, 20))], at(3, 23), H23);
    const doc = toSessionDoc(closed);
    expect(doc.exitedByClosing).toBe(true);
    expect(fromSessionDoc('a', doc)).toEqual(closed);
    // 印の無い退店は、今までどおりお通し・L.O.確認の時刻が要る
    expect(fromSessionDoc('a', { ...doc, exitedByClosing: false })).toBeNull();
    // ふつうの卓も印を false で書く（merge で書くので、戻したときに true を残さない）
    expect(toSessionDoc(seatedOf()).exitedByClosing).toBe(false);
  });
});
function seatedOf() { return newSession('z', '1', at(3, 18)); }
