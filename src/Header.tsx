import { SHOP_TIMERS, shopTimerState, type ShopTimerDone, type ShopTimerId } from './shopTimers';
import type { SyncState } from './store';

interface Props {
  time: number;
  syncState: SyncState;
  showSync: boolean;
  shopTimers: ShopTimerDone;
  onShopTimerDone(id: ShopTimerId): void;
}
export function Header({ time, syncState, showSync, shopTimers, onShopTimerDone }: Props) {
  const date = new Date(time);
  return <header>
    <div className="shop-timers">
      {SHOP_TIMERS.map(timer => {
        // 画面の時刻は1秒ごとなので、済にした直後に周期を超えて見えないよう上限をかける
        const state = shopTimerState(timer.intervalMin, shopTimers[timer.id], time);
        const rest = state.due ? '時間です' : `あと${Math.min(timer.intervalMin, Math.ceil(state.remainingMs / 60_000))}分`;
        return <button key={timer.id} className={`shop-timer ${state.due ? 'due' : ''}`} aria-label={`${timer.label} ${rest}（押すと済にする）`} onClick={() => onShopTimerDone(timer.id)}>
          {timer.label} <span className="shop-timer-rest">{rest}</span>
        </button>;
      })}
    </div>
    {showSync && syncState !== 'synced' && <span className={`sync-state ${syncState}`} role="status">{syncState === 'pending' ? '送信待ち' : 'オフライン（声かけに戻ってください）'}</span>}
    <time>{`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`}</time>
  </header>;
}
