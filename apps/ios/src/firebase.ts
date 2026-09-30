import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, type Firestore } from 'firebase/firestore';

// Expo は EXPO_PUBLIC_ で始まる変数を、process.env.〜 と書いた箇所にだけ埋め込む（分割代入すると埋め込まれない）
export function firebaseConfigFromEnv(): FirebaseOptions | null {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;
  return apiKey && authDomain && projectId && appId ? { apiKey, authDomain, projectId, appId } : null;
}
export function initFirebase(config: FirebaseOptions): { db: Firestore; auth: Auth } {
  const app = initializeApp(config);
  // 匿名ログインを AsyncStorage に残し、アプリを開き直しても同じ利用者のままにする
  const auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  // React Native では Firestore の永続キャッシュ（IndexedDB）が使えないので、開いている間だけのメモリに持つ
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  return { db, auth };
}
