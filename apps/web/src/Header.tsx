import { formatClock } from '@table-check/core/domain';
import { APP_VERSION } from './version';
import { SHOP_TIMERS, shopTimerState, type ShopTimerDone, type ShopTimerId } from '@table-check/core/shopTimers';
import type { SyncState } from '@table-check/core/store';
import { CactusClock } from './CactusClock';

interface Props {
  time: number;
  syncState: SyncState;
  showSync: boolean;
  shopTimers: ShopTimerDone;
  onShopTimerOpen(id: ShopTimerId): void;   // 詳細を開く（押しただけでは済にしない）
  canClearAll: boolean;
  onClearAll(): void;   // 確認ダイアログを開く（押しただけでは消さない）
  listOpen: boolean;    // 全卓一覧を開いているか
  onToggleList(): void;
  inert?: boolean;
}
// フロアの上に浮かぶツールバー（ガラス）：左に「一覧」とトイレのタイマー、右に（同期状態）バージョン・サボテンの時計の印・時刻・全卓消去
export function Header({ time, syncState, showSync, shopTimers, onShopTimerOpen, canClearAll, onClearAll, listOpen, onToggleList, inert }: Props) {
  return <header className="toolbar" inert={inert}>
    <div className="toolbar-group glass list-toggle-group">
      <button className="list-toggle" aria-expanded={listOpen} aria-controls="table-list" onClick={onToggleList}><span aria-hidden="true">≡</span> 一覧</button>
    </div>
    <div className="toolbar-group glass shop-timers">
      {SHOP_TIMERS.map(timer => {
        // 画面の時刻は1秒ごとなので、済にした直後に周期を超えて見えないよう上限をかける
        const state = shopTimerState(timer.intervalMin, shopTimers[timer.id], time);
        const rest = state.due ? '時間です' : `あと${Math.min(timer.intervalMin, Math.ceil(state.remainingMs / 60_000))}分`;
        return <button key={timer.id} className={`shop-timer ${state.due ? 'due' : ''}`} aria-label={`${timer.label} ${rest}（押すと詳細）`} title={timer.label} onClick={() => onShopTimerOpen(timer.id)}>
          <span className="shop-timer-icon" aria-hidden="true">{timer.icon}</span> <span className="shop-timer-rest">{rest}</span>
        </button>;
      })}
    </div>
    <div className="toolbar-group glass toolbar-right">
      {showSync && syncState !== 'synced' && <span className={`sync-state ${syncState}`} role="status">{syncState === 'pending' ? '送信待ち' : 'オフライン（声かけに戻ってください）'}</span>}
      <span className="app-version" title="このアプリのバージョン">{APP_VERSION}</span>
      <CactusClock time={time} />
      <time>{formatClock(time)}</time>
      {/* よく押すトイレのボタンから離して右端に置く */}
      <button className="clear-all" aria-label="全卓を消去（確認が出ます）" title="全卓を消去" disabled={!canClearAll} onClick={onClearAll}>消去</button>
    </div>
  </header>;
}
