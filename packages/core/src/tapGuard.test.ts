import { expect, it } from 'vitest';
import { TAP_GUARD_MS, tooSoon } from './tapGuard';

it('押した直後の 0.5秒は次を受け付けない。それを過ぎれば受け付ける', () => {
  expect(tooSoon(null, 1000)).toBe(false);
  expect(tooSoon(1000, 1000)).toBe(true);
  expect(tooSoon(1000, 1000 + TAP_GUARD_MS - 1)).toBe(true);
  expect(tooSoon(1000, 1000 + TAP_GUARD_MS)).toBe(false);
  // 時計が戻っても押せなくならない
  expect(tooSoon(1000, 900)).toBe(false);
});
