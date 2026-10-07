import { useCallback, useRef } from 'react';

// 次の状態へのボタンの二度押し（No.122）。急いで2回押すと2段進むので、押した直後は次を受け付けない
export const TAP_GUARD_MS = 500;
// last は前に受け付けた時刻（まだ無ければ null）。端末の時計が戻ったときは止めたままにしない
export function tooSoon(last: number | null, at: number, ms: number = TAP_GUARD_MS): boolean {
  return last !== null && at >= last && at - last < ms;
}
// 渡した操作を、前に受け付けてから ms のうちは呼ばない
export function useTapGuard(ms: number = TAP_GUARD_MS): (action: () => void) => void {
  const last = useRef<number | null>(null);
  return useCallback((action: () => void) => {
    const at = Date.now();
    if (tooSoon(last.current, at, ms)) return;
    last.current = at;
    action();
  }, [ms]);
}
