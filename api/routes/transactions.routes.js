import { Router } from 'express';
import { authenticate, requireRole, requireActiveShift } from '../middleware/auth.js';
import { writeLimiter, approvalLimiter, readLimiter } from '../middleware/rateLimit.js';
import { cacheResponse, invalidatePattern } from '../middleware/cacheResponse.js';
import { validateCheckout } from '../schemas/validationSchemas.js';
import {
  checkoutTransaction,
  getTransactions,
  getTransactionById,
  recordTransactionPayment,
  getDashboardStats,
  getProductionQueue,
  getProductionHistory,
  updateTransactionStatus,
  cancelTransaction,
  updateProductionStage,
  revertProductionStage,
  saveItemCondition,
  getTransactionPhotos,
  deleteItemPhoto,
  updateItemPhoto,
  saveReview,
  requestApproval,
  updateDeliveryType,
  updatePackingInfo,
  rescheduleTransaction,
  requestCancellation,
} from '../controllers/transactionController.js';

// BUG FIX 5 & 6: Label Printing Controller (Requirements 2.7, 2.8)
import {
  getTransactionLabels as getLabelsFromLabelController,
  printTransactionLabels,
} from '../controllers/labelPrintingController.js';
import { sendTransactionWhatsapp } from '../controllers/whatsappController.js';

const router = Router();

// Invalidate cache transactions setiap ada mutasi data.
// Termasuk production endpoints supaya foto/stage update langsung visible.
const invalidateTx = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      invalidatePattern('GET:/api/transactions*');
    }
  });
  next();
};

// GET /api/transactions — list transaksi (cache 20 detik fresh, stale 80 detik)
// URUTAN PENTING: cacheResponse SEBELUM readLimiter — supaya cache HIT bypass rate limit
router.get('/', authenticate, cacheResponse({ ttl: 20_000 }), readLimiter, getTransactions);

// GET /api/transactions/dashboard/stats — statistik dashboard (cache 30 detik)
router.get('/dashboard/stats', authenticate, cacheResponse({ ttl: 30_000 }), readLimiter, getDashboardStats);

// GET /api/transactions/production/queue — antrian produksi (cache 8 detik fresh, stale 32 detik)
// Polling-friendly: tab 30s polling masih dapat cache HIT 4x sebelum miss.
router.get('/production/queue', authenticate, requireRole('kasir', 'frontline', 'produksi', 'admin', 'finance'), cacheResponse({ ttl: 8_000 }), readLimiter, getProductionQueue);

// GET /api/transactions/production/history — riwayat produksi (cache 30 detik fresh, stale 2 menit)
router.get('/production/history', authenticate, requireRole('produksi', 'admin', 'kasir', 'frontline'), cacheResponse({ ttl: 30_000 }), readLimiter, getProductionHistory);

// GET /api/transactions/production/order/:id — detail riwayat (cache 60 detik)
// TODO: Temporarily disabled - function not yet implemented
// router.get('/production/order/:id', authenticate, requireRole('produksi', 'admin', 'kasir', 'frontline'), cacheResponse({ ttl: 60_000 }), readLimiter, getProductionOrderDetail);

// GET /api/transactions/:id — detail transaksi (cache 10 detik, sering dilihat saat proses)
router.get('/:id', authenticate, cacheResponse({ ttl: 10_000 }), readLimiter, getTransactionById);

// PUT /api/transactions/:id/status — update status transaksi (konfirmasi diambil, dll.)
// NOTE: tidak pakai requireActiveShift karena endpoint ini juga dipakai oleh role produksi
// untuk update stage, dan produksi tidak punya shift.
router.put('/:id/status', authenticate, requireRole('kasir', 'frontline', 'produksi', 'admin'), writeLimiter, invalidateTx, updateTransactionStatus);

// POST /api/transactions/checkout — buat nota (kasir / admin / finance; bukan produksi)
// Validation: Zod schema validates customerId, items[], outletId, payment details
router.post('/checkout', authenticate, requireRole('kasir', 'frontline', 'admin', 'finance'), requireActiveShift, writeLimiter, invalidateTx, validateCheckout, checkoutTransaction);

// POST /api/transactions/:id/payments — pelunasan / pembayaran lanjutan (kasir & admin)
router.post('/:id/payments', authenticate, requireRole('kasir', 'frontline', 'admin', 'finance'), requireActiveShift, writeLimiter, invalidateTx, recordTransactionPayment);

// PATCH /api/transactions/:id/cancel — batalkan transaksi
router.patch('/:id/cancel', authenticate, requireRole('kasir', 'frontline', 'admin'), approvalLimiter, invalidateTx, cancelTransaction);

// PATCH /api/transactions/:id/production-stage — catat progress produksi
router.patch('/:id/production-stage', authenticate, requireRole('produksi', 'admin'), writeLimiter, invalidateTx, updateProductionStage);

// PATCH /api/transactions/:id/production-stage/revert — rollback stage (handle salah pencet)
router.patch('/:id/production-stage/revert', authenticate, requireRole('produksi', 'admin'), writeLimiter, invalidateTx, revertProductionStage);

// POST /api/transactions/:id/condition — catat kondisi pakaian (auto invalidate cache supaya foto langsung visible)
router.post('/:id/condition', authenticate, writeLimiter, invalidateTx, saveItemCondition);

// GET /api/transactions/:id/photos — debug: lihat semua foto yang tersimpan (no cache, debug)
router.get('/:id/photos', authenticate, readLimiter, getTransactionPhotos);

// DELETE /api/transactions/:id/photos/:photoId — soft delete foto
router.delete('/:id/photos/:photoId', authenticate, requireRole('produksi', 'admin'), writeLimiter, invalidateTx, deleteItemPhoto);

// PATCH /api/transactions/:id/photos/:photoId — update notes/type foto
router.patch('/:id/photos/:photoId', authenticate, requireRole('produksi', 'admin'), writeLimiter, invalidateTx, updateItemPhoto);

// POST /api/transactions/:id/review — submit review
router.post('/:id/review', authenticate, writeLimiter, invalidateTx, saveReview);

// POST /api/transactions/:id/request-approval — ajukan pembatalan/penghapusan via approval
router.post('/:id/request-approval', authenticate, approvalLimiter, invalidateTx, requestApproval);

// PATCH /api/transactions/:id/delivery-type — ubah jenis pengiriman (self/pickup/delivery)
router.patch('/:id/delivery-type', authenticate, requireRole('kasir', 'frontline', 'admin'), writeLimiter, invalidateTx, updateDeliveryType);

// PATCH /api/transactions/:id/items/:itemId/packing — set packing requirement (kasir) atau update packing_done (produksi)
router.patch('/:id/items/:itemId/packing', authenticate, requireRole('kasir', 'frontline', 'produksi', 'admin'), writeLimiter, invalidateTx, updatePackingInfo);

// PATCH /api/transactions/:id/reschedule — ubah estimasi & jadwal pickup/delivery
router.patch('/:id/reschedule', authenticate, requireRole('kasir', 'frontline', 'admin'), writeLimiter, invalidateTx, rescheduleTransaction);

// POST /api/transactions/:id/cancellation-requests — ajukan pembatalan
router.post('/:id/cancellation-requests', authenticate, requireRole('kasir', 'frontline', 'admin'), writeLimiter, invalidateTx, requestCancellation);

// GET /api/transactions/:id/labels — data label untuk print nota/item
// BUG FIX 5: Use dedicated label controller (Requirements 2.7)
router.get('/:id/labels', authenticate, readLimiter, getLabelsFromLabelController);

// POST /api/transactions/:id/labels/print — log print/reprint action
// BUG FIX 6: Label print logging (Requirements 2.8)
router.post('/:id/labels/print', authenticate, writeLimiter, invalidateTx, printTransactionLabels);

// POST /api/transactions/:id/send-whatsapp — kirim pesan WhatsApp dari transaksi
router.post('/:id/send-whatsapp', authenticate, requireRole('kasir', 'frontline', 'admin', 'produksi'), writeLimiter, invalidateTx, sendTransactionWhatsapp);

export default router;
