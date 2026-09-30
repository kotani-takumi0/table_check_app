import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, type Auth, type User } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';

export function firebaseConfigFromEnv(): FirebaseOptions | null {
  const env = import.meta.env;
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const appId = env.VITE_FIREBASE_APP_ID;
  return apiKey && authDomain && projectId && appId ? { apiKey, authDomain, projectId, appId } : null;
}
export function initFirebase(config: FirebaseOptions): { db: Firestore; auth: Auth } {
  const app = initializeApp(config);
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  return { db, auth: getAuth(app) };
}
export function waitForUser(auth: Auth): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      unsubscribe();
      if (user) resolve(user);
      else signInAnonymously(auth).then(result => resolve(result.user), reject);
    }, error => { unsubscribe(); reject(error); });
  });
}
