import { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut, type Auth, type User } from 'firebase/auth';

// ログインしていればその利用者を、まだなら匿名でログインして返す
export function waitForUser(auth: Auth): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      unsubscribe();
      if (user) resolve(user);
      else signInAnonymously(auth).then(result => resolve(result.user), reject);
    }, error => { unsubscribe(); reject(error); });
  });
}
// 端末でどちらを使うか（No.88。最初の画面で選び、その端末で覚える）。guest は今の店（ログインなし）、account はログインした店
export type LoginMode = 'guest' | 'account';
export const LOGIN_MODE_KEY = 'minopal:loginMode';
export function parseLoginMode(value: string | null): LoginMode | null {
  return value === 'guest' || value === 'account' ? value : null;
}
// ログインせずに使う：匿名でログインする（メールでログインしていたらログアウトしてから）
export async function signInAsGuest(auth: Auth): Promise<User> {
  await auth.authStateReady();
  const current = auth.currentUser;
  if (current?.isAnonymous) return current;
  if (current) await signOut(auth);
  return (await signInAnonymously(auth)).user;
}
export async function signInWithEmail(auth: Auth, email: string, password: string): Promise<User> {
  return (await signInWithEmailAndPassword(auth, email.trim(), password)).user;
}
// メールでログインしているアカウント（匿名やログインしていなければ null）
export async function currentAccount(auth: Auth): Promise<User | null> {
  await auth.authStateReady();
  const user = auth.currentUser;
  return user && !user.isAnonymous ? user : null;
}
export function signOutAccount(auth: Auth): Promise<void> {
  return signOut(auth);
}
// ログインできなかった理由を、お店の人が読める言葉にする（Firebase のエラーコードから）
export function loginErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': case 'auth/invalid-email':
      return 'メールアドレスかパスワードが違います';
    case 'auth/missing-password': return 'パスワードを入れてください';
    case 'auth/too-many-requests': return '何度も失敗したので、少し待ってからもう一度ためしてください';
    case 'auth/network-request-failed': return 'インターネットにつながっていません。つながってからもう一度ためしてください';
    case 'auth/user-disabled': return 'このアカウントは使えなくなっています';
    case 'auth/operation-not-allowed': return 'メールでのログインがまだ使えません（Firebase の設定でオンにしてください）';
    default: return 'ログインできませんでした。もう一度ためしてください';
  }
}
