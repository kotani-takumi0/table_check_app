import { describe, expect, it } from 'vitest';
import { DEFAULT_COURSE_MENUS as COURSE_MENUS, isMenuId, menuOf, priceLabel } from './courseMenus';
import { addTable, advance, alertOf, clearSession, clockTimeNear, DEFAULT_DRINK_PLANS, dishProgress, drinkPlanName, displayOf, isCourse, isGuestCount, lastOrderDue, limitsOf, moveTable, removeTable, RULES, serveDish, setCourse, setGuests, stepGuests, setMenu, startOf, togglePaid, editTime, formatClock, formatElapsed, isPickable, isVisible, newSession, nextActionLabel, nextStatus, occupantOf, revert, timerOf, unpaidTableCount, unserveDish } from './domain';
const seated = newSession('session', '31', 10_000);
const otoshi = advance(seated, 20_000);
const loDone = advance(otoshi, 30_000);
const exited = advance(loDone, 40_000);
const minute = 60_000;
describe('状態遷移', () => {
  it('初期状態と各状態の時刻を記録し、引数を変更しない', () => {
    expect(seated).toEqual({ id: 'session', tableIds: ['31'], status: 'seated', seatedAt: 10_000, otoshiAt: null, loDoneAt: null, exitedAt: null, paidAt: null, guests: null, course: null, menu: null, dishesServed: 0, dishServedAt: [], leaveAt: null, clearedAt: null, tableLog: [], exitedByClosing: false });
    expect(otoshi).toEqual({ ...seated, status: 'otoshi', otoshiAt: 20_000 });
    expect(loDone).toEqual({ ...otoshi, status: 'lo_done', loDoneAt: 30_000 });
    expect(exited).toEqual({ ...loDone, status: 'exited', exitedAt: 40_000 });
    expect(advance(exited, 50_000)).toEqual(exited);
    expect(['seated', 'otoshi', 'lo_done', 'exited'].map(s => nextStatus(s as typeof seated.status))).toEqual(['otoshi', 'lo_done', 'exited', null]);
  });
  it('戻した状態の時刻だけ取り消す', () => {
    expect(revert(exited)).toEqual(loDone);
    expect(revert(loDone)).toEqual(otoshi);
    expect(revert(otoshi)).toEqual(seated);
    expect(revert(seated)).toBeNull();
    expect(exited.exitedAt).toBe(40_000);
  });
});
describe('警告の境界', () => {
  it.each([
    [seated, seated.seatedAt + 15 * minute - 1000, 'none', null],
    [seated, seated.seatedAt + 15 * minute, 'now', 'otoshi_missing'],
    // お通し前は席時間を数えない。120分たっても「お席の時間」ではなく「お通し未提供」
    [seated, seated.seatedAt + 120 * minute, 'now', 'otoshi_missing'],
    [otoshi, otoshi.otoshiAt! + 90 * minute - 1000, 'none', null],
    [otoshi, otoshi.otoshiAt! + 90 * minute, 'soon', 'last_order'],
    [otoshi, otoshi.otoshiAt! + 120 * minute - 1000, 'soon', 'last_order'],
    [otoshi, otoshi.otoshiAt! + 120 * minute, 'now', 'seat_limit'],
    [loDone, otoshi.otoshiAt! + 120 * minute - 1000, 'none', null],
    [loDone, otoshi.otoshiAt! + 120 * minute, 'now', 'seat_limit'],
    [exited, 40_000, 'none', null],
    [exited, 40_000 + 1000 * minute, 'none', null],
  ])('%s at %i', (session, time, level, reason) => {
    expect(alertOf(session, time)).toEqual({ level, reason });
  });
});
it('退店から5分で非表示にする', () => {
  expect(isVisible(exited, 40_000 + 5 * minute - 1000)).toBe(true);
  expect(isVisible(exited, 40_000 + 5 * minute)).toBe(false);
  for (const session of [seated, otoshi, loDone]) expect(isVisible(session, 1e12)).toBe(true);
});
it('会計前の卓数は、店にいて未払いの客の卓を数え、退店済・会計済み・見えない客は数えない', () => {
  const group = { ...otoshi, id: 'group', tableIds: ['11', '12'] };
  const paid = togglePaid({ ...seated, id: 'paid', tableIds: ['13'] }, 50_000);
  expect(unpaidTableCount([seated, group, paid, exited], 50_000)).toBe(3);
  expect(unpaidTableCount([], 50_000)).toBe(0);
});
it('タイマーはお通しから数え、お通し前は止め、退店後は退店から計算し、負にならない', () => {
  expect(timerOf(seated, 50_000)).toEqual({ label: 'お通しから', elapsedMs: null });
  for (const session of [otoshi, loDone]) expect(timerOf(session, 50_000)).toEqual({ label: 'お通しから', elapsedMs: 30_000 });
  expect(timerOf(exited, 50_000)).toEqual({ label: '退店から', elapsedMs: 10_000 });
  expect(timerOf(seated, 0).elapsedMs).toBeNull();
  for (const session of [otoshi, loDone, exited]) expect(timerOf(session, 0).elapsedMs).toBe(0);
});
it.each([[0, '00:00'], [3_599_000, '59:59'], [3_600_000, '1:00:00'], [3_661_000, '1:01:01'], [-1000, '00:00']])('formatElapsed(%i)', (ms, expected) => {
  expect(formatElapsed(ms)).toBe(expected);
});
describe('時刻の修正', () => {
  const at = (h: number, m: number, day = 26) => new Date(2026, 8, day, h, m).getTime();
  it('formatClock は HH:MM', () => {
    expect(formatClock(at(9, 5))).toBe('09:05');
  });
  it('clockTimeNear は基準に最も近い日付の時刻を返す', () => {
    expect(clockTimeNear('19:20', at(19, 10))).toBe(at(19, 20));
    expect(clockTimeNear('23:50', at(0, 10, 27))).toBe(at(23, 50, 26));
    expect(clockTimeNear('00:10', at(23, 50))).toBe(at(0, 10, 27));
    for (const bad of ['24:00', '12:60', '1:00', '']) expect(clockTimeNear(bad, at(12, 0))).toBeNull();
  });
  const s = { ...newSession('s', '11', at(19, 0)), status: 'lo_done' as const, otoshiAt: at(19, 20), loDoneAt: at(20, 50) };
  const current = at(21, 0);
  it('案内・お通しを前後関係を保つ範囲で修正できる', () => {
    expect(editTime(s, 'otoshiAt', at(19, 10), current)).toEqual({ ...s, otoshiAt: at(19, 10) });
    expect(editTime(s, 'seatedAt', at(19, 20), current)).toEqual({ ...s, seatedAt: at(19, 20) });
    expect(editTime(s, 'otoshiAt', at(18, 59), current)).toBeNull();
    expect(editTime(s, 'otoshiAt', at(20, 51), current)).toBeNull();
    expect(editTime(s, 'seatedAt', at(19, 21), current)).toBeNull();
  });
  it('未提供のお通しは修正できず、案内は現在時刻より後にできない', () => {
    expect(editTime(seated, 'otoshiAt', 10_000, 20_000)).toBeNull();
    expect(editTime(seated, 'seatedAt', 15_000, 20_000)).toEqual({ ...seated, seatedAt: 15_000 });
    expect(editTime(seated, 'seatedAt', 20_001, 20_000)).toBeNull();
  });
});
it('お通しから L.O. の時間を過ぎて未確認のお通し済セッションを、お通しが古い順に返す', () => {
  const late = advance(newSession('late', '12', 5 * minute), 30 * minute);
  const early = advance(newSession('early', '11', 1 * minute), 10 * minute);
  expect(lastOrderDue([late, early], 10 * minute + 90 * minute - 1000).map(s => s.id)).toEqual([]);
  expect(lastOrderDue([late, early], 10 * minute + 90 * minute).map(s => s.id)).toEqual(['early']);
  expect(lastOrderDue([late, early], 30 * minute + 90 * minute).map(s => s.id)).toEqual(['early', 'late']);
  expect(lastOrderDue([advance(early, 50 * minute), newSession('seated', '13', 0)], 200 * minute)).toEqual([]);
});
it('お会計は状態とは独立に切り替えられ、進める・戻すでは変わらない', () => {
  const paid = togglePaid(otoshi, 70_000);
  expect(paid).toEqual({ ...otoshi, paidAt: 70_000 });
  expect(togglePaid(paid, 80_000)).toEqual(otoshi);
  expect(advance(paid, 90_000).paidAt).toBe(70_000);
  expect(revert(paid)?.paidAt).toBe(70_000);
});
describe('卓の移動・団体', () => {
  const group = { ...otoshi, tableIds: ['11', '12'] };
  const T = 100_000;
  it('移動は指定した卓だけ付け替え、状態・時刻・会計は引き継ぐ', () => {
    expect(moveTable(otoshi, '31', '15', T)).toEqual({ ...otoshi, tableIds: ['15'], tableLog: [{ at: T, kind: 'move', from: '31', to: '15' }] });
    expect(moveTable(group, '12', '21', T)?.tableIds).toEqual(['11', '21']);
    expect(moveTable(group, '11', '3', T)?.tableIds).toEqual(['3', '12']);
  });
  it('持っていない卓からの移動・すでに持っている卓への移動はしない', () => {
    expect(moveTable(group, '13', '14', T)).toBeNull();
    expect(moveTable(group, '11', '12', T)).toBeNull();
  });
  it('追加は数値順に並べ、重複は追加しない', () => {
    expect(addTable(otoshi, '5', T)).toEqual({ ...otoshi, tableIds: ['5', '31'], tableLog: [{ at: T, kind: 'add', from: null, to: '5' }] });
    expect(addTable(group, '12', T)).toBeNull();
  });
  it('外すのは2卓以上のときだけ', () => {
    expect(removeTable(group, '11', T)).toEqual({ ...group, tableIds: ['12'], tableLog: [{ at: T, kind: 'remove', from: '11', to: null }] });
    expect(removeTable(otoshi, '31', T)).toBeNull();
    expect(removeTable(group, '13', T)).toBeNull();
  });
  it('卓の動きは、した順にすべて残す（No.113）', () => {
    const moved = moveTable(otoshi, '31', '15', T)!;
    const added = addTable(moved, '16', T + 1)!;
    const removed = removeTable(added, '15', T + 2)!;
    expect(removed.tableLog.map(move => move.kind)).toEqual(['move', 'add', 'remove']);
    expect(removed.tableIds).toEqual(['16']);
  });
});
describe('全卓消去（No.113）', () => {
  it('記録は残して消した時刻を付け、卓には出さない', () => {
    const cleared = clearSession(otoshi, 200_000);
    expect(cleared).toEqual({ ...otoshi, clearedAt: 200_000 });
    expect(isVisible(otoshi, 200_000)).toBe(true);
    expect(isVisible(cleared, 200_000)).toBe(false);
    expect(occupantOf([cleared], '31', 200_000)).toBeUndefined();
  });
  it('2回消しても最初の時刻のまま', () => {
    expect(clearSession(clearSession(otoshi, 200_000), 300_000).clearedAt).toBe(200_000);
  });
  it('消したお客さんには L.O. を知らせない', () => {
    const late = 200 * minute;
    expect(lastOrderDue([otoshi], late)).toEqual([otoshi]);
    expect(lastOrderDue([clearSession(otoshi, late)], late)).toEqual([]);
  });
  it('消したお客さんは未払いの卓に数えない', () => {
    expect(unpaidTableCount([clearSession(otoshi, 200_000)], 200_000)).toBe(0);
  });
});
describe('人数', () => {
  it('案内時に人数を入れられ、入れなければ未入力', () => {
    expect(newSession('s', '12', 0, 4).guests).toBe(4);
    expect(newSession('s', '12', 0).guests).toBeNull();
  });
  it('1〜99名の整数と未入力に変えられ、それ以外は変えない', () => {
    expect(setGuests(otoshi, 8)).toEqual({ ...otoshi, guests: 8 });
    expect(setGuests({ ...otoshi, guests: 8 }, null)).toEqual(otoshi);
    for (const bad of [0, 100, 2.5, -1, NaN]) expect(setGuests(otoshi, bad)).toBeNull();
    expect([1, 99].every(isGuestCount)).toBe(true);
    expect(['3', null, undefined].some(isGuestCount)).toBe(false);
  });
  it('ご案内の −／＋ は1人ずつ変わり、1名から − で未入力、99名で止まる', () => {
    expect(stepGuests(null, 1)).toBe(1);
    expect(stepGuests(3, 1)).toBe(4);
    expect(stepGuests(99, 1)).toBe(99);
    expect(stepGuests(3, -1)).toBe(2);
    expect(stepGuests(1, -1)).toBeNull();
    expect(stepGuests(null, -1)).toBeNull();
  });
  it('人数は状態の進み・戻し・卓の移動・追加で変わらない（団体は全員の人数のまま）', () => {
    const four = { ...otoshi, guests: 4 };
    expect(advance(four, 90_000).guests).toBe(4);
    expect(revert(four)?.guests).toBe(4);
    expect(moveTable(four, '31', '12', 1)?.guests).toBe(4);
    expect(addTable(four, '12', 1)?.guests).toBe(4);
  });
});
describe('コースの料理', () => {
  const casual = newSession('m', '12', 0, 4, 'drinks', 'casual');
  it('メニューは id が重ならず、どのコースにも料理がある', () => {
    expect(new Set(COURSE_MENUS.map(menu => menu.id)).size).toBe(COURSE_MENUS.length);
    expect(COURSE_MENUS.every(menu => menu.dishes.length > 0 && isMenuId(menu.id))).toBe(true);
    for (const bad of ['', 'X', 'a-b', null, undefined, 1]) expect(isMenuId(bad)).toBe(false);
  });
  it('選ぶボタンは値段の安い順に並び、値段は桁区切りで出す', () => {
    const prices = COURSE_MENUS.map(menu => menu.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(priceLabel(menuOf('meat_share')!)).toBe('4,000円');
    expect(priceLabel(menuOf('nijikai')!)).toBe('1,500円');
  });
  it('案内時にどのコースかを入れられる。通常の卓や知らない id は未選択にする', () => {
    expect(casual).toMatchObject({ menu: 'casual', dishesServed: 0 });
    expect(newSession('s', '12', 0, 4, null, 'casual').menu).toBeNull();
    expect(newSession('s', '12', 0, 4, 'drinks', 'X!').menu).toBeNull();
    expect(newSession('s', '12', 0, 4, 'drinks').menu).toBeNull();
  });
  it('メニューの順に1品ずつ進め、全部出したらそれ以上進めない', () => {
    const total = menuOf('casual')!.dishes.length;
    expect(dishProgress(casual)).toEqual({ served: 0, total, next: menuOf('casual')!.dishes[0] });
    let session = casual;
    for (let i = 0; i < total; i++) session = serveDish(session, i)!;
    expect(dishProgress(session)).toEqual({ served: total, total, next: null });
    expect(serveDish(session, total)).toBeNull();
  });
  it('1品戻せる。まだ出していなければ戻せない', () => {
    expect(unserveDish(casual)).toBeNull();
    expect(unserveDish(serveDish(casual, 1)!)).toEqual(casual);
  });
  it('コースが未選択・通常の卓は料理を進めない', () => {
    const noMenu = newSession('s', '12', 0, 4, 'drinks');
    expect(dishProgress(noMenu)).toBeNull();
    expect(serveDish(noMenu, 1)).toBeNull();
    expect(dishProgress(newSession('s', '12', 0))).toBeNull();
  });
  it('コースを選び直しても出した品数は残し、新しいメニューの品数までに収める', () => {
    const cheese = { ...casual, menu: 'cheese', dishesServed: 7 };
    expect(setMenu(cheese, 'casual')).toMatchObject({ menu: 'casual', dishesServed: 7 });
    expect(setMenu(cheese, 'nijikai')).toMatchObject({ menu: 'nijikai', dishesServed: menuOf('nijikai')!.dishes.length });
    expect(setMenu(cheese, null)).toMatchObject({ menu: null, dishesServed: 0 });
    expect(setMenu(cheese, 'x')).toBeNull();
    expect(setMenu(newSession('s', '12', 0), 'casual')).toBeNull();
  });
  it('料理の進みは状態の進み・戻し・卓の移動で変わらない', () => {
    const served = serveDish(casual, 1)!;
    expect(advance(served, 10 * 60_000).dishesServed).toBe(1);
    expect(moveTable(served, '12', '13', 1)?.dishesServed).toBe(1);
  });
  it('出した時刻を1品ごとに残し、1品戻すとその品の時刻を外す（No.131）', () => {
    const two = serveDish(serveDish(casual, 5 * minute)!, 12 * minute)!;
    expect(two).toMatchObject({ dishesServed: 2, dishServedAt: [5 * minute, 12 * minute] });
    expect(unserveDish(two)).toMatchObject({ dishesServed: 1, dishServedAt: [5 * minute] });
    expect(serveDish(unserveDish(two)!, 15 * minute)?.dishServedAt).toEqual([5 * minute, 15 * minute]);
  });
  it('時刻を残す前の版で出した品は時刻を null にし、品の順はずらさない（No.131）', () => {
    const legacy = { ...casual, dishesServed: 2 };
    expect(serveDish(legacy, 20 * minute)?.dishServedAt).toEqual([null, null, 20 * minute]);
    // 前の版で1品戻されて、品数より多く残っている時刻は落とす
    expect(serveDish({ ...casual, dishesServed: 1, dishServedAt: [5 * minute, 12 * minute] }, 20 * minute)?.dishServedAt).toEqual([5 * minute, 20 * minute]);
  });
  it('コースを選び直すと品数に合わせて時刻も切り詰め、通常・未選択に戻すと消す（No.131）', () => {
    const cheese = { ...casual, menu: 'cheese', dishesServed: 7, dishServedAt: [1, 2, 3, 4, 5, 6, 7] };
    expect(setMenu(cheese, 'nijikai')?.dishServedAt).toEqual([1, 2, 3, 4, 5].slice(0, menuOf('nijikai')!.dishes.length));
    expect(setMenu(cheese, null)?.dishServedAt).toEqual([]);
    expect(setCourse(cheese, null)?.dishServedAt).toEqual([]);
  });
});
describe('コース', () => {
  // 19:00 に案内、全員が揃って 19:20 にファーストドリンク
  const waiting = newSession('c', '12', 0, 6, 'drinks');
  const started = advance(waiting, 20 * minute);
  it('案内時にコースを入れられ、入れなければ通常', () => {
    expect(waiting.course).toBe('drinks');
    expect(newSession('s', '12', 0).course).toBeNull();
    expect(DEFAULT_DRINK_PLANS.map(plan => plan.id).every(isCourse)).toBe(true);
    for (const bad of ['', 'Drinks', 'a-b', 'x'.repeat(25), null, undefined, 1]) expect(isCourse(bad)).toBe(false);
  });
  it('区分の名前は店の一覧から引き、消した区分は「消した区分」と出す（No.90）', () => {
    expect(drinkPlanName(DEFAULT_DRINK_PLANS, 'premium_drinks')).toBe('プレミアム飲み放題');
    expect(drinkPlanName([{ id: 'plan_a', name: '2時間飲み放題' }], 'plan_a')).toBe('2時間飲み放題');
    expect(drinkPlanName([], 'drinks')).toBe('消した区分');
  });
  it('表示は開始待ち → ファーストドリンク提供済み → 以降は通常と同じ', () => {
    expect(['seated', 'otoshi', 'lo_done', 'exited'].map(s => displayOf(s as typeof seated.status, 'no_drinks')))
      .toEqual(['course_wait', 'first_drink', 'lo_done', 'exited']);
    expect(['seated', 'otoshi', 'lo_done', 'exited'].map(s => displayOf(s as typeof seated.status, null)))
      .toEqual(['seated', 'otoshi', 'lo_done', 'exited']);
  });
  it('開始待ちの間はタイマーを進めず、ファーストドリンクから数える', () => {
    expect(startOf(waiting)).toBeNull();
    expect(timerOf(waiting, 60 * minute)).toEqual({ label: 'ファーストドリンクから', elapsedMs: null });
    expect(startOf(started)).toBe(20 * minute);
    expect(timerOf(started, 50 * minute)).toEqual({ label: 'ファーストドリンクから', elapsedMs: 30 * minute });
    const exitedCourse = advance(advance(started, 100 * minute), 130 * minute);
    expect(timerOf(exitedCourse, 131 * minute)).toEqual({ label: '退店から', elapsedMs: minute });
  });
  it('開始待ちは何分たっても警告しない（お通し未提供も出さない）', () => {
    expect(alertOf(waiting, 15 * minute)).toEqual({ level: 'none', reason: null });
    expect(alertOf(waiting, 500 * minute)).toEqual({ level: 'none', reason: null });
  });
  it.each([
    [20 * minute + 90 * minute - 1000, 'none', null],
    [20 * minute + 90 * minute, 'soon', 'last_order'],
    [20 * minute + 120 * minute - 1000, 'soon', 'last_order'],
    [20 * minute + 120 * minute, 'now', 'seat_limit'],
  ])('L.O.・お席の時間はファーストドリンクから数える: %i', (time, level, reason) => {
    expect(alertOf(started, time)).toEqual({ level, reason });
  });
  it('L.O. の通知はお通し・ファーストドリンクから数え、数え始めが古い順に並べる', () => {
    const normal = advance(newSession('normal', '11', 10 * minute), 15 * minute);
    expect(lastOrderDue([started, normal, waiting], 15 * minute + 90 * minute).map(s => s.id)).toEqual(['normal']);
    expect(lastOrderDue([started, normal, waiting], 20 * minute + 90 * minute).map(s => s.id)).toEqual(['normal', 'c']);
    expect(lastOrderDue([waiting], 1000 * minute)).toEqual([]);
  });
  it('あとから通常とコースを直せて、状態・時刻・人数は変わらない', () => {
    expect(setCourse(started, null)).toEqual({ ...started, course: null });
    expect(setCourse(otoshi, 'premium_drinks')).toEqual({ ...otoshi, course: 'premium_drinks' });
    expect(setCourse(otoshi, 'X-1')).toBeNull();
  });
  it('通常に戻すと、どのコースか・料理の進みも消す', () => {
    const served = { ...started, menu: 'cheese', dishesServed: 3 };
    expect(setCourse(served, null)).toEqual({ ...started, course: null, menu: null, dishesServed: 0, dishServedAt: [] });
    expect(setCourse(served, 'premium_drinks')).toEqual({ ...served, course: 'premium_drinks' });
  });
  it('コースは状態の進み・戻し・卓の移動で変わらない', () => {
    expect(revert(started)).toEqual(waiting);
    expect(moveTable(started, '12', '13', 1)?.course).toBe('drinks');
    expect(togglePaid(started, 30 * minute).course).toBe('drinks');
  });
});
it('卓には、その卓を含む表示中のお客さんのうち最後に案内したものを出す', () => {
  const minute = 60_000;
  const early = newSession('a', '11', 0);
  const late = newSession('b', '11', 10 * minute);
  const other = newSession('c', '12', 20 * minute);
  expect(occupantOf([late, early, other], '11', 30 * minute)?.id).toBe('b');
  expect(occupantOf([early, other], '13', 30 * minute)).toBeUndefined();
  // 退店から5分を過ぎたお客さんは出さない
  const gone = { ...advance(advance(advance(late, 11 * minute), 12 * minute), 13 * minute) };
  expect(gone.status).toBe('exited');
  expect(occupantOf([early, gone], '11', 13 * minute + 5 * minute)?.id).toBe('a');
});
describe('退店済みの卓への移動・追加（No.133）', () => {
  const minute = 60_000;
  // 12番の団体（先に案内）と、11番で退店したばかりの組（あとに案内）
  const group = newSession('group', '12', 0);
  const left = advance(advance(advance(newSession('left', '11', 10 * minute), 11 * minute), 12 * minute), 13 * minute);
  it('退店済みだけが出ている卓は選べ、まだいるお客さんの卓は選べない', () => {
    expect(isPickable(undefined)).toBe(true);
    expect(isPickable(left)).toBe(true);
    expect(isPickable(group)).toBe(false);
  });
  it('退店済みの卓に足した・移した組を、退店した組より先に出す', () => {
    const added = addTable(group, '11', 14 * minute)!;
    expect(occupantOf([added, left], '11', 15 * minute)?.id).toBe('group');
    const moved = moveTable(group, '12', '11', 14 * minute)!;
    expect(occupantOf([moved, left], '11', 15 * minute)?.id).toBe('group');
    // 誰も来なければ、退店済みのまま5分出す
    expect(occupantOf([group, left], '11', 15 * minute)?.id).toBe('left');
  });
});

describe('通常の卓のタイマー（No.132）', () => {
  it('お通しを出すまでは止め、出した時刻から L.O.・お席の時間を数える', () => {
    expect(startOf(seated)).toBeNull();
    expect(limitsOf(seated)).toBeNull();
    expect(timerOf(seated, seated.seatedAt + 30 * minute)).toEqual({ label: 'お通しから', elapsedMs: null });
    expect(alertOf(seated, seated.seatedAt + 120 * minute).reason).toBe('otoshi_missing');
    expect(startOf(otoshi)).toBe(otoshi.otoshiAt);
    expect(limitsOf(otoshi)).toEqual({ lastOrderAt: otoshi.otoshiAt! + 90 * minute, seatEndAt: otoshi.otoshiAt! + 120 * minute });
  });
  it('お通しの時刻を直すと、数え始めもずれる', () => {
    const later = editTime(otoshi, 'otoshiAt', 40_000, 50_000);
    expect(later && startOf(later)).toBe(40_000);
    expect(later && timerOf(later, 50_000)).toEqual({ label: 'お通しから', elapsedMs: 10_000 });
  });
  it('お通しを出さない店の通常卓は案内から数え、未提供の警告は出さない', () => {
    const noOtoshi = { ...RULES, otoshi: false };
    expect(startOf(seated, noOtoshi)).toBe(seated.seatedAt);
    expect(alertOf(seated, seated.seatedAt + 30 * minute, noOtoshi)).toEqual({ level: 'none', reason: null });
    expect(alertOf(seated, seated.seatedAt + 120 * minute, noOtoshi)).toEqual({ level: 'now', reason: 'seat_limit' });
    expect(timerOf(seated, seated.seatedAt + 30 * minute, noOtoshi)).toEqual({ label: '案内から', elapsedMs: 30 * minute });
    expect(timerOf(otoshi, 50_000, noOtoshi)).toEqual({ label: '案内から', elapsedMs: 40_000 });
  });
});

it('詳細の大きいボタンは、押すと何になるかを「〜にする」で出す（No.123）', () => {
  const seated = newSession('a', '5', 0);
  expect(nextActionLabel(seated, '5')).toBe('お通し提供済みにする');
  const otoshi = advance(seated, 1);
  expect(nextActionLabel(otoshi, '5')).toBe('L.O.確認済みにする');
  const lo = advance(otoshi, 2);
  expect(nextActionLabel(lo, '5')).toBe('退店済みにする');
  const exited = advance(lo, 3);
  expect(nextActionLabel(exited, '5')).toBe('ご案内する');
  expect(nextActionLabel({ ...exited, tableIds: ['11', '12'] }, '12')).toBe('12番にご案内する');
  // コースは開始待ちのあとファーストドリンク
  expect(nextActionLabel(setCourse(seated, 'drinks')!, '5')).toBe('ファーストドリンク提供済みにする');
});
