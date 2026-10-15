import { expect, it } from 'vitest';
import { advance, editTime, newSession } from './domain';
import { bellSeatId, noticesOf } from './notices';

const minute = 60_000;
it('L.O. の時間が来た卓と、時間になったトイレを通知する', () => {
  const otoshi = advance(newSession('a', '11', 0), minute);
  const notices = noticesOf([otoshi], { toilet_check: 100 * minute, toilet_clean: 0 }, 120 * minute);
  expect(notices.map(n => [n.kind, n.message])).toEqual([
    ['last_order', '11卓 ラストオーダーの時間です'],
    ['shop_timer', 'トイレ清掃の時間です'],
  ]);
});
it('数え始めを直すと、L.O. の通知は別の key になる（閉じても出し直す）', () => {
  const otoshi = advance(newSession('a', '11', 0), 10 * minute);
  const before = noticesOf([otoshi], { toilet_check: 0, toilet_clean: 0 }, 100 * minute)[0];
  const retimed = editTime(otoshi, 'otoshiAt', 5 * minute, 100 * minute);
  expect(retimed).not.toBeNull();
  const after = noticesOf([retimed!], { toilet_check: 0, toilet_clean: 0 }, 100 * minute)[0];
  expect(before.key).not.toBe(after.key);
});
it('ベルは、いま開く通知の卓へ動かす。卓が無ければ並びの先頭の卓、卓の通知が無ければ動かさない', () => {
  const first = advance(newSession('a', '21', 0), minute);
  const second = advance(newSession('b', '7', minute), 2 * minute);
  const notices = noticesOf([second, first], { toilet_check: 0, toilet_clean: 100 * minute }, 120 * minute);
  const lo = notices.filter(notice => notice.kind === 'last_order');
  expect(lo.map(notice => notice.kind === 'last_order' && notice.session.tableIds[0])).toEqual(['21', '7']);
  expect(bellSeatId(notices, lo[1].key)).toBe('7');
  expect(bellSeatId(notices, notices.find(notice => notice.kind === 'shop_timer')!.key)).toBe('21');
  expect(bellSeatId(notices, null)).toBe('21');
  const onlyShop = noticesOf([], { toilet_check: 0, toilet_clean: 0 }, 31 * minute);
  expect(bellSeatId(onlyShop, onlyShop[0]?.key ?? null)).toBeNull();
  expect(bellSeatId([], null)).toBeNull();
});
it('トイレの通知の key は次の時刻ごとに変わる（済にしたら次の周期で出し直す）', () => {
  const first = noticesOf([], { toilet_check: 0 }, 31 * minute).find(n => n.kind === 'shop_timer' && n.timerId === 'toilet_check');
  const second = noticesOf([], { toilet_check: 31 * minute }, 62 * minute).find(n => n.kind === 'shop_timer' && n.timerId === 'toilet_check');
  expect(first?.key).toBe('toilet_check:1800000');
  expect(second?.key).toBe(`toilet_check:${61 * minute}`);
});
