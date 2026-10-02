import { useState, type FormEvent } from 'react';

// 開発中（npm run dev）だけ出す「テスト用でログイン」。値は .env.development.local の VITE_TEST_LOGIN_*（店や本番のビルドには入らない）
const TEST_LOGIN = import.meta.env.DEV && import.meta.env.VITE_TEST_LOGIN_EMAIL && import.meta.env.VITE_TEST_LOGIN_PASSWORD
  ? { email: import.meta.env.VITE_TEST_LOGIN_EMAIL as string, password: import.meta.env.VITE_TEST_LOGIN_PASSWORD as string } : null;

// 最初の画面（No.88）：ログインするか、ログインせずに今の店のデータで使うかを選ぶ。選んだ結果はこの端末で覚える
export function LoginScreen({ busy, error, onLogin, onGuest }: { busy: boolean; error: string; onLogin(email: string, password: string): void; onGuest(): void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); onLogin(email, password); };
  return <main className="login">
    <section className="login-card glass" aria-labelledby="login-title">
      <h1 id="login-title" className="login-title">Minopal</h1>
      <form className="login-form" onSubmit={submit} aria-describedby={error ? 'login-error' : undefined}>
        <h2 className="settings-group-title">ログイン</h2>
        <label className="field-label" htmlFor="login-email">メールアドレス</label>
        <input id="login-email" className="field-select" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} />
        <label className="field-label" htmlFor="login-password">パスワード</label>
        <input id="login-password" className="field-select" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
        {error && <p id="login-error" className="confirm-warning" role="alert">{error}</p>}
        <button className="panel-button primary" type="submit" disabled={busy}>{busy ? 'ログインしています…' : 'ログイン'}</button>
        {TEST_LOGIN && <button className="panel-button" type="button" disabled={busy} onClick={() => onLogin(TEST_LOGIN.email, TEST_LOGIN.password)}>テスト用でログイン（開発中だけ）</button>}
      </form>
      <div className="login-guest">
        <button className="panel-button" disabled={busy} onClick={onGuest}>ログインせずに使う</button>
        <p className="settings-help">今の店（ログインなしで使っている店）のデータで使います。</p>
      </div>
    </section>
  </main>;
}
