import type { SyncState } from './store';

// 新しい版の読み込み（No.83）。ホーム画面に追加した Web アプリは、切り替えて戻っても読み込み直さないので、
// 開きっぱなしの端末はサーバーに新しい版を出しても古い版のまま動き続ける。サーバーの version.json を時々確かめ、
// 新しい版があれば、操作の邪魔にならないときに読み込み直す

// サーバーの版を確かめる間隔
export const UPDATE_CHECK_INTERVAL_MS = 5 * 60_000;
// 最後にさわってからこれだけたてば、操作の途中ではないとみなす
export const IDLE_BEFORE_RELOAD_MS = 60_000;

// version.json（{"version":"2.2.2"}）から画面の表示と同じ形（v2.2.2）を取り出す。形が違えば null
export function versionFromFile(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const version = (json as { version?: unknown }).version;
  return typeof version === 'string' && version !== '' ? `v${version}` : null;
}

// サーバーの版が今動いている版と違えば読み込み直す（戻したときも、サーバーに合わせる）
export function isOtherVersion(latest: string | null, current: string): boolean {
  return latest !== null && latest !== current;
}

export interface ReloadState {
  busy: boolean;          // 詳細・ダイアログ・メニュー・席の配置を開いている
  syncState: SyncState;   // 送信待ち・オフラインの間は読み込み直さない（書き込みを待たせたままにしない）
  lastTouchAt: number;    // 最後にさわった時刻（端末の時計）
  now: number;
}

// 操作の邪魔にならないか。画面に戻ってきた直後は idle を見ない（まださわっていないので）
export function canReload({ busy, syncState, lastTouchAt, now }: ReloadState, ignoreIdle = false): boolean {
  if (busy || syncState !== 'synced') return false;
  return ignoreIdle || now - lastTouchAt >= IDLE_BEFORE_RELOAD_MS;
}
