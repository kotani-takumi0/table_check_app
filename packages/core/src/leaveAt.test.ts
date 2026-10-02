import { describe, expect, it } from 'vitest';
import { advance, alertOf, lastOrderDue, limitsOf, newSession, setLeaveAt } from './domain';
import { bandOf, dialOf, remainingOf } from './dial';
import { fromSessionDoc, toSessionDoc } from './firestoreMapping';
import { noticesOf } from './notices';

const minute = 60_000;
const seated = newSession('s', '12', 0);
const otoshi = advance(seated, 5 * minute);
// 案内から60分で退店してもらう卓（L.O.はその30分前の30分）
const early = setLeaveAt(otoshi, 60 * minute)!;

describe('卓ごとの退店の時刻', () => {
  it('ふつうは数え始めから120分・L.O.は90分', () => {
    expect(limitsOf(otoshi)).toEqual({ lastOrderAt: 90 * minute, seatEndAt: 120 * minute });
  });
  it('決めた卓は、その時刻とその30分前に L.O.・お席の時間の警告を出す', () => {
    expect(limitsOf(early)).toEqual({ lastOrderAt: 30 * minute, seatEndAt: 60 * minute });
    expect(alertOf(early, 30 * minute - 1)).toEqual({ level: 'none', reason: null });
    expect(alertOf(early, 30 * minute)).toEqual({ level: 'soon', reason: 'last_order' });
    expect(alertOf(early, 60 * minute)).toEqual({ level: 'now', reason: 'seat_limit' });
    expect(lastOrderDue([early, otoshi], 31 * minute)).toEqual([early]);
  });
  it('残り時間・文字盤の帯もその時刻に合わせる', () => {
    expect(remainingOf(early, 20 * minute)).toEqual({ kind: 'last_order', minutes: 10 });
    expect(remainingOf(early, 40 * minute)).toEqual({ kind: 'seat_limit', minutes: 20 });
    expect(remainingOf(early, 60 * minute)).toEqual({ kind: 'over' });
    expect(dialOf(early, 60 * minute).over).toBe(true);
    expect(bandOf(early)).toEqual({ from: 30 / 120, to: 60 / 120 });
    expect(bandOf(otoshi)).toEqual({ from: 90 / 120, to: 1 });
  });
  it('案内より前の時刻は決められず、null でふつうに戻せる', () => {
    expect(setLeaveAt(otoshi, 0)).toBeNull();
    expect(setLeaveAt(early, null)?.leaveAt).toBeNull();
  });
  it('時刻を直したら L.O.の通知を出し直す（決めていない卓は以前と同じ key）', () => {
    const [plain] = noticesOf([otoshi], { toilet_check: 100 * minute, toilet_clean: 100 * minute }, 100 * minute);
    expect(plain.key).toBe('lo:s:0');
    const [moved] = noticesOf([early], { toilet_check: 100 * minute, toilet_clean: 100 * minute }, 50 * minute);
    expect(moved.key).toBe(`lo:s:0:${60 * minute}`);
  });
  it('Firestore に保存して読み戻せ、無い文書はふつうとして読む', () => {
    expect(fromSessionDoc('s', toSessionDoc(early))?.leaveAt).toBe(60 * minute);
    const { leaveAt: _, ...old } = toSessionDoc(otoshi);
    expect(fromSessionDoc('s', old)?.leaveAt).toBeNull();
    expect(fromSessionDoc('s', { ...old, leaveAt: 'x' })).toBeNull();
  });
});
