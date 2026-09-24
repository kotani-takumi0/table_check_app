import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LocalSessionStore } from './store';
import './App.css';
const store = new LocalSessionStore();
createRoot(document.getElementById('root')!).render(<StrictMode><App store={store} /></StrictMode>);
