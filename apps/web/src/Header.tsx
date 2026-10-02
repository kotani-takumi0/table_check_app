import { formatClock } from '@table-check/core/domain';
import { APP_VERSION } from './version';
import { SHOP_TIMERS, shopTimerState, type ShopTimerDone, type ShopTimerId } from '@table-check/core/shopTimers';
import type { SyncState } from '@table-check/core/store';
import { useEffect, useState } from 'react';
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
  trial?: boolean;      // Firebase につながず端末の中だけで動いている（開発中の試し）
}
// 「消す卓はありません」を出しておく長さ
const NOTHING_TO_CLEAR_MS = 2500;
// フロアの上に浮かぶツールバー（ガラス）：左に「一覧」とトイレのタイマー、右に（同期状態）バージョン・サボテンの時計の印・時刻・全卓消去
export function Header({ time, syncState, showSync, shopTimers, onShopTimerOpen, canClearAll, onClearAll, listOpen, onToggleList, inert, trial }: Props) {
  // 卓が0のときにゴミ箱を押したら「消す卓はありません」を少しだけ出す
  const [nothingToClear, setNothingToClear] = useState(false);
  useEffect(() => {
    if (!nothingToClear) return;
    const timer = setTimeout(() => setNothingToClear(false), NOTHING_TO_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [nothingToClear]);
  return <header className="toolbar" inert={inert}>
    <div className="toolbar-group glass list-toggle-group">
      <button className="list-toggle" aria-label="全卓一覧" title="全卓一覧" aria-expanded={listOpen} aria-controls="table-list" onClick={onToggleList}>
        <svg className="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="4" /><path d="M9 4v16M5.5 8.5h1M5.5 12h1M5.5 15.5h1" /></svg>
      </button>
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
      <span className="app-version" title={trial ? 'Firebase につながず、この端末の中だけで動いています（同期しません）' : 'このアプリのバージョン'}>{APP_VERSION}{trial && '・試し'}</span>
      <CactusClock time={time} />
      <time>{formatClock(time)}</time>
      {/* よく押すトイレのボタンから離して右端に置く */}
      {/* 卓が0でも押せるようにし、押したら理由をそばに出す（薄くして押せなくすると壊れているように見えるため） */}
      <button className="clear-all" aria-label={canClearAll ? '全卓を消去（確認が出ます）' : '全卓を消去（消す卓はありません）'} title="全卓を消去"
        onClick={() => { if (canClearAll) onClearAll(); else setNothingToClear(true); }}>
        <svg className="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5" /></svg>
      </button>
    </div>
    <p className={`toolbar-hint glass ${nothingToClear ? 'shown' : ''}`} role="status">{nothingToClear ? '消す卓はありません' : ''}</p>
  </header>;
}
