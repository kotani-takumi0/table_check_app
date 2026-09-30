import type { Session } from './domain';

export type SyncState = 'synced' | 'pending' | 'offline';
// 複数の購読のうち、いちばん悪い状態を表示する
export function worstSyncState(states: SyncState[]): SyncState {
  return states.includes('offline') ? 'offline' : states.includes('pending') ? 'pending' : 'synced';
}
export interface SessionStore {
  subscribe(cb: (sessions: Session[]) => void): () => void;
  put(session: Session): Promise<void>;
  remove(id: string): Promise<void>;
  subscribeSync?(cb: (state: SyncState) => void): () => void;
}
