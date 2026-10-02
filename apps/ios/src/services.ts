import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitForUser } from '@table-check/core/auth';
import { FirestoreSessionStore } from '@table-check/core/firestoreStore';
import { FirestoreShopTimerStore } from '@table-check/core/firestoreShopTimers';
import { startServerClock } from '@table-check/core/serverClock';
import type { ShopTimerStore } from '@table-check/core/shopTimers';
import type { SessionStore } from '@table-check/core/store';
import { firebaseConfigFromEnv, initFirebase } from './firebase';

export interface Services { store: SessionStore; shopTimerStore: ShopTimerStore; projectId: string }
// iOS は常に Firestore を使う（設定が無いときは画面で知らせる）
function createServices(): Services | null {
  const config = firebaseConfigFromEnv();
  if (!config) return null;
  const { db, auth } = initFirebase(config);
  const userReady = waitForUser(auth);
  void userReady.then(user => { startServerClock(db, user.uid, AsyncStorage); }, () => { /* The store reports authentication errors. */ });
  return {
    store: new FirestoreSessionStore(db, userReady),
    shopTimerStore: new FirestoreShopTimerStore(db, userReady),
    projectId: config.projectId ?? '',
  };
}
export const services = createServices();
