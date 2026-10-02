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
  // 開発中（npm run dev など）は店のデータにつながず、この端末の localStorage だけで動く
  if (env.DEV && isStoreProject(projectId)) {
    console.warn(`${STORE_PROJECT_ID} は店が使っているので、開発中はつながずにこの端末の中だけで動きます`);
    return null;
  }
  return { apiKey, authDomain, projectId, appId };
}
export function initFirebase(config: FirebaseOptions): { db: Firestore; auth: Auth } {
  const app = initializeApp(config);
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  return { db, auth: getAuth(app) };
}
