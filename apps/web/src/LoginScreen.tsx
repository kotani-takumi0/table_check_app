import { useState, type FormEvent } from 'react';
import { PASSWORD_MIN, signUpProblem } from '@table-check/core/auth';

// 開発中（npm run dev）だけ出す「テスト用でログイン」。値は .env.development.local の VITE_TEST_LOGIN_*（店や本番のビルドには入らない）
const TEST_LOGIN = import.meta.env.DEV && import.meta.env.VITE_TEST_LOGIN_EMAIL && import.meta.env.VITE_TEST_LOGIN_PASSWORD
  ? { email: import.meta.env.VITE_TEST_LOGIN_EMAIL as string, password: import.meta.env.VITE_TEST_LOGIN_PASSWORD as string } : null;

// 最初の画面（No.88）：ログインするか、ログインせずに今の店のデータで使うかを選ぶ。選んだ結果はこの端末で覚える。
// はじめての店はここでアカウントを作る（No.094）。作るとそのままログインし、最初のページ（テンプレートを選ぶ。No.087）に進む
export function LoginScreen({ busy, error, onLogin, onSignUp, onGuest }: { busy: boolean; error: string; onLogin(email: string, password: string): void; onSignUp(email: string, password: string): void; onGuest(): void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // 手元で確かめた直すこと（登録のとき）。送ったあとの理由は error で受け取る
  const [problem, setProblem] = useState('');
  const signup = mode === 'signup';
  const shown = problem || error;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!signup) { onLogin(email, password); return; }
    const found = signUpProblem(email, password, confirm);
    setProblem(found);
    if (!found) onSignUp(email, password);
  };
  const switchMode = () => { setMode(signup ? 'login' : 'signup'); setProblem(''); setConfirm(''); };
  return <main className="login">
    <section className="login-card sheet" aria-labelledby="login-title">
      <div className="login-head">
        <h1 id="login-title" className="login-title"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>Minopal</h1>
        <p className="settings-help">飲食店ホールの卓タイマー</p>
      </div>
      <form className="login-form" onSubmit={submit} aria-describedby={shown ? 'login-error' : undefined}>
        <h2 className={signup ? 'login-form-title' : 'sr-only'}>{signup ? 'アカウントを作る' : 'ログイン'}</h2>
        <label className="field-label" htmlFor="login-email">メールアドレス</label>
        <input id="login-email" className="field-select" type="email" autoComplete={signup ? 'email' : 'username'} required value={email} onChange={event => setEmail(event.target.value)} />
        <label className="field-label" htmlFor="login-password">パスワード{signup && `（${PASSWORD_MIN}文字以上）`}</label>
        <input id="login-password" className="field-select" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? PASSWORD_MIN : undefined} value={password} onChange={event => setPassword(event.target.value)} />
        {signup && <>
          <label className="field-label" htmlFor="login-confirm">パスワード（確認のため、もう一度）</label>
          <input id="login-confirm" className="field-select" type="password" autoComplete="new-password" required value={confirm} onChange={event => setConfirm(event.target.value)} />
        </>}
        {shown && <p id="login-error" className="confirm-warning" role="alert">{shown}</p>}
        <button className="panel-button primary" type="submit" disabled={busy}>{signup ? busy ? 'アカウントを作っています…' : 'アカウントを作る' : busy ? 'ログインしています…' : 'ログイン'}</button>
        {TEST_LOGIN && !signup && <button className="panel-button" type="button" disabled={busy} onClick={() => onLogin(TEST_LOGIN.email, TEST_LOGIN.password)}>テスト用でログイン（開発中だけ）</button>}
        <p className="login-switch">{signup ? 'アカウントがある店は' : 'はじめての店は'}<button className="link-button" type="button" disabled={busy} onClick={switchMode}>{signup ? 'ログイン' : 'アカウントを作る'}</button></p>
      </form>
      <p className="login-or" aria-hidden="true">または</p>
      <div className="login-guest">
        <button className="panel-button" disabled={busy} onClick={onGuest}>ログインせずに使う</button>
        <p className="settings-help">今の店（ログインなしで使っている店）のデータで使います。</p>
      </div>
    </section>
  </main>;
}
