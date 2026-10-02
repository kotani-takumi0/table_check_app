import { lastOrderDue, RULES, startOf, type Rules, type Session } from './domain';
import { DEFAULT_SHOP_TIMERS, shopTimerState, type ShopTimer, type ShopTimerDone, type ShopTimerId } from './shopTimers';

// 閉じるまで画面に残す通知。key は「閉じる」をその端末に覚えるのに使う
export type Notice =
  | { key: string; tone: 'warning'; message: string; kind: 'last_order'; session: Session }
  | { key: string; tone: 'danger'; message: string; kind: 'shop_timer'; timerId: ShopTimerId };
// 通知の中のボタン。L.O.確認済みにする・トイレを済にする
export const NOTICE_ACTION: Record<Notice['kind'], string> = { last_order: 'L.O.確認済みにする', shop_timer: '済にする' };
// L.O. の通知（数え始めが古い順）のあとに、トイレの通知を並べる
// 数え始めの時刻（案内・ファーストドリンク）を直したら、閉じた通知も別の通知として出し直す
// 店全体で時間制限を切っているときは L.O. の通知を出さない
const ruleKey = (rules: Rules) => rules.lastOrderMin === RULES.lastOrderMin && rules.seatLimitMin === RULES.seatLimitMin ? '' : `:${rules.lastOrderMin}-${rules.seatLimitMin}`;
// rules は卓ごとに変えられる（コースごとの L.O.。sessionRules を渡す）
export function noticesOf(sessions: Session[], shopTimers: ShopTimerDone, now: number, rules: Rules | ((session: Session) => Rules) = RULES, timers: ShopTimer[] = DEFAULT_SHOP_TIMERS): Notice[] {
  const rulesOf = typeof rules === 'function' ? rules : () => rules;
  const lastOrder = lastOrderDue(sessions, now, rulesOf).map((session): Notice => ({
    // 退店の時刻・店の L.O.／お席の時間（No.14）を直したときも出し直す（どちらもふつうの卓は以前と同じ key）
    key: `lo:${session.id}:${startOf(session)}${session.leaveAt === null ? '' : `:${session.leaveAt}`}${ruleKey(rulesOf(session))}`, tone: 'warning', message: `${session.tableIds.join('・')}卓 ラストオーダーの時間です`, kind: 'last_order', session,
  }));
  const shop = timers.flatMap((timer): Notice[] => {
    const state = shopTimerState(timer.intervalMin, shopTimers[timer.id], now);
    return state.due ? [{ key: `${timer.id}:${state.dueAt}`, tone: 'danger', message: `${timer.label}の時間です`, kind: 'shop_timer', timerId: timer.id }] : [];
  });
  return [...lastOrder, ...shop];
}
