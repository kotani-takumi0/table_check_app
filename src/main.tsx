import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LocalSessionStore, type SessionStore } from './store';
import { firebaseConfigFromEnv, initFirebase, waitForUser } from './firebase';
import { FirestoreSessionStore } from './firestoreStore';
import { startServerClock } from './serverClock';
import './App.css';
const config = firebaseConfigFromEnv();
let store: SessionStore;
if (config) {
  const { db, auth } = initFirebase(config);
  const userReady = waitForUser(auth);
  store = new FirestoreSessionStore(db, userReady);
  let stopClock: (() => void) | undefined;
  let disposed = false;
  void userReady.then(user => {
    if (!disposed) stopClock = startServerClock(db, user.uid);
  }, () => { /* The store reports authentication errors. */ });
  import.meta.hot?.dispose(() => { disposed = true; stopClock?.(); });
} else {
  store = new LocalSessionStore();
}
createRoot(document.getElementById('root')!).render(<StrictMode><App store={store} /></StrictMode>);
