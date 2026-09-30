import { useCallback, useState } from 'react';

// 閉じた通知のキーをこの端末だけに覚えておく
const KEY = 'table-check:dismissed';
const LIMIT = 200;
function read(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch { return []; }
}
export function useDismissed(): { isDismissed(key: string): boolean; dismiss(key: string): void } {
  const [keys, setKeys] = useState(read);
  const dismiss = useCallback((key: string) => {
    setKeys(current => {
      const next = [...current.filter(k => k !== key), key].slice(-LIMIT);
      try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* この端末で覚えられないだけ */ }
      return next;
    });
  }, []);
  const isDismissed = useCallback((key: string) => keys.includes(key), [keys]);
  return { isDismissed, dismiss };
}
