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

export const emitProductionUpdate = (outletId, transactionId, unitId, productionStatus) => {
  // Support both old API (4 args) and new API (object with optional fields)
  if (typeof outletId === 'object') {
    const opts = outletId;
    bus.publish('production:update', {
      outletId: opts.outletId ?? 0,
      transactionId: opts.transactionId,
      unitId: opts.unitId,
      productionStatus: opts.productionStatus,
      type: opts.type,
      itemUnitId: opts.itemUnitId,
      unitNo: opts.unitNo,
      oldStatus: opts.oldStatus,
      newStatus: opts.newStatus,
      isFullyReady: opts.isFullyReady,
      updatedBy: opts.updatedBy,
    });
  } else {
    bus.publish('production:update', { outletId, transactionId, unitId, productionStatus });
  }
};

export const emitProductionNewItem = (outletId, transactionId, transactionNo, itemName, customerName, isExpress, estimatedDoneAt) =>
  bus.publish('production:new-item', { outletId, transactionId, transactionNo, itemName, customerName, isExpress, estimatedDoneAt });

export const emitCashLow = (outletId, balance, threshold) =>
  bus.publish('cash:low', { outletId, balance, threshold });

export const emitNotificationNew = (outletId, recipientUserId, notifType) =>
  bus.publish('notification:new', { outletId, recipientUserId, notifType });

export const emitWhatsappSent = ({ outletId, transactionId, customerId, templateCode }) =>
  bus.publish('whatsapp:sent', { outletId: outletId ?? 0, transactionId, customerId, templateCode });

// ── Adjustment Events ───────────────────────────────────────────────────
export const emitAdjustmentCreated = ({ adjustmentId, adjustmentNo, transactionId, transactionNo, type, difference, action, createdBy }) =>
  bus.publish('adjustment:created', {
    adjustmentId, adjustmentNo, transactionId, transactionNo, type, difference, action, createdBy
  });

export const emitAdjustmentApproved = ({ adjustmentId, adjustmentNo, transactionId, approvedBy }) =>
  bus.publish('adjustment:approved', { adjustmentId, adjustmentNo, transactionId, approvedBy });

export const emitAdjustmentRejected = ({ adjustmentId, adjustmentNo, transactionId, rejectedBy, reason }) =>
  bus.publish('adjustment:rejected', { adjustmentId, adjustmentNo, transactionId, rejectedBy, reason });

export default bus;
