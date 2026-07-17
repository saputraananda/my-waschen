/**
 * Print Service - Simple Bluetooth Print
 * Reads settings fresh from localStorage each time
 */

import axios from 'axios';
import BTPrinter from './bluetoothPrinter';

const STORAGE_KEY = 'waschen_printer_config';
const AUTH_TOKEN_KEY = 'waschen_auth_token';

/**
 * Get Authorization header for API calls.
 */
function authHeaders() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return token ? { headers: { Authorization: 'Bearer ' + token } } : {};
}

/**
 * Read settings fresh from localStorage
 */
function getPrinterConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return {};
}

/**
 * Check if Bluetooth is available
 */
export function isBluetoothAvailable() {
  return BTPrinter.isWebBluetoothAvailable();
}

/**
 * Get printer status
 */
export function getPrinterStatus() {
  return BTPrinter.getStatus();
}

/**
 * Connect to printer
 * @param {string} [deviceId] - Optional: connect to a specific device directly
 */
export async function connectPrinter(deviceId) {
  return await BTPrinter.connect(deviceId);
}

/**
 * Disconnect printer
 */
export async function disconnectPrinter() {
  await BTPrinter.disconnect();
}

/**
 * Get saved printer device
 */
export function getSavedPrinter() {
  return BTPrinter.getSavedDevice();
}

/**
 * Clear saved printer
 */
export function clearSavedPrinter() {
  BTPrinter.clearSavedDevice();
}

/**
 * Get paired/known Bluetooth devices
 */
export async function getPairedDevices() {
  return await BTPrinter.getPairedDevices();
}

/**
 * Fetch transaction from API and build nota data for printer.
 * @param {string|number} transactionId
 */
export async function getNotaDataForPrinter(transactionId) {
  const res = await axios.get(`/api/transactions/${transactionId}`, authHeaders());
  const tx = res.data?.data || res.data;
  return buildNotaData(tx);
}

/**
 * Print receipt - reads settings fresh from localStorage
 * Also prints labels if printLabel config is true.
 * Labels are fetched from the dedicated label API endpoint.
 */
export async function printReceipt(transaction) {
  const data = buildNotaData(transaction);
  const result = await BTPrinter.print(data);

  // Print labels if enabled — fetch from label API
  const cfg = getPrinterConfig();
  if (cfg.printLabel) {
    try {
      const txId = transaction.id || transaction.transactionId;
      if (txId) {
        const res = await axios.get(`/api/transactions/${txId}/labels`, authHeaders());
        const labels = res.data?.data || [];
        for (let i = 0; i < labels.length; i++) {
          // QR is built natively via ESC/POS QR command inside BTPrinter.printLabel
          await BTPrinter.printLabel({ ...labels[i], _index: i, _total: labels.length }, data);
        }
      }
    } catch {
      // Label print is best-effort — don't fail the receipt print
    }
  }

  return result;
}

/**
 * Print label(s) for a transaction.
 * Fetches label data from the dedicated label API endpoint.
 * QR is generated via native ESC/POS QR command (no bitmap needed).
 * @param {string|object} transaction - transaction ID or full transaction object
 */
export async function printLabel(transaction) {
  let transactionId;

  // Accept both ID (string) and full object
  if (typeof transaction === 'string' || typeof transaction === 'number') {
    transactionId = transaction;
  } else {
    transactionId = transaction.id || transaction.transactionId;
  }

  if (!transactionId) {
    throw new Error('Transaction ID tidak ditemukan.');
  }

  // Fetch label data from API
  const res = await axios.get(`/api/transactions/${transactionId}/labels`, authHeaders());
  const labels = res.data?.data;

  if (!labels || labels.length === 0) {
    throw new Error('Tidak ada label untuk transaksi ini.');
  }

  // Get receipt data for outlet info
  const notaData = await getNotaDataForPrinter(transactionId);

  // Print each label — QR is built natively via ESC/POS QR command
  const results = [];
  for (let i = 0; i < labels.length; i++) {
    const labelData = { ...labels[i], _index: i, _total: labels.length };
    results.push(await BTPrinter.printLabel(labelData, notaData));
  }

  return { count: labels.length, results };
}

/**
 * Test print
 */
export async function printTestPage() {
  return await BTPrinter.printTest();
}

/**
 * Build nota data from transaction + settings (reads fresh from localStorage)
 */
export function buildNotaData(transaction) {
  // Read settings fresh from localStorage every time!
  const cfg = getPrinterConfig();

  const total = Number(transaction.total) || 0;
  const paidAmount = Number(transaction.paidAmount) || 0;
  const balance = Math.max(0, total - paidAmount);

  let status = 'HUTANG';
  if (paidAmount >= total) status = 'LUNAS';
  else if (paidAmount > 0) status = 'DP';

  return {
    // Outlet info - READ FRESH FROM LOCALSTORAGE
    outletName: cfg.outletName || 'MY WASCHEN',
    outletTagline: cfg.outletTagline || 'Clean, Fast, Reliable',
    outletAddress: cfg.outletAddress || '',
    outletPhone: cfg.outletPhone || '',

    // Transaction
    transactionNo: transaction.transactionNo || transaction.id || '',
    transactionDate: formatDate(transaction.createdAt || transaction.date),
    cashierName: transaction.createdBy || transaction.kasirName || '',
    estimatedDone: transaction.estimatedDoneAt ? formatDate(transaction.estimatedDoneAt) : '',

    // Show flags - READ FRESH FROM LOCALSTORAGE
    showDate: cfg.showTransactionDate !== false,
    showCashier: cfg.showCashierName !== false,
    showCustomer: cfg.showCustomerName !== false,
    showPhone: cfg.showCustomerPhone !== false,
    showAddress: cfg.showCustomerAddress || false,
    showEstDone: cfg.showEstimatedDone !== false,
    showFragrance: cfg.showFragrance !== false,

    // Customer
    customerName: transaction.customerName || '',
    customerPhone: transaction.customerPhone || '',
    customerAddress: transaction.customerAddress || '',

    // Items
    items: (transaction.items || []).map(item => ({
      name: item.name || item.serviceName || '',
      qty: Number(item.qty) || 1,
      unit: item.unit || 'pcs',
      price: Number(item.price) || 0,
      subtotal: Number(item.subtotal) || Number(item.price) || 0,
      fragrance: item.fragrance || '',
      isExpress: item.express || false,
    })),

    // Totals
    subtotal: Number(transaction.subtotal) || total,
    memberDiscount: Number(transaction.memberDiscount) || 0,
    promoDiscount: Number(transaction.promoDiscount) || 0,
    deliveryFee: Number(transaction.deliveryFee) || 0,
    total,
    balance,

    // Payment
    payMethod: transaction.payMethod || '',
    paidAmount,
    changeAmount: Number(transaction.changeAmount) || 0,

    paymentStatus: status,

    // Footer - READ FRESH FROM LOCALSTORAGE
    footerText: cfg.footerText || 'Terima kasih! Cucian >30 hari bukan tanggung jawab kami.',
    charPerLine: cfg.charPerLine || cfg.charPerLine === 0 ? cfg.charPerLine : 32,
  };
}

/**
 * Save printer config to localStorage
 */
export function savePrinterConfig(config) {
  try {
    const existing = getPrinterConfig();
    const merged = { ...existing, ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.error('Failed to save printer config:', e);
  }
}

/**
 * Get printer config (for preview, etc)
 */
export function getPrinterConfigPreview() {
  return getPrinterConfig();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default {
  isBluetoothAvailable,
  getPrinterStatus,
  connectPrinter,
  disconnectPrinter,
  getSavedPrinter,
  clearSavedPrinter,
  getPairedDevices: BTPrinter.getPairedDevices,
  printReceipt,
  printLabel,
  printTestPage,
  buildNotaData,
  getNotaDataForPrinter,
  savePrinterConfig,
  getPrinterConfig,
  getPrinterConfigPreview,
};
