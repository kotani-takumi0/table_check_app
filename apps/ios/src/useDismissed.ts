import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 閉じた通知のキーをこの端末だけに覚えておく（Web の useDismissed と同じキー・上限）
const KEY = 'table-check:dismissed';
const LIMIT = 200;
export function useDismissed(): { isDismissed(key: string): boolean; dismiss(key: string): void } {
  const [keys, setKeys] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then(raw => {
      const value: unknown = JSON.parse(raw ?? '[]');
      // 読み込む前に閉じたものも残す
      if (Array.isArray(value)) setKeys(current => [...new Set([...value.filter((v): v is string => typeof v === 'string'), ...current])].slice(-LIMIT));
    }).catch(() => { /* この端末で覚えられないだけ */ });
  }, []);
  const dismiss = useCallback((key: string) => {
    setKeys(current => {
      const next = [...current.filter(k => k !== key), key].slice(-LIMIT);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => { /* この端末で覚えられないだけ */ });
      return next;
    });
  }, []);
  const isDismissed = useCallback((key: string) => keys.includes(key), [keys]);
  return { isDismissed, dismiss };
}
