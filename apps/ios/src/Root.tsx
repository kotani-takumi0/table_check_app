import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from 'firebase/auth';
import { currentAccount, flushPendingWrites, loginErrorMessage, PENDING_WRITES_MESSAGE, signInAsGuest, signInWithEmail, signOutAccount, signUpErrorMessage, signUpWithEmail } from '@table-check/core/auth';
import { firestoreStores, type ShopStores } from '@table-check/core/firestoreServices';
import { newDeviceId } from '@table-check/core/firestoreEditing';
import { startServerClock } from '@table-check/core/serverClock';
import { accountBase, GUEST_BASE } from '@table-check/core/shopPath';
import { firebase, memoryStores, readMode, writeMode, type Services } from './services';
import { LoginScreen } from './LoginScreen';
import { FirstPage } from './FirstPage';
import { BLANK_SETTINGS } from '@table-check/core/shopTemplates';
import { version } from '../../../package.json';

// 記録に写す端末の種類と版（No.113）
const APP_INFO = { platform: 'ios', version } as const;

// first：ログインした店で席の配置をまだ保存していないので、最初のページ（テンプレートを選ぶ。No.087）を出す
type Phase = { kind: 'loading' } | { kind: 'choose' } | { kind: 'first'; stores: ShopStores; account: User }
  | { kind: 'ready'; stores: ShopStores; userReady: Promise<User> | null; account: User | null; trial: boolean };

// どの店のデータを使うかを決めてから画面を出す（Web の Root と同じ。No.88）。最初は「ログイン」か「ログインせずに使う」を選び、端末で覚える
export function Root({ children }: { children(services: Services): ReactNode }) {
  const [phase, setPhase] = useState<Phase>(firebase ? { kind: 'loading' } : { kind: 'ready', stores: memoryStores(), userReady: null, account: null, trial: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 送信待ちが残っていて店を切り替えられなかったときの知らせ（メニューに出す）
  const [leaveError, setLeaveError] = useState('');
  const startGuest = useCallback(() => {
    if (!firebase) return;
    writeMode('guest');
    setError('');
    if (firebase.guestOnDevice) { setPhase({ kind: 'ready', stores: memoryStores(), userReady: null, account: null, trial: true }); return; }
    const userReady = signInAsGuest(firebase.auth);
    setPhase({ kind: 'ready', stores: firestoreStores(firebase.db, userReady, GUEST_BASE, newDeviceId(), APP_INFO), userReady, account: null, trial: false });
  }, []);
  // ログインした店：席の配置をまだ保存していなければ最初のページを出す。確かめられない（オフラインなど）ときはそのまま使う
  const startAccount = useCallback((user: User) => {
    if (!firebase) return;
    writeMode('account');
    setError('');
    const userReady = Promise.resolve(user);
    const stores = firestoreStores(firebase.db, userReady, accountBase(user.uid), newDeviceId(), APP_INFO);
    setPhase({ kind: 'loading' });
    void (stores.shopLayoutStore.isSaved?.() ?? Promise.resolve(null)).then(saved => {
      setPhase(saved === false ? { kind: 'first', stores, account: user } : { kind: 'ready', stores, userReady, account: user, trial: false });
    });
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
    const { auth, db } = firebase;
    // 今の店で書いた送信待ちも、ログインで利用者が変わる前に送り終える
    flushPendingWrites(db).then(flushed => {
      if (!flushed) { setError(PENDING_WRITES_MESSAGE); return; }
      return signInWithEmail(auth, email, password).then(startAccount, (reason: unknown) => setError(loginErrorMessage(reason)));
    }).finally(() => setBusy(false));
  };
  // 新規登録（No.094）：アカウントを作ってそのままログインし、最初のページに進む
  const signUp = (email: string, password: string) => {
    if (!firebase) return;
    setBusy(true);
    setError('');
    const { auth, db } = firebase;
    flushPendingWrites(db).then(flushed => {
      if (!flushed) { setError(PENDING_WRITES_MESSAGE); return; }
      return signUpWithEmail(auth, email, password).then(startAccount, (reason: unknown) => setError(signUpErrorMessage(reason)));
    }).finally(() => setBusy(false));
  };
  // ログアウト・ログインし直す：送信待ちを送り終えてから、覚えた使い方を消して最初の画面に戻る
  const leave = useCallback(() => {
    if ((phase.kind !== 'ready' && phase.kind !== 'first') || !firebase) return;
    const { account } = phase, trial = phase.kind === 'ready' && phase.trial;
    const { auth, db } = firebase;
    setLeaveError('');
    void (trial ? Promise.resolve(true) : flushPendingWrites(db)).then(flushed => {
      if (!flushed) { setLeaveError(PENDING_WRITES_MESSAGE); return; }
      writeMode(null);
      setPhase({ kind: 'choose' });
      if (account) void signOutAccount(auth).catch(reason => console.error(reason));
    });
  }, [phase]);
  if (phase.kind === 'loading') return null;
  if (phase.kind === 'choose') return <LoginScreen busy={busy} error={error} onLogin={login} onSignUp={signUp} onGuest={startGuest} />;
  if (phase.kind === 'first') {
    const { stores, account: user } = phase;
    const begin = () => setPhase({ kind: 'ready', stores, userReady: Promise.resolve(user), account: user, trial: false });
    // 設定を先に書き、配置を最後に保存する（配置があれば「始めた店」とみなす）
    return <FirstPage account={user.email ?? ''} onLeave={leave}
      onTemplate={async template => { await stores.shopSettingsStore.update(template.settings); await stores.shopLayoutStore.save(template.layout); begin(); }}
      onBlank={async layout => { await stores.shopSettingsStore.update(BLANK_SETTINGS); await stores.shopLayoutStore.save(layout); begin(); }} />;
  }
  return children({ ...phase.stores, trial: phase.trial, account: phase.account?.email ?? null, onLeave: firebase ? leave : undefined, leaveError });
}
