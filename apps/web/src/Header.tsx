import { formatClock } from '@table-check/core/domain';
import { APP_VERSION } from './version';
import { shopTimerState, type ShopTimer, type ShopTimerDone, type ShopTimerId } from '@table-check/core/shopTimers';
import type { SyncState } from '@table-check/core/store';
import { useEffect, useState } from 'react';
import { ShopTimerGlyph } from './ShopTimerGlyph';

interface Props {
  time: number;
  syncState: SyncState;
  showSync: boolean;
  timers: ShopTimer[];        // 店のタイマー（No.91。店の設定）
  shopTimers: ShopTimerDone;
  onShopTimerOpen(id: ShopTimerId): void;   // 詳細を開く（押しただけでは済にしない）
  canClearAll: boolean;
  onClearAll(): void;   // 確認ダイアログを開く（押しただけでは消さない）
  menuOpen: boolean;    // メニューを開いているか
  onToggleMenu(): void;
  timeLimitOff: boolean;   // 店全体で時間制限を切っている（目印を出し、押すと設定を開く）
  onOpenSettings(): void;
  updateReady?: boolean;   // サーバーに新しい版がある（押すと読み込み直す。手が空けば自動でも読み込み直す）
  onUpdate?(): void;
  inert?: boolean;
  trial?: boolean;      // Firebase につながず端末の中だけで動いている（開発中の試し）
  noticeCount: number;   // 済にしていない通知の数（No.109）
  noticesOpen: boolean;  // 通知のポップアップを出している間は「通知」を隠す
  onOpenNotices(): void;
}
// 「消す卓はありません」を出しておく長さ
const NOTHING_TO_CLEAR_MS = 2500;
// 画面の上の白いヘッダー（No.107）：左に「メニュー」・名前とトイレのタイマー（時間制限なしの目印）、右に同期状態・バージョン・時刻・全卓消去
export function Header({ time, syncState, showSync, timers, shopTimers, onShopTimerOpen, canClearAll, onClearAll, menuOpen, onToggleMenu, timeLimitOff, onOpenSettings, updateReady, onUpdate, inert, trial, noticeCount, noticesOpen, onOpenNotices }: Props) {
  // 卓が0のときにゴミ箱を押したら「消す卓はありません」を少しだけ出す
  const [nothingToClear, setNothingToClear] = useState(false);
  useEffect(() => {
    if (!nothingToClear) return;
    const timer = setTimeout(() => setNothingToClear(false), NOTHING_TO_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [nothingToClear]);
  return <header className="toolbar" inert={inert}>
    <button className="list-toggle" aria-label="メニュー" title="メニュー" aria-expanded={menuOpen} aria-controls="side-menu" onClick={onToggleMenu}>
      <svg className="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M4.5 7h15M4.5 12h15M4.5 17h15" /></svg>
    </button>
    {/* アプリの名前と印（アイコンのウチワサボテンを4つのマスにしたもの）。スマホでは隠す */}
    <span className="brand" aria-hidden="true"><span className="brand-mark"><i /><i /><i /><i /></span>Minopal</span>
    <span className="toolbar-rule" aria-hidden="true" />
    <div className="shop-timers">
      {/* タイマーが多くて入らないときは、チップの並びだけを横にスクロールする（時間制限なしの目印は外に置いて隠さない） */}
      <div className="shop-timer-list">
      {timers.map(timer => {
        // 画面の時刻は1秒ごとなので、済にした直後に周期を超えて見えないよう上限をかける
        const state = shopTimerState(timer.intervalMin, shopTimers[timer.id], time);
        const minutes = Math.min(timer.intervalMin, Math.ceil(state.remainingMs / 60_000));
        const rest = state.due ? '時間です' : `あと${minutes}分`;
        // 名前（スマホでは隠す）は幅が足りなければ省略し、残り時間の数字は切らない。スマホは「あと」も省く
        return <button key={timer.id} className={`shop-timer ${state.due ? 'due' : ''}`} aria-label={`${timer.label} ${rest}（押すと詳細）`} title={timer.label} onClick={() => onShopTimerOpen(timer.id)}>
          <ShopTimerGlyph icon={timer.icon} />
          <span className="shop-timer-name" aria-hidden="true">{timer.label}</span>
          <span className="shop-timer-rest" aria-hidden="true">{state.due ? rest : <><span className="shop-timer-ato">あと</span>{minutes}分</>}</span>
        </button>;
      })}
      </div>
      {/* 切ったまま忘れないよう、時間制限なしの間はツールバーに出しておく */}
      {timeLimitOff && <button className="limit-off" aria-label="時間制限なし（押すと設定）" onClick={onOpenSettings}><span className="limit-off-long">時間</span>制限なし</button>}
    </div>
    <div className="toolbar-right">
      {/* No.109：しまった通知。押すとポップアップを開き直す。済にして0件になれば消える */}
      {noticeCount > 0 && !noticesOpen && <button className="notice-bell" aria-label={`通知 ${noticeCount}件（押すと開く）`} onClick={onOpenNotices}>
        <svg className="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0" /></svg>
        <span className="notice-bell-label" aria-hidden="true">通知</span><span className="notice-count" aria-hidden="true">{noticeCount}</span>
      </button>}
      {showSync && (syncState === 'synced'
        ? <span className="sync-state synced" role="status"><svg className="sync-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>同期済み</span>
        : <span className={`sync-state ${syncState}`} role="status">{syncState === 'pending' ? '送信待ち' : 'オフライン（声かけに戻ってください）'}</span>)}
      {updateReady && <button className="app-update" aria-label="新しい版があります（押すと読み込み直します）" onClick={onUpdate}>新しい版<span className="app-update-long">に更新</span></button>}
      <span className="app-version" title={trial ? 'Firebase につながず、この端末の中だけで動いています（同期しません）' : 'このアプリのバージョン'}>{APP_VERSION}{trial && '・試し'}</span>
      <time>{formatClock(time)}</time>
      {/* よく押すトイレのボタンから離して右端に置く */}
      {/* 卓が0でも押せるようにし、押したら理由をそばに出す（薄くして押せなくすると壊れているように見えるため） */}
      <button className="clear-all" aria-label={canClearAll ? '全卓を消去（確認が出ます）' : '全卓を消去（消す卓はありません）'} title="全卓を消去"
        onClick={() => { if (canClearAll) onClearAll(); else setNothingToClear(true); }}>
        <svg className="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5" /></svg>
      </button>
    </div>
    <p className={`toolbar-hint ${nothingToClear ? 'shown' : ''}`} role="status">{nothingToClear ? '消す卓はありません' : ''}</p>
  </header>;
}
