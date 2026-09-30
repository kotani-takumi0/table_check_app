import { onAuthStateChanged, signInAnonymously, type Auth, type User } from 'firebase/auth';

// ログイン済みならその利用者を、まだなら匿名でログインして返す
export function waitForUser(auth: Auth): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      unsubscribe();
      if (user) resolve(user);
      else signInAnonymously(auth).then(result => resolve(result.user), reject);
    }, error => { unsubscribe(); reject(error); });
  });
}
