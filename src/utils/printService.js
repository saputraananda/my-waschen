/**
 * Print Service - Simple Bluetooth Print
 * Works with settings from PrinterSettingsPage
 */

import BTPrinter from './bluetoothPrinter';

let printerConfig = {};

try {
  printerConfig = JSON.parse(localStorage.getItem('waschen_printer_config') || '{}');
} catch {}

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
 */
export async function connectPrinter() {
  return await BTPrinter.connect();
}

/**
 * Disconnect printer
 */
export async function disconnectPrinter() {
  await BTPrinter.disconnect();
}

/**
 * Get saved printer
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
 * Print receipt - uses printer config from settings
 */
export async function printReceipt(transaction) {
  const data = buildNotaData(transaction);
  return await BTPrinter.print(data);
}

/**
 * Test print
 */
export async function printTestPage() {
  return await BTPrinter.printTest();
}

/**
 * Build nota data from transaction + settings
 */
export function buildNotaData(transaction) {
  const cfg = printerConfig;
  const total = Number(transaction.total) || 0;
  const paidAmount = Number(transaction.paidAmount) || 0;
  const balance = Math.max(0, total - paidAmount);

  let status = 'HUTANG';
  if (paidAmount >= total) status = 'LUNAS';
  else if (paidAmount > 0) status = 'DP';

  return {
    // Outlet info from settings
    outletName: cfg.outletName || 'MY WASCHEN',
    outletTagline: cfg.outletTagline || 'Clean, Fast, Reliable',
    outletAddress: cfg.outletAddress || '',
    outletPhone: cfg.outletPhone || '',

    // Transaction
    transactionNo: transaction.transactionNo || transaction.id || '',
    transactionDate: formatDate(transaction.createdAt || transaction.date),
    cashierName: transaction.createdBy || transaction.kasirName || '',
    estimatedDone: transaction.estimatedDoneAt ? formatDate(transaction.estimatedDoneAt) : '',

    // Show flags from settings
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

    footerText: cfg.footerText || 'Terima kasih! Cucian >30 hari bukan tanggung jawab kami.',
    charPerLine: cfg.charPerLine || 32,
  };
}

/**
 * Save printer config
 */
export function savePrinterConfig(config) {
  printerConfig = { ...printerConfig, ...config };
  try {
    localStorage.setItem('waschen_printer_config', JSON.stringify(printerConfig));
  } catch {}
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
  printReceipt,
  printTestPage,
  buildNotaData,
  savePrinterConfig,
};
