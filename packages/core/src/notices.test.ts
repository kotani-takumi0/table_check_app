import { expect, it } from 'vitest';
import { advance, editTime, newSession } from './domain';
import { noticesOf } from './notices';

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
  const retimed = editTime(otoshi, 'seatedAt', 5 * minute, 100 * minute);
  expect(retimed).not.toBeNull();
  const after = noticesOf([retimed!], { toilet_check: 0, toilet_clean: 0 }, 100 * minute)[0];
  expect(before.key).not.toBe(after.key);
});
it('トイレの通知の key は次の時刻ごとに変わる（済にしたら次の周期で出し直す）', () => {
  const first = noticesOf([], { toilet_check: 0 }, 31 * minute).find(n => n.kind === 'shop_timer' && n.timerId === 'toilet_check');
  const second = noticesOf([], { toilet_check: 31 * minute }, 62 * minute).find(n => n.kind === 'shop_timer' && n.timerId === 'toilet_check');
  expect(first?.key).toBe('toilet_check:1800000');
  expect(second?.key).toBe(`toilet_check:${61 * minute}`);
});
