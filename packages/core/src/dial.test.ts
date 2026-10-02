import { describe, expect, it } from 'vitest';
import { advance, newSession } from './domain';
import { arcPath, dialLabel, dialOf, dialPoint, formatHourMinute, remainingLabel, remainingOf } from './dial';

const minute = 60_000;
const seated = newSession('s', '12', 0);
const otoshi = advance(seated, 5 * minute);
const loDone = advance(otoshi, 95 * minute);
const exited = advance(loDone, 100 * minute);
// コース：開始待ち（ファーストドリンクまで数えない）→ ファーストドリンク提供済み
const courseWait = newSession('c', '13', 0, 3, 'drinks');
const firstDrink = advance(courseWait, 10 * minute);

describe('文字盤の進み', () => {
  it('案内から分で数え、120分で一周する（切り捨て）', () => {
    expect(dialOf(seated, 35 * minute + 59_000)).toEqual({ elapsedMin: 35, progress: 35 / 120, over: false });
    expect(dialOf(otoshi, 120 * minute - 1)).toEqual({ elapsedMin: 119, progress: 119 / 120, over: false });
    expect(dialOf(otoshi, 120 * minute)).toEqual({ elapsedMin: 120, progress: 1, over: true });
    expect(dialOf(otoshi, 150 * minute)).toEqual({ elapsedMin: 150, progress: 1, over: true });
  });
  it('コースはファーストドリンクから数え、開始待ちは数えない', () => {
    expect(dialOf(courseWait, 30 * minute)).toEqual({ elapsedMin: null, progress: 0, over: false });
    expect(dialOf(firstDrink, 40 * minute)).toEqual({ elapsedMin: 30, progress: 30 / 120, over: false });
  });
  it('退店済は退店の時刻で止める', () => {
    expect(dialOf(exited, 103 * minute).elapsedMin).toBe(100);
  });
  it('時刻が戻っても負にしない', () => {
    expect(dialOf(seated, -minute).elapsedMin).toBe(0);
  });
});

describe('残り時間', () => {
  it('L.O.確認済みまでは L.O.まで（切り上げ）', () => {
    expect(remainingOf(seated, 35 * minute)).toEqual({ kind: 'last_order', minutes: 55 });
    expect(remainingOf(otoshi, 90 * minute - 30_000)).toEqual({ kind: 'last_order', minutes: 1 });
  });
  it('L.O.の時間を過ぎるか L.O.確認済みにしたら退席まで', () => {
    expect(remainingOf(otoshi, 91 * minute)).toEqual({ kind: 'seat_limit', minutes: 29 });
    expect(remainingOf(otoshi, 90 * minute)).toEqual({ kind: 'seat_limit', minutes: 30 });
    expect(remainingOf(loDone, 60 * minute)).toEqual({ kind: 'seat_limit', minutes: 60 });
    expect(remainingOf(loDone, 118 * minute)).toEqual({ kind: 'seat_limit', minutes: 2 });
  });
  it('120分を過ぎたらお席の時間を過ぎている', () => {
    expect(remainingOf(loDone, 120 * minute)).toEqual({ kind: 'over' });
  });
  it('退店済・コースの開始待ちは出さない', () => {
    expect(remainingOf(exited, 101 * minute)).toBeNull();
    expect(remainingOf(courseWait, 30 * minute)).toBeNull();
    expect(remainingOf(firstDrink, 40 * minute)).toEqual({ kind: 'last_order', minutes: 60 });
  });
  it('文言', () => {
    expect(remainingLabel({ kind: 'last_order', minutes: 55 })).toBe('L.O.まで55分');
    expect(remainingLabel({ kind: 'seat_limit', minutes: 29 })).toBe('退席まで29分');
    expect(remainingLabel({ kind: 'over' })).toBe('お席の時間を過ぎています');
  });
});

describe('表示と読み上げ', () => {
  it('時:分', () => {
    expect(formatHourMinute(0)).toBe('0:00');
    expect(formatHourMinute(35)).toBe('0:35');
    expect(formatHourMinute(118)).toBe('1:58');
  });
  it('経過と残りを読み上げる', () => {
    expect(dialLabel(dialOf(seated, 35 * minute), remainingOf(seated, 35 * minute))).toBe('経過35分、L.O.まで55分');
    expect(dialLabel(dialOf(courseWait, 0), null)).toBe('開始前');
  });
});

describe('円弧', () => {
  it('12時から時計回り', () => {
    const top = dialPoint(0, 50, 50, 40);
    expect(top.x).toBeCloseTo(50);
    expect(top.y).toBeCloseTo(10);
    const right = dialPoint(0.25, 50, 50, 40);
    expect(right.x).toBeCloseTo(90);
    expect(right.y).toBeCloseTo(50);
  });
  it('長さ0は描かず、半周を超えたら大きい弧、一周は2つに分ける', () => {
    expect(arcPath(0, 0, 50, 50, 40)).toBe('');
    expect(arcPath(0, 0.25, 50, 50, 40)).toBe('M 50 10 A 40 40 0 0 1 90 50');
    expect(arcPath(0, 0.75, 50, 50, 40)).toBe('M 50 10 A 40 40 0 1 1 10 50');
    expect(arcPath(0, 1, 50, 50, 40)).toBe('M 50 10 A 40 40 0 0 1 50 90 M 50 90 A 40 40 0 0 1 50 10');
  });
});
