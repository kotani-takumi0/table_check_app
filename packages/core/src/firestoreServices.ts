import type { User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { EditingStore } from './editing';
import { FirestoreEditingStore } from './firestoreEditing';
import { FirestoreShopLayoutStore } from './firestoreShopLayout';
import { FirestoreShopSettingsStore } from './firestoreShopSettings';
import { FirestoreShopTimerStore } from './firestoreShopTimers';
import { FirestoreSessionStore } from './firestoreStore';
import type { ShopBase } from './shopPath';
import type { ShopLayoutStore } from './shopLayout';
import type { ShopSettingsStore } from './shopSettings';
import type { ShopTimerStore } from './shopTimers';
import type { SessionStore } from './store';

// 1つの店のデータの保存先（案内・タイマー・編集中の印・設定・席の配置）
export interface ShopStores { store: SessionStore; shopTimerStore: ShopTimerStore; editingStore: EditingStore; shopSettingsStore: ShopSettingsStore; shopLayoutStore: ShopLayoutStore }
// base の店（今の店はいちばん上、ログインした店は shops/{uid}/）を Firestore で読み書きする（No.88）
export function firestoreStores(db: Firestore, userReady: Promise<User>, base: ShopBase, deviceId: string): ShopStores {
  return {
    store: new FirestoreSessionStore(db, userReady, base),
    shopTimerStore: new FirestoreShopTimerStore(db, userReady, base),
    editingStore: new FirestoreEditingStore(db, userReady, deviceId, base),
    shopSettingsStore: new FirestoreShopSettingsStore(db, userReady, base),
    shopLayoutStore: new FirestoreShopLayoutStore(db, userReady, base),
  };
}
