import { doc, getDocFromServer, serverTimestamp, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { setServerOffset } from './clock';

const KEY = 'table-check:offset';
// 時差を端末に覚えておく保存先。ブラウザの localStorage と React Native の AsyncStorage のどちらもこの形を満たす
export interface KeyValueStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
}
export function estimateOffset(sentAt: number, receivedAt: number, serverAt: number): number {
  return Math.round(serverAt - (sentAt + receivedAt) / 2);
}
export function startServerClock(db: Firestore, uid: string, storage: KeyValueStorage): () => void {
  let stopped = false;
  let measuring = false;
  let measured = false;
  // 読み出しが非同期だと測り終えたあとに届くことがあるので、測った時差を古い値で上書きしない
  const applySaved = (saved: string | null) => {
    if (!stopped && !measured && saved !== null && saved.trim() !== '' && Number.isFinite(Number(saved))) setServerOffset(Number(saved));
  };
  try {
    const saved = storage.getItem(KEY);
    if (saved instanceof Promise) saved.then(applySaved, () => { /* Storage may be unavailable. */ });
    else applySaved(saved);
  } catch { /* Storage may be unavailable. */ }
  const measure = async () => {
    if (stopped || measuring) return;
    measuring = true;
    try {
      const ref = doc(db, 'clockProbes', uid);
      const sentAt = Date.now();
      await setDoc(ref, { at: serverTimestamp() });
      // 書き込みの往復だけで時差を測る（読み戻しの往復を含めると、その半分だけずれる）
      const receivedAt = Date.now();
      if (stopped) return;
      const snapshot = await getDocFromServer(ref);
      const at: unknown = snapshot.data()?.at;
      if (stopped || !(at instanceof Timestamp)) return;
      const offset = estimateOffset(sentAt, receivedAt, at.toMillis());
      setServerOffset(offset);
      measured = true;
      try { await storage.setItem(KEY, String(offset)); } catch { /* Keep the in-memory offset. */ }
    } catch { /* Retain the last successful offset when offline. */ }
    finally { measuring = false; }
  };
  void measure();
  const interval = setInterval(() => { void measure(); }, 10 * 60_000);
  return () => { stopped = true; clearInterval(interval); };
}
