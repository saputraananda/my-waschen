// ─────────────────────────────────────────────────────────────────────────────
// Realtime Client — SSE + window event bus
// ─────────────────────────────────────────────────────────────────────────────
// Ringkasan:
//   - connectRealtime(token) — buka EventSource ke /api/realtime/events
//   - SSE event di-forward ke window.dispatchEvent('realtime:<type>', detail)
//   - Halaman bisa subscribe via useRealtime(type, handler) atau langsung listen
//   - Auto-reconnect dengan exponential backoff kalau koneksi putus
//   - Kalau SSE gagal terus, ada fallback "polling mode" pakai useAppRefresh
//
// Pemakaian di komponen:
//   useRealtime('payment:settled', ({ transactionId, amount }) => { ... });
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';

let currentSource = null;
let currentToken = null;
let reconnectTimer = null;
let reconnectDelay = 1_000; // start 1s, cap di 30s
let isConnected = false;

const MAX_RECONNECT_DELAY = 30_000;

/**
 * Connect ke SSE realtime stream. Idempotent — kalau sudah connect dengan token
 * yang sama, tidak buat connection baru.
 */
export function connectRealtime(token) {
  if (!token) return;
  if (currentSource && currentToken === token && isConnected) return;

  // Tutup koneksi lama kalau ada
  disconnectRealtime();

  currentToken = token;
  try {
    const url = `/api/realtime/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    currentSource = es;

    es.onopen = () => {
      isConnected = true;
      reconnectDelay = 1_000; // reset backoff
      window.dispatchEvent(new CustomEvent('realtime:connected'));
    };

    es.onerror = () => {
      isConnected = false;
      window.dispatchEvent(new CustomEvent('realtime:disconnected'));
      // EventSource auto-reconnect, tapi kalau token expired akan loop forever
      // Schedule manual reconnect dengan backoff supaya bisa stop kalau token bad
      try { es.close(); } catch {}
      currentSource = null;
      scheduleReconnect();
    };

    // Listen ke semua event type yang dikirim backend (lihat eventBus.js)
    const eventTypes = [
      'hello',
      'transaction:checkout',
      'payment:settled',
      'production:photo',
      'production:update',
      'production:new-item',
      'cash:low',
      'notification:new',
    ];
    eventTypes.forEach(type => {
      es.addEventListener(type, (e) => {
        try {
          const data = JSON.parse(e.data);
          window.dispatchEvent(new CustomEvent(`realtime:${type}`, { detail: data }));
        } catch {
          // ignore malformed
        }
      });
    });
  } catch (e) {
    console.warn('[realtime] failed to open SSE:', e?.message || e);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer || !currentToken) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (currentToken) connectRealtime(currentToken);
  }, reconnectDelay);
  reconnectDelay = Math.min(MAX_RECONNECT_DELAY, reconnectDelay * 2);
}

export function disconnectRealtime() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (currentSource) {
    try { currentSource.close(); } catch {}
    currentSource = null;
  }
  currentToken = null;
  isConnected = false;
  reconnectDelay = 1_000;
}

export function isRealtimeConnected() {
  return isConnected;
}

/**
 * Hook subscribe ke realtime event — auto cleanup pada unmount.
 *
 * @param {string} type - misal 'payment:settled', 'transaction:checkout'
 * @param {Function} handler - dipanggil dengan event detail (data dari backend)
 */
export function useRealtime(type, handler) {
  useEffect(() => {
    if (!type || typeof handler !== 'function') return;
    const evtName = `realtime:${type}`;
    const wrapped = (e) => handler(e.detail);
    window.addEventListener(evtName, wrapped);
    return () => window.removeEventListener(evtName, wrapped);
  }, [type, handler]);
}

/**
 * Subscribe ke multiple event sekaligus. Convenience untuk halaman yang
 * butuh refresh on banyak event yang berbeda (e.g. AntrianPage produksi
 * ingin refresh kalau ada checkout baru ATAU production update).
 */
export function useRealtimeMulti(types, handler) {
  useEffect(() => {
    if (!Array.isArray(types) || typeof handler !== 'function') return;
    const wrapped = (e) => handler(e.detail);
    const eventNames = types.map(t => `realtime:${t}`);
    eventNames.forEach(n => window.addEventListener(n, wrapped));
    return () => eventNames.forEach(n => window.removeEventListener(n, wrapped));
  }, [types, handler]);
}
