import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/screen.css';
import './styles/panels.css';

const meta = document.querySelector('meta[name="theme-color"]');
if (meta) meta.setAttribute('content', '#041323');

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// PWA：首次完整快取後才標離線可用；工作中延後重載，不清 IndexedDB。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void import('./pwa/registerSW').then((m) => m.registerSWWithUpdatePrompt());
  });
}
