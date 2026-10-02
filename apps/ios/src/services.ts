import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { LOGIN_MODE_KEY, parseLoginMode, type LoginMode } from '@table-check/core/auth';
import { isStoreProject, STORE_PROJECT_ID } from '@table-check/core/firebaseProjects';
import type { ShopStores } from '@table-check/core/firestoreServices';
import { NoEditingStore } from '@table-check/core/editing';
import { MemorySessionStore, MemoryShopTimerStore } from '@table-check/core/memoryStores';
import { MemoryShopSettingsStore } from '@table-check/core/shopSettings';
import { MemoryShopLayoutStore } from '@table-check/core/shopLayout';
import { firebaseConfigFromEnv, initFirebase } from './firebase';

// trial：Firebase につながず、アプリを開いている間だけ端末の中で動いている（開発中の試し）
// account：ログインしている店のメールアドレス（今の店は null）。onLeave：ログアウト・ログインし直す（No.88）
export interface Services extends ShopStores { trial: boolean; account: string | null; onLeave?(): void }
export function memoryStores(): ShopStores {
  return { store: new MemorySessionStore(), shopTimerStore: new MemoryShopTimerStore(), editingStore: new NoEditingStore(), shopSettingsStore: new MemoryShopSettingsStore(), shopLayoutStore: new MemoryShopLayoutStore() };
}
// Firebase の設定があればつなぐ（どの店のデータを使うかは最初の画面で選ぶ）。
// 店が使っているプロジェクトのときは、「ログインせずに使う」を端末の中だけで動かす（ログインした店 shops/{uid}/ は店のデータと別なので、つないで試せる）
function connect(): { db: Firestore; auth: Auth; guestOnDevice: boolean } | null {
  const config = firebaseConfigFromEnv();
  if (!config) return null;
  const guestOnDevice = isStoreProject(config.projectId);
  if (guestOnDevice) console.warn(`${STORE_PROJECT_ID} は店が使っているので、「ログインせずに使う」はつながずにこの端末の中だけで動きます`);
  return { ...initFirebase(config), guestOnDevice };
}
export const firebase = connect();
export async function readMode(): Promise<LoginMode | null> {
  try { return parseLoginMode(await AsyncStorage.getItem(LOGIN_MODE_KEY)); } catch { return null; }
}
export function writeMode(mode: LoginMode | null): void {
  void (mode ? AsyncStorage.setItem(LOGIN_MODE_KEY, mode) : AsyncStorage.removeItem(LOGIN_MODE_KEY)).catch(() => undefined);
}
