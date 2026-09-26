import { formatClock } from './domain';
import { APP_VERSION } from './version';
import { SHOP_TIMERS, shopTimerState, type ShopTimerDone, type ShopTimerId } from './shopTimers';
import type { SyncState } from './store';

interface Props {
  time: number;
  syncState: SyncState;
  showSync: boolean;
  shopTimers: ShopTimerDone;
  onShopTimerDone(id: ShopTimerId): void;
  canClearAll: boolean;
  onClearAll(): void;   // 確認ダイアログを開く（押しただけでは消さない）
  inert?: boolean;
}
export function Header({ time, syncState, showSync, shopTimers, onShopTimerDone, canClearAll, onClearAll, inert }: Props) {
  return <header inert={inert}>
    <div className="shop-timers">
      {SHOP_TIMERS.map(timer => {
        // 画面の時刻は1秒ごとなので、済にした直後に周期を超えて見えないよう上限をかける
        const state = shopTimerState(timer.intervalMin, shopTimers[timer.id], time);
        const rest = state.due ? '時間です' : `あと${Math.min(timer.intervalMin, Math.ceil(state.remainingMs / 60_000))}分`;
        return <button key={timer.id} className={`shop-timer ${state.due ? 'due' : ''}`} aria-label={`${timer.label} ${rest}（押すと済にする）`} title={timer.label} onClick={() => onShopTimerDone(timer.id)}>
          <span className="shop-timer-icon" aria-hidden="true">{timer.icon}</span> <span className="shop-timer-rest">{rest}</span>
        </button>;
      })}
    </div>
    {showSync && syncState !== 'synced' && <span className={`sync-state ${syncState}`} role="status">{syncState === 'pending' ? '送信待ち' : 'オフライン（声かけに戻ってください）'}</span>}
    <span className="app-version" title="このアプリのバージョン">{APP_VERSION}</span>
    <time>{formatClock(time)}</time>
    {/* よく押すトイレのボタンから離して右端に置く（アイコンは仮。あとで差し替える） */}
    <button className="clear-all" aria-label="全卓を消去（確認が出ます）" title="全卓を消去" disabled={!canClearAll} onClick={onClearAll}><span aria-hidden="true">🗑️</span></button>
  </header>;
}
