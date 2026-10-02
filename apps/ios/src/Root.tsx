import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from 'firebase/auth';
import { currentAccount, loginErrorMessage, signInAsGuest, signInWithEmail, signOutAccount } from '@table-check/core/auth';
import { firestoreStores, type ShopStores } from '@table-check/core/firestoreServices';
import { newDeviceId } from '@table-check/core/firestoreEditing';
import { startServerClock } from '@table-check/core/serverClock';
import { accountBase, GUEST_BASE } from '@table-check/core/shopPath';
import { firebase, memoryStores, readMode, writeMode, type Services } from './services';
import { LoginScreen } from './LoginScreen';

type Phase = { kind: 'loading' } | { kind: 'choose' } | { kind: 'ready'; stores: ShopStores; userReady: Promise<User> | null; account: User | null; trial: boolean };

// どの店のデータを使うかを決めてから画面を出す（Web の Root と同じ。No.88）。最初は「ログイン」か「ログインせずに使う」を選び、端末で覚える
export function Root({ children }: { children(services: Services): ReactNode }) {
  const [phase, setPhase] = useState<Phase>(firebase ? { kind: 'loading' } : { kind: 'ready', stores: memoryStores(), userReady: null, account: null, trial: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const startGuest = useCallback(() => {
    if (!firebase) return;
    writeMode('guest');
    setError('');
    if (firebase.guestOnDevice) { setPhase({ kind: 'ready', stores: memoryStores(), userReady: null, account: null, trial: true }); return; }
    const userReady = signInAsGuest(firebase.auth);
    setPhase({ kind: 'ready', stores: firestoreStores(firebase.db, userReady, GUEST_BASE, newDeviceId()), userReady, account: null, trial: false });
  }, []);
  const startAccount = useCallback((user: User) => {
    if (!firebase) return;
    writeMode('account');
    setError('');
    const userReady = Promise.resolve(user);
    setPhase({ kind: 'ready', stores: firestoreStores(firebase.db, userReady, accountBase(user.uid), newDeviceId()), userReady, account: user, trial: false });
  }, []);
  // 開いたとき：覚えている使い方で始める。ログインした店は、ログインが残っていればそのまま入る
  const started = useRef(false);
  useEffect(() => {
    if (!firebase || started.current) return;
    started.current = true;
    const { auth } = firebase;
    void readMode().then(mode => {
      if (mode === 'guest') startGuest();
      else if (mode === 'account') void currentAccount(auth).then(user => user ? startAccount(user) : setPhase({ kind: 'choose' }), () => setPhase({ kind: 'choose' }));
      else setPhase({ kind: 'choose' });
    });
  }, [startGuest, startAccount]);
  // サーバーの時刻とのずれを測る（端末の時計がずれていても、全端末で同じ経過を出す）
  const userReady = phase.kind === 'ready' ? phase.userReady : null;
  useEffect(() => {
    if (!userReady || !firebase) return;
    const { db } = firebase;
    let stop: (() => void) | undefined;
    let disposed = false;
    void userReady.then(user => { if (!disposed) stop = startServerClock(db, user.uid, AsyncStorage); }, () => { /* The store reports authentication errors. */ });
    return () => { disposed = true; stop?.(); };
  }, [userReady]);
  const login = (email: string, password: string) => {
    if (!firebase) return;
    setBusy(true);
    setError('');
    signInWithEmail(firebase.auth, email, password).then(startAccount, (reason: unknown) => setError(loginErrorMessage(reason))).finally(() => setBusy(false));
  };
  // ログアウト・ログインし直す：覚えた使い方を消して、最初の画面に戻る
  const leave = useCallback(() => {
    const account = phase.kind === 'ready' ? phase.account : null;
    writeMode(null);
    setPhase({ kind: 'choose' });
    if (account && firebase) void signOutAccount(firebase.auth).catch(reason => console.error(reason));
  }, [phase]);
  if (phase.kind === 'loading') return null;
  if (phase.kind === 'choose') return <LoginScreen busy={busy} error={error} onLogin={login} onGuest={startGuest} />;
  return children({ ...phase.stores, trial: phase.trial, account: phase.account?.email ?? null, onLeave: firebase ? leave : undefined });
}
