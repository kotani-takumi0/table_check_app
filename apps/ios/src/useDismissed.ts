import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 閉じた通知のキーをこの端末だけに覚えておく（Web の useDismissed と同じキー・上限）
const KEY = 'table-check:dismissed';
const LIMIT = 200;
// shop：ログインした店のアカウント（今の店は null。No.88）。今の店は今までと同じキー、ログインした店はアカウントごとのキー。
// 店を変えるときは画面ごと作り直す
export function useDismissed(shop: string | null): { isDismissed(key: string): boolean; dismiss(key: string): void } {
  const storageKey = shop === null ? KEY : `${KEY}:${shop}`;
  const [keys, setKeys] = useState<string[]>([]);
  // 読み込み終わるまでは保存しない（保存してある記録を、読む前に閉じた分だけで上書きしないため）
  const loaded = useRef(false);
  const save = (next: string[]) => { AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => { /* この端末で覚えられないだけ */ }); };
  useEffect(() => {
    const finish = (stored: string[]) => {
      loaded.current = true;
      setKeys(current => {
        // 読み込む前に閉じたものも残し、まとめて保存し直す
        const merged = [...new Set([...stored, ...current])].slice(-LIMIT);
        if (current.length > 0) save(merged);
        return merged;
      });
    };
    AsyncStorage.getItem(storageKey).then(raw => {
      const value: unknown = JSON.parse(raw ?? '[]');
      finish(Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
    }).catch(() => finish([]));
    // 店を変えるときは画面ごと作り直すので、最初の1回だけ読む
  }, []);
  const dismiss = useCallback((key: string) => {
    setKeys(current => {
      const next = [...current.filter(k => k !== key), key].slice(-LIMIT);
      if (loaded.current) save(next);
      return next;
    });
  }, [storageKey]);
  const isDismissed = useCallback((key: string) => keys.includes(key), [keys]);
  return { isDismissed, dismiss };
}
