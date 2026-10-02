import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { isStoreProject, STORE_PROJECT_ID } from '@table-check/core/firebaseProjects';

export function firebaseConfigFromEnv(): FirebaseOptions | null {
  const env = import.meta.env;
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const appId = env.VITE_FIREBASE_APP_ID;
  if (!(apiKey && authDomain && projectId && appId)) return null;
  return { apiKey, authDomain, projectId, appId };
}
// 開発中（npm run dev など）に店のプロジェクトにつないでいるときは、「ログインせずに使う」を店のデータにつながず、
// この端末の localStorage だけで動かす。ログインした店（shops/{uid}/）は店のデータと別なので、つないで試せる（No.88）
export function guestOnDevice(config: FirebaseOptions): boolean {
  if (!(import.meta.env.DEV && isStoreProject(config.projectId))) return false;
  console.warn(`${STORE_PROJECT_ID} は店が使っているので、開発中の「ログインせずに使う」はつながずにこの端末の中だけで動きます`);
  return true;
}
export function initFirebase(config: FirebaseOptions): { db: Firestore; auth: Auth } {
  const app = initializeApp(config);
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  return { db, auth: getAuth(app) };
}
