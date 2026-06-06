// ─────────────────────────────────────────────────────────────────────────────
// EventBus — in-process pub/sub untuk SSE realtime
// ─────────────────────────────────────────────────────────────────────────────
// Dipakai backend untuk emit event saat ada perubahan state penting (checkout,
// payment settled, photo saved, low cash). SSE route subscribe & forward ke
// client yang relevan (filter by outlet).
//
// Karena single-process, ini cukup untuk skala kecil-menengah. Kalau ke depan
// scale ke multi-instance, replace dengan Redis pub/sub.
// ─────────────────────────────────────────────────────────────────────────────
import { EventEmitter } from 'events';

class RealtimeBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // tiap user terbuka 1 listener; 100 = 100 user concurrent
  }

  /**
   * Emit event realtime ke semua subscriber.
   *
   * @param {string} type - kategori event: 'transaction', 'payment', 'production', 'cash', 'inventory'
   * @param {Object} payload - { outletId, ...data }
   *
   * outletId WAJIB diisi supaya bisa filter per-outlet. Pakai 0 untuk broadcast ke semua.
   */
  publish(type, payload) {
    if (!type) return;
    const event = {
      type,
      outletId: payload?.outletId ?? 0,
      ts: Date.now(),
      data: payload,
    };
    this.emit('event', event);
  }
}

const bus = new RealtimeBus();

// Helper convenience methods supaya call site lebih readable
export const emitTransactionCheckout = (outletId, transactionNo, transactionId) =>
  bus.publish('transaction:checkout', { outletId, transactionNo, transactionId });

export const emitPaymentSettled = (outletId, transactionId, amount, method, extra = {}) =>
  bus.publish('payment:settled', { outletId, transactionId, amount, method, ...extra });

export const emitPhotoSaved = (outletId, transactionId, unitId, kind) =>
  bus.publish('production:photo', { outletId, transactionId, unitId, kind });

export const emitProductionUpdate = (outletId, transactionId, unitId, productionStatus) =>
  bus.publish('production:update', { outletId, transactionId, unitId, productionStatus });

export const emitCashLow = (outletId, balance, threshold) =>
  bus.publish('cash:low', { outletId, balance, threshold });

export const emitNotificationNew = (outletId, recipientUserId, notifType) =>
  bus.publish('notification:new', { outletId, recipientUserId, notifType });

export default bus;
