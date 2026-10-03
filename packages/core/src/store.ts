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
  // 案内が start 以上 end 未満のお客さん（履歴の書き出し。No.34）。卓に今出ているかは問わない（退店・置き換えのあとも残る）
  fetchSeatedBetween(start: number, end: number): Promise<Session[]>;
}
