import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './utils/api'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ── PWA Service Worker Registration ──────────────────────
// Disabled during development to prevent stale cache issues
// Enable in production only
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[SW] Registered:', reg.scope);
        setInterval(() => reg.update(), 30 * 60 * 1000);
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
  });
}

// Unregister any existing service workers in development
if ('serviceWorker' in navigator && !import.meta.env.PROD) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
      console.log('[SW] Unregistered dev service worker');
    }
  });
}
