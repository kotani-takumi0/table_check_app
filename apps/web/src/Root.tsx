import { useCallback, useEffect, useRef, useState } from 'react';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { currentAccount, LOGIN_MODE_KEY, loginErrorMessage, parseLoginMode, signInAsGuest, signInWithEmail, signOutAccount, type LoginMode } from '@table-check/core/auth';
import { firestoreStores, type ShopStores } from '@table-check/core/firestoreServices';
import { newDeviceId } from '@table-check/core/firestoreEditing';
import { startServerClock, type KeyValueStorage } from '@table-check/core/serverClock';
import { accountBase, GUEST_BASE } from '@table-check/core/shopPath';
import App from './App';
import { LoginScreen } from './LoginScreen';

// localStorage は使えない環境だと触っただけで例外になるので、読み書きのたびに取りに行く（例外は startServerClock が受け止める）
const browserStorage: KeyValueStorage = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
function readMode(): LoginMode | null {
  try { return parseLoginMode(window.localStorage.getItem(LOGIN_MODE_KEY)); } catch { return null; }
}
function writeMode(mode: LoginMode | null): void {
  try { if (mode) window.localStorage.setItem(LOGIN_MODE_KEY, mode); else window.localStorage.removeItem(LOGIN_MODE_KEY); } catch { /* 覚えられなくても、このページでは使える */ }
}
type Phase = { kind: 'loading' } | { kind: 'choose' } | { kind: 'ready'; stores: ShopStores; userReady: Promise<User> | null; account: User | null; trial: boolean };

// どの店のデータを使うかを決めてから App を出す（No.88）。最初は「ログイン」か「ログインせずに使う」を選び、端末で覚える。
// guestStores：ログインせずに使うときに、Firebase につながず端末の中だけで動かす保存先（開発中に店のデータを変えないため）
export function Root({ db, auth, guestStores }: { db: Firestore; auth: Auth; guestStores: (() => ShopStores) | null }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const startGuest = useCallback(() => {
    writeMode('guest');
    setError('');
    if (guestStores) { setPhase({ kind: 'ready', stores: guestStores(), userReady: null, account: null, trial: true }); return; }
    const userReady = signInAsGuest(auth);
    setPhase({ kind: 'ready', stores: firestoreStores(db, userReady, GUEST_BASE, newDeviceId()), userReady, account: null, trial: false });
  }, [auth, db, guestStores]);
  const startAccount = useCallback((user: User) => {
    writeMode('account');
    setError('');
    const userReady = Promise.resolve(user);
    setPhase({ kind: 'ready', stores: firestoreStores(db, userReady, accountBase(user.uid), newDeviceId()), userReady, account: user, trial: false });
  }, [db]);
  // 開いたとき：覚えている使い方で始める。ログインした店は、ログインが残っていればそのまま入る
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const mode = readMode();
    if (mode === 'guest') startGuest();
    else if (mode === 'account') void currentAccount(auth).then(user => user ? startAccount(user) : setPhase({ kind: 'choose' }), () => setPhase({ kind: 'choose' }));
    else setPhase({ kind: 'choose' });
  }, [auth, startGuest, startAccount]);
  // サーバーの時刻とのずれを測る（端末の時計がずれていても、全端末で同じ経過を出す）
  const userReady = phase.kind === 'ready' ? phase.userReady : null;
  useEffect(() => {
    if (!userReady) return;
    let stop: (() => void) | undefined;
    let disposed = false;
    void userReady.then(user => { if (!disposed) stop = startServerClock(db, user.uid, browserStorage); }, () => { /* The store reports authentication errors. */ });
    return () => { disposed = true; stop?.(); };
  }, [db, userReady]);
  const login = (email: string, password: string) => {
    setBusy(true);
    setError('');
    signInWithEmail(auth, email, password).then(startAccount, (reason: unknown) => setError(loginErrorMessage(reason))).finally(() => setBusy(false));
  };
  // ログアウト・ログインし直す：覚えた使い方を消して、最初の画面に戻る
  const leave = useCallback(() => {
    const account = phase.kind === 'ready' ? phase.account : null;
    writeMode(null);
    setPhase({ kind: 'choose' });
    if (account) void signOutAccount(auth).catch(reason => console.error(reason));
  }, [auth, phase]);
  if (phase.kind === 'loading') return <main className="login" aria-busy="true" />;
  if (phase.kind === 'choose') return <LoginScreen busy={busy} error={error} onLogin={login} onGuest={startGuest} />;
  return <App key={phase.account?.uid ?? 'guest'} {...phase.stores} trial={phase.trial} account={phase.account?.email ?? null} onLeave={leave} />;
}
