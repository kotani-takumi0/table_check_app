import { useCallback, useState } from 'react';

// 閉じた通知のキーをこの端末だけに覚えておく
const KEY = 'table-check:dismissed';
const LIMIT = 200;
// 店ごとに分ける（No.88）。今の店は今までと同じキー、ログインした店はアカウントごとのキー
const keyOf = (shop: string | null) => shop === null ? KEY : `${KEY}:${shop}`;
function read(key: string): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch { return []; }
}
// shop：ログインした店のアカウント（今の店は null）。店を変えるときは App ごと作り直す
export function useDismissed(shop: string | null): { isDismissed(key: string): boolean; dismiss(key: string): void } {
  const storageKey = keyOf(shop);
  const [keys, setKeys] = useState(() => read(storageKey));
  const dismiss = useCallback((key: string) => {
    setKeys(current => {
      const next = [...current.filter(k => k !== key), key].slice(-LIMIT);
      try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* この端末で覚えられないだけ */ }
      return next;
    });
  }, [storageKey]);
  const isDismissed = useCallback((key: string) => keys.includes(key), [keys]);
  return { isDismissed, dismiss };
}
