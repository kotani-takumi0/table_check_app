import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitForUser } from '@table-check/core/auth';
import { isStoreProject, STORE_PROJECT_ID } from '@table-check/core/firebaseProjects';
import { FirestoreSessionStore } from '@table-check/core/firestoreStore';
import { FirestoreShopTimerStore } from '@table-check/core/firestoreShopTimers';
import { FirestoreEditingStore, newDeviceId } from '@table-check/core/firestoreEditing';
import { NoEditingStore, type EditingStore } from '@table-check/core/editing';
import { MemorySessionStore, MemoryShopTimerStore } from '@table-check/core/memoryStores';
import { FirestoreShopSettingsStore } from '@table-check/core/firestoreShopSettings';
import { MemoryShopSettingsStore, type ShopSettingsStore } from '@table-check/core/shopSettings';
import { startServerClock } from '@table-check/core/serverClock';
import type { ShopTimerStore } from '@table-check/core/shopTimers';
import type { SessionStore } from '@table-check/core/store';
import { firebaseConfigFromEnv, initFirebase } from './firebase';

// trial：Firebase につながず、アプリを開いている間だけ端末の中で動いている（開発中の試し）
export interface Services { store: SessionStore; shopTimerStore: ShopTimerStore; editingStore: EditingStore; shopSettingsStore: ShopSettingsStore; projectId: string; trial: boolean }
// 設定が無いとき・店が使っているプロジェクトの設定のときは、Firebase につながずに端末の中だけで動く
function createServices(): Services {
  const config = firebaseConfigFromEnv();
  if (!config || isStoreProject(config.projectId)) {
    if (config) console.warn(`${STORE_PROJECT_ID} は店が使っているので、つながずにこの端末の中だけで動きます`);
    return { store: new MemorySessionStore(), shopTimerStore: new MemoryShopTimerStore(), editingStore: new NoEditingStore(), shopSettingsStore: new MemoryShopSettingsStore(), projectId: '', trial: true };
  }
  const { db, auth } = initFirebase(config);
  const userReady = waitForUser(auth);
  void userReady.then(user => { startServerClock(db, user.uid, AsyncStorage); }, () => { /* The store reports authentication errors. */ });
  return {
    store: new FirestoreSessionStore(db, userReady),
    shopTimerStore: new FirestoreShopTimerStore(db, userReady),
    editingStore: new FirestoreEditingStore(db, userReady, newDeviceId()),
    shopSettingsStore: new FirestoreShopSettingsStore(db, userReady),
    projectId: config.projectId ?? '',
    trial: false,
  };
}
export const services = createServices();
