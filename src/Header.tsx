import type { SyncState } from './store';

export function Header({ time, syncState, showSync }: { time: number; syncState: SyncState; showSync: boolean }) {
  const date = new Date(time);
  return <header>{showSync && syncState !== 'synced' && <span className={`sync-state ${syncState}`} role="status">{syncState === 'pending' ? '送信待ち' : 'オフライン（声かけに戻ってください）'}</span>}<time>{`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`}</time></header>;
}
