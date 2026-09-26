import { formatClock } from './domain';
import type { SyncState } from './store';

export function Header({ time, syncState, showSync, inert }: { time: number; syncState: SyncState; showSync: boolean; inert?: boolean }) {
  return <header inert={inert}>{showSync && syncState !== 'synced' && <span className={`sync-state ${syncState}`} role="status">{syncState === 'pending' ? '送信待ち' : 'オフライン（声かけに戻ってください）'}</span>}<time>{formatClock(time)}</time></header>;
}
