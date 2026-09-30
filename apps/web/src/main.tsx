import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import type { SessionStore } from '@table-check/core/store';
import { waitForUser } from '@table-check/core/auth';
import { FirestoreSessionStore } from '@table-check/core/firestoreStore';
import { startServerClock } from '@table-check/core/serverClock';
import { FirestoreShopTimerStore } from '@table-check/core/firestoreShopTimers';
import type { ShopTimerStore } from '@table-check/core/shopTimers';
import { firebaseConfigFromEnv, initFirebase } from './firebase';
import { LocalSessionStore } from './localSessionStore';
import { LocalShopTimerStore } from './localShopTimerStore';
import './App.css';
const config = firebaseConfigFromEnv();
let store: SessionStore;
let shopTimerStore: ShopTimerStore;
if (config) {
  const { db, auth } = initFirebase(config);
  const userReady = waitForUser(auth);
  store = new FirestoreSessionStore(db, userReady);
  shopTimerStore = new FirestoreShopTimerStore(db, userReady);
  let stopClock: (() => void) | undefined;
  let disposed = false;
  void userReady.then(user => {
    if (!disposed) stopClock = startServerClock(db, user.uid);
  }, () => { /* The store reports authentication errors. */ });
  import.meta.hot?.dispose(() => { disposed = true; stopClock?.(); });
} else {
  store = new LocalSessionStore();
  shopTimerStore = new LocalShopTimerStore();
}
createRoot(document.getElementById('root')!).render(<StrictMode><App store={store} shopTimerStore={shopTimerStore} /></StrictMode>);
