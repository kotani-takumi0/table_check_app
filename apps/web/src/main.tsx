import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Root } from './Root';
import type { ShopStores } from '@table-check/core/firestoreServices';
import { firebaseConfigFromEnv, guestOnDevice, initFirebase } from './firebase';
import { LocalSessionStore } from './localSessionStore';
import { LocalShopTimerStore } from './localShopTimerStore';
import { NoEditingStore } from '@table-check/core/editing';
import { LocalShopSettingsStore } from './localShopSettingsStore';
import { LocalShopLayoutStore } from './localShopLayoutStore';
import './App.css';
// Firebase につながず、このブラウザの中だけで動く保存先（開発中の試し）
const localStores = (): ShopStores => ({
  store: new LocalSessionStore(), shopTimerStore: new LocalShopTimerStore(), editingStore: new NoEditingStore(),
  shopSettingsStore: new LocalShopSettingsStore(), shopLayoutStore: new LocalShopLayoutStore(),
});
const config = firebaseConfigFromEnv();
const root = createRoot(document.getElementById('root')!);
if (config) {
  // どの店のデータを使うかは最初の画面で選ぶ（No.88）
  const { db, auth } = initFirebase(config);
  root.render(<StrictMode><Root db={db} auth={auth} guestStores={guestOnDevice(config) ? localStores : null} /></StrictMode>);
} else {
  root.render(<StrictMode><App {...localStores()} trial /></StrictMode>);
}
