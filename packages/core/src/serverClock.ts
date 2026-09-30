import { doc, getDocFromServer, serverTimestamp, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { setServerOffset } from './clock';

const KEY = 'table-check:offset';
export function estimateOffset(sentAt: number, receivedAt: number, serverAt: number): number {
  return Math.round(serverAt - (sentAt + receivedAt) / 2);
}
export function startServerClock(db: Firestore, uid: string): () => void {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null && saved.trim() !== '' && Number.isFinite(Number(saved))) setServerOffset(Number(saved));
  } catch { /* Storage may be unavailable. */ }
  let stopped = false;
  let measuring = false;
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
      try { localStorage.setItem(KEY, String(offset)); } catch { /* Keep the in-memory offset. */ }
    } catch { /* Retain the last successful offset when offline. */ }
    finally { measuring = false; }
  };
  void measure();
  const interval = setInterval(() => { void measure(); }, 10 * 60_000);
  return () => { stopped = true; clearInterval(interval); };
}
