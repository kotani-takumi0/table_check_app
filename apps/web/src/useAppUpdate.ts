import { useCallback, useEffect, useRef, useState } from 'react';
import { canReload, isOtherVersion, UPDATE_CHECK_INTERVAL_MS, versionFromFile } from '@table-check/core/appUpdate';
import type { SyncState } from '@table-check/core/store';
import { APP_VERSION } from './version';

// 読み込み直してよいかを見直す間隔（新しい版を見つけたあと）
const RELOAD_POLL_MS = 10_000;
// 自動で読み込み直した先の版。読み込み直してもまだ違う版のまま（サーバーの出し直しの途中など）なら、自動ではもう読み込み直さない（くり返さないため）
const RELOADED_FOR_KEY = 'table-check:reloadedFor';

function autoReload(latest: string) {
  try {
    if (window.sessionStorage.getItem(RELOADED_FOR_KEY) === latest) return;
    window.sessionStorage.setItem(RELOADED_FOR_KEY, latest);
  } catch { /* 保存できなくても読み込み直す */ }
  window.location.reload();
}

// サーバーの版（ビルドで出す /version.json）を時々確かめ、違えば操作の邪魔にならないときに読み込み直す（No.83）。
// 読み込み直せるまでは updateReady を立て、ツールバーから押して読み込み直せるようにする。開発中（npm run dev）は確かめない
export function useAppUpdate(busy: boolean, syncState: SyncState): { updateReady: boolean; reload(): void } {
  const [updateReady, setUpdateReady] = useState(false);
  const busyRef = useRef(busy);
  const syncRef = useRef(syncState);
  busyRef.current = busy;
  syncRef.current = syncState;
  const lastTouchAt = useRef(Date.now());
  const latestRef = useRef<string | null>(null);
  const reload = useCallback(() => window.location.reload(), []);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let stopped = false;
    // 画面に戻ってきたとき（resumed）は、さわった時刻を見ずに読み込み直す
    const check = async (resumed: boolean) => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok || stopped) return;
        const latest = versionFromFile(await response.json());
        if (stopped || !isOtherVersion(latest, APP_VERSION)) return;
        latestRef.current = latest;
        setUpdateReady(true);
        if (resumed && canReload({ busy: busyRef.current, syncState: syncRef.current, lastTouchAt: lastTouchAt.current, now: Date.now() }, true)) autoReload(latest!);
      } catch { /* オフラインなどで確かめられなければ、次の機会に確かめる */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void check(true); };
    const onTouch = () => { lastTouchAt.current = Date.now(); };
    void check(false);
    const interval = setInterval(() => void check(false), UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('pointerdown', onTouch, true);
    window.addEventListener('keydown', onTouch, true);
    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('pointerdown', onTouch, true);
      window.removeEventListener('keydown', onTouch, true);
    };
  }, []);

  // 新しい版を見つけたら、何も開いておらず、送信済みで、しばらくさわっていないときに読み込み直す
  useEffect(() => {
    if (!updateReady) return;
    const interval = setInterval(() => {
      const latest = latestRef.current;
      if (latest && canReload({ busy: busyRef.current, syncState: syncRef.current, lastTouchAt: lastTouchAt.current, now: Date.now() })) autoReload(latest);
    }, RELOAD_POLL_MS);
    return () => clearInterval(interval);
  }, [updateReady]);

  return { updateReady, reload };
}
