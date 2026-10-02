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
  menuOpen: boolean;    // メニューを開いているか
  onToggleMenu(): void;
  timeLimitOff: boolean;   // 店全体で時間制限を切っている（目印を出し、押すと設定を開く）
  onOpenSettings(): void;
  inert?: boolean;
  trial?: boolean;      // Firebase につながず端末の中だけで動いている（開発中の試し）
}
// 「消す卓はありません」を出しておく長さ
const NOTHING_TO_CLEAR_MS = 2500;
// フロアの上に浮かぶツールバー（ガラス）：左に「メニュー」とトイレのタイマー（時間制限なしの目印）、右に（同期状態）バージョン・サボテンの時計の印・時刻・全卓消去
export function Header({ time, syncState, showSync, shopTimers, onShopTimerOpen, canClearAll, onClearAll, menuOpen, onToggleMenu, timeLimitOff, onOpenSettings, inert, trial }: Props) {
  // 卓が0のときにゴミ箱を押したら「消す卓はありません」を少しだけ出す
  const [nothingToClear, setNothingToClear] = useState(false);
  useEffect(() => {
    if (!nothingToClear) return;
    const timer = setTimeout(() => setNothingToClear(false), NOTHING_TO_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [nothingToClear]);
  return <header className="toolbar" inert={inert}>
    <div className="toolbar-group glass list-toggle-group">
      <button className="list-toggle" aria-label="メニュー" title="メニュー" aria-expanded={menuOpen} aria-controls="side-menu" onClick={onToggleMenu}>
        <svg className="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M4.5 7h15M4.5 12h15M4.5 17h15" /></svg>
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
      {/* 切ったまま忘れないよう、時間制限なしの間はツールバーに出しておく */}
      {timeLimitOff && <button className="limit-off" aria-label="時間制限なし（押すと設定）" onClick={onOpenSettings}>時間制限なし</button>}
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
