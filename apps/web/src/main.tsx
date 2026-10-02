import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import type { SessionStore } from '@table-check/core/store';
import { waitForUser } from '@table-check/core/auth';
import { FirestoreSessionStore } from '@table-check/core/firestoreStore';
import { startServerClock, type KeyValueStorage } from '@table-check/core/serverClock';
import { FirestoreShopTimerStore } from '@table-check/core/firestoreShopTimers';
import type { ShopTimerStore } from '@table-check/core/shopTimers';
import { firebaseConfigFromEnv, initFirebase } from './firebase';
import { LocalSessionStore } from './localSessionStore';
import { LocalShopTimerStore } from './localShopTimerStore';
import { FirestoreEditingStore, newDeviceId } from '@table-check/core/firestoreEditing';
import { NoEditingStore, type EditingStore } from '@table-check/core/editing';
import './App.css';
// localStorage は使えない環境だと触っただけで例外になるので、読み書きのたびに取りに行く（例外は startServerClock が受け止める）
const browserStorage: KeyValueStorage = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
const config = firebaseConfigFromEnv();
let store: SessionStore;
let shopTimerStore: ShopTimerStore;
let editingStore: EditingStore;
if (config) {
  const { db, auth } = initFirebase(config);
  const userReady = waitForUser(auth);
  store = new FirestoreSessionStore(db, userReady);
  shopTimerStore = new FirestoreShopTimerStore(db, userReady);
  editingStore = new FirestoreEditingStore(db, userReady, newDeviceId());
  let stopClock: (() => void) | undefined;
  let disposed = false;
  void userReady.then(user => {
    if (!disposed) stopClock = startServerClock(db, user.uid, browserStorage);
  }, () => { /* The store reports authentication errors. */ });
  import.meta.hot?.dispose(() => { disposed = true; stopClock?.(); });
} else {
  store = new LocalSessionStore();
  shopTimerStore = new LocalShopTimerStore();
  editingStore = new NoEditingStore();
}
createRoot(document.getElementById('root')!).render(<StrictMode><App store={store} shopTimerStore={shopTimerStore} editingStore={editingStore} /></StrictMode>);
