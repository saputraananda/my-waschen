/**
 * Print Service - Unified print bridge
 * Auto-detects: Electron (direct) vs Browser (HTTP fallback)
 *
 * Electron: Uses IPC → serialport/bluetooth-serialport
 * Browser:  Uses HTTP → print-server.js
 */

// ─── Environment Detection ──────────────────────────────────────────────────────────
const isElectron = typeof window !== 'undefined' && window.electronPrint?.isElectron;

// ─── State ────────────────────────────────────────────────────────────────────────
let connected = false;
let printerType = null;
let printerName = null;
let lastComPort = null;

// ─── ESC/POS Receipt Builder (runs in renderer) ────────────────────────────────────
function rp(num) {
  return 'Rp ' + (Number(num) || 0).toLocaleString('id-ID');
}

function formatRupiah(num) {
  return rp(num).replace('Rp ', '');
}

function center(text, width) {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text;
}

function padRight(text, len) {
  return String(text).padEnd(len).substring(0, len);
}

function padLeft(text, len) {
  return String(text).padStart(len).substring(0, len);
}

function twoCol(left, right, width) {
  const maxLen = Math.floor(width / 2) - 1;
  return padRight(left, maxLen) + ' ' + padLeft(right, maxLen);
}

export function buildESCPOSData(receiptData) {
  const width = receiptData.charPerLine || 32;
  const chunks = [];

  // Initialize
  chunks.push(Buffer.from([0x1B, 0x40]));
  chunks.push(Buffer.from([0x1B, 0x74, 0x00])); // Code page 437

  // Header - Center, Bold, Double size
  chunks.push(Buffer.from([0x1B, 0x61, 0x01])); // Center
  chunks.push(Buffer.from([0x1B, 0x45, 0x01])); // Bold on
  chunks.push(Buffer.from([0x1B, 0x21, 0x30])); // Double size
  chunks.push(Buffer.from((receiptData.outletName || 'MY WASCHEN') + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00]));
  chunks.push(Buffer.from([0x1B, 0x21, 0x00]));

  if (receiptData.outletTagline) {
    chunks.push(Buffer.from(receiptData.outletTagline + '\n', 'utf8'));
  }
  if (receiptData.outletAddress) {
    chunks.push(Buffer.from(receiptData.outletAddress + '\n', 'utf8'));
  }
  if (receiptData.outletPhone) {
    chunks.push(Buffer.from('Telp: ' + receiptData.outletPhone + '\n', 'utf8'));
  }

  // Divider
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('─'.repeat(width) + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  // Transaction info
  chunks.push(Buffer.from([0x1B, 0x61, 0x00])); // Left
  chunks.push(Buffer.from([0x1B, 0x45, 0x01])); // Bold
  chunks.push(Buffer.from(twoCol('No. Nota:', receiptData.transactionNo || '', width) + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00]));

  if (receiptData.showDate && receiptData.transactionDate) {
    chunks.push(Buffer.from(twoCol('Tgl Masuk:', receiptData.transactionDate, width) + '\n', 'utf8'));
  }
  if (receiptData.showCashier && receiptData.cashierName) {
    chunks.push(Buffer.from(twoCol('Kasir:', receiptData.cashierName, width) + '\n', 'utf8'));
  }
  if (receiptData.showEstDone && receiptData.estimatedDone) {
    chunks.push(Buffer.from(twoCol('Est. Selesai:', receiptData.estimatedDone, width) + '\n', 'utf8'));
  }

  // Customer info
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('─'.repeat(width) + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  if (receiptData.showCustomer && receiptData.customerName) {
    chunks.push(Buffer.from([0x1B, 0x45, 0x01]));
    chunks.push(Buffer.from(center(receiptData.customerName, width) + '\n', 'utf8'));
    chunks.push(Buffer.from([0x1B, 0x45, 0x00]));
  }
  if (receiptData.showPhone && receiptData.customerPhone) {
    chunks.push(Buffer.from(twoCol('HP:', receiptData.customerPhone, width) + '\n', 'utf8'));
  }

  // Items
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('─'.repeat(width) + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  chunks.push(Buffer.from([0x1B, 0x45, 0x01]));
  chunks.push(Buffer.from(center('LAYANAN', width) + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00]));

  if (receiptData.items && Array.isArray(receiptData.items)) {
    for (const item of receiptData.items) {
      const name = item.name || item.serviceName || '';
      chunks.push(Buffer.from(padRight(name + (item.isExpress ? ' [EXPRESS]' : ''), width) + '\n', 'utf8'));
      if (item.fragrance && receiptData.showFragrance) {
        chunks.push(Buffer.from(padRight('  Parfum: ' + item.fragrance, width) + '\n', 'utf8'));
      }
      const priceLine = padRight('  ' + item.qty + ' ' + item.unit + ' x ' + formatRupiah(item.price), Math.floor(width / 2) - 1) +
        padLeft(formatRupiah(item.subtotal), Math.floor(width / 2) - 1);
      chunks.push(Buffer.from(priceLine + '\n', 'utf8'));
    }
  }

  // Totals
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('─'.repeat(width) + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  if (receiptData.subtotal) {
    chunks.push(Buffer.from(twoCol('Subtotal:', formatRupiah(receiptData.subtotal), width) + '\n', 'utf8'));
  }
  if (receiptData.memberDiscount > 0) {
    chunks.push(Buffer.from(twoCol('Diskon:', '-' + formatRupiah(receiptData.memberDiscount), width) + '\n', 'utf8'));
  }
  if (receiptData.promoDiscount > 0) {
    chunks.push(Buffer.from(twoCol('Promo:', '-' + formatRupiah(receiptData.promoDiscount), width) + '\n', 'utf8'));
  }
  if (receiptData.deliveryFee > 0) {
    chunks.push(Buffer.from(twoCol('Ongkir:', formatRupiah(receiptData.deliveryFee), width) + '\n', 'utf8'));
  }

  // Total - Double height
  chunks.push(Buffer.from([0x1B, 0x45, 0x01]));
  chunks.push(Buffer.from([0x1B, 0x21, 0x10])); // Double height
  chunks.push(Buffer.from(twoCol('TOTAL:', formatRupiah(receiptData.total || 0), width) + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x21, 0x00]));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00]));

  // Payment info
  if (receiptData.showPayment && receiptData.payMethod) {
    chunks.push(Buffer.from(twoCol('Bayar (' + receiptData.payMethod + '):', formatRupiah(receiptData.paidAmount || 0), width) + '\n', 'utf8'));
  }
  if (receiptData.changeAmount > 0) {
    chunks.push(Buffer.from(twoCol('Kembalian:', formatRupiah(receiptData.changeAmount), width) + '\n', 'utf8'));
  }
  if (receiptData.balance > 0) {
    chunks.push(Buffer.from(twoCol('Sisa:', formatRupiah(receiptData.balance), width) + '\n', 'utf8'));
  }

  // Footer
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('─'.repeat(width) + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  if (receiptData.footerText) {
    chunks.push(Buffer.from([0x1B, 0x61, 0x01])); // Center
    chunks.push(Buffer.from((receiptData.footerText) + '\n', 'utf8'));
  }

  // Feed and cut
  chunks.push(Buffer.from([0x1B, 0x64, 0x04])); // Feed 4 lines
  chunks.push(Buffer.from([0x1D, 0x56, 0x00])); // Cut

  return Buffer.concat(chunks);
}

// ─── Print Bridge - Auto-detect Electron vs Browser ────────────────────────────────

// Browser: HTTP to print-server.js
const PRINT_SERVER_URL = process.env.PRINT_SERVER_URL || 'http://localhost:3456';

async function apiBrowser(endpoint, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${PRINT_SERVER_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Koneksi timeout. Pastikan print server berjalan.');
    throw err;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────────

export async function checkServerStatus() {
  if (isElectron) {
    return { connected: true, type: 'electron', note: 'Electron mode - printer auto-detected' };
  }
  try {
    const status = await apiBrowser('/status');
    connected = status.connected;
    printerType = status.type;
    return status;
  } catch (err) {
    connected = false;
    return { connected: false, error: err.message };
  }
}

export async function getAvailablePrinters() {
  if (isElectron) {
    const [btPorts, winPrinters] = await Promise.all([
      window.electronPrint.getBluetoothPorts(),
      window.electronPrint.getWindowsPrinters(),
    ]);
    return {
      usb: [], // SerialPort detection is separate
      bluetooth: btPorts,
      windows: winPrinters,
    };
  }
  return apiBrowser('/printers');
}

export async function connectPrinter(type, config = {}) {
  if (isElectron) {
    // Store connection info for later print
    connected = true;
    printerType = type;
    lastComPort = config.comPort || null;
    printerName = config.printerName || config.comPort || type;

    if (type === 'windows') {
      return { success: true, type: 'windows', name: config.printerName };
    }
    if (type === 'bluetooth' || type === 'usb') {
      return { success: true, type, name: config.comPort };
    }
    return { success: true, type, name: config.ip };
  }

  let body = { type };
  switch (type) {
    case 'usb': body.deviceId = config.deviceId; break;
    case 'lan': body.ip = config.ip; body.port = config.port || 9100; break;
    case 'bluetooth': body.comPort = config.comPort; break;
    case 'windows': body.printerName = config.printerName; break;
  }
  const result = await apiBrowser('/connect', { method: 'POST', body: JSON.stringify(body) });
  if (result.success) { connected = true; printerType = type; printerName = result.name; }
  return result;
}

export async function disconnectPrinter() {
  connected = false;
  printerType = null;
  printerName = null;
  lastComPort = null;
}

export async function printReceipt(receiptData) {
  const escData = buildESCPOSData(receiptData);

  if (isElectron) {
    if (printerType === 'windows') {
      return await window.electronPrint.printWindows(printerName, Array.from(escData));
    }
    if (printerType === 'bluetooth' || printerType === 'usb') {
      return await window.electronPrint.printSerial(lastComPort, Array.from(escData));
    }
    throw new Error('Printer belum terhubung');
  }

  // Browser mode: send to print-server.js
  if (!connected) throw new Error('Printer belum terhubung');
  return apiBrowser('/print', { method: 'POST', body: JSON.stringify(receiptData) });
}

export async function printTestPage(printerNameOverride) {
  const testData = buildESCPOSData({
    outletName: 'MY WASCHEN',
    outletTagline: 'Clean, Fast, Reliable',
    outletAddress: 'Jl. Kemang Raya No. 45',
    outletPhone: '021-1234-5678',
    transactionNo: 'TEST-' + Date.now(),
    showDate: true,
    transactionDate: new Date().toLocaleString('id-ID'),
    showCashier: true,
    cashierName: 'Test Kasir',
    showCustomer: true,
    customerName: 'Budi Santoso',
    showPhone: true,
    customerPhone: '0812-3456-7890',
    showEstDone: true,
    estimatedDone: new Date(Date.now() + 86400000).toLocaleString('id-ID'),
    items: [
      { name: 'Cuci Setrika Express', qty: 2, unit: 'kg', price: 7000, subtotal: 14000, fragrance: 'Lavender', isExpress: true },
      { name: 'Dry Cleaning Jas', qty: 1, unit: 'pcs', price: 45000, subtotal: 45000 },
    ],
    showFragrance: true,
    subtotal: 59000,
    memberDiscount: 0,
    promoDiscount: 0,
    deliveryFee: 0,
    total: 59000,
    showPayment: true,
    payMethod: 'Tunai',
    paidAmount: 60000,
    changeAmount: 1000,
    charPerLine: 32,
    footerText: 'Terima kasih! Cucian >30 hari bukan tanggung jawab kami.',
  });

  if (isElectron) {
    const target = printerNameOverride || printerName;
    if (printerType === 'windows') {
      return await window.electronPrint.printWindows(target, Array.from(testData));
    }
    if (printerType === 'bluetooth' || printerType === 'usb') {
      return await window.electronPrint.printSerial(lastComPort, Array.from(testData));
    }
    throw new Error('Printer belum terhubung');
  }

  if (!connected) throw new Error('Printer belum terhubung');
  return apiBrowser('/print-test', { method: 'POST', body: JSON.stringify({ printerName: printerNameOverride }) });
}

export async function openPrintDialog() {
  if (isElectron) {
    return await window.electronPrint.openPrintDialog();
  }
  // Browser: use window.print()
  window.print();
  return { success: true };
}

// ─── Receipt Builder (legacy) ──────────────────────────────────────────────────────
export function buildReceiptFromTransaction(transaction, config = {}) {
  const total = Number(transaction.total) || 0;
  const paidAmount = Number(transaction.paidAmount) || 0;
  const balance = Math.max(0, total - paidAmount);

  let statusLabel = 'HUTANG';
  if (!paidAmount || paidAmount <= 0) statusLabel = 'HUTANG';
  else if (paidAmount >= total) statusLabel = 'LUNAS';
  else statusLabel = 'DP';

  return {
    outletName: config.outletName || 'MY WASCHEN',
    outletTagline: config.outletTagline || '',
    outletAddress: config.outletAddress || '',
    outletPhone: config.outletPhone || '',
    transactionNo: transaction.transactionNo || transaction.id,
    transactionDate: new Date(transaction.createdAt || transaction.date).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    cashierName: transaction.createdBy || transaction.kasirName || '',
    estimatedDone: transaction.estimatedDoneAt
      ? new Date(transaction.estimatedDoneAt).toLocaleString('id-ID', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })
      : '',
    showDate: config.showTransactionDate !== false,
    showCashier: config.showCashierName !== false,
    showCustomer: config.showCustomerName !== false,
    showPhone: config.showCustomerPhone !== false,
    showEstDone: config.showEstimatedDone !== false,
    showFragrance: config.showFragrance !== false,
    customerName: transaction.customerName || '',
    customerPhone: transaction.customerPhone || '',
    customerAddress: transaction.customerAddress || '',
    items: (transaction.items || []).map(item => ({
      name: item.name || item.serviceName || '',
      qty: item.qty || 1,
      unit: item.unit || 'pcs',
      price: Number(item.price) || 0,
      subtotal: Number(item.subtotal) || Number(item.price) || 0,
      fragrance: item.fragrance || '',
      isExpress: item.express || item.isExpress || false,
    })),
    subtotal: Number(transaction.subtotal) || total,
    memberDiscount: Number(transaction.memberDiscount) || 0,
    promoDiscount: Number(transaction.promoDiscount) || 0,
    deliveryFee: Number(transaction.deliveryFee) || 0,
    total,
    balance,
    showPayment: config.showPaymentMethod !== false,
    payMethod: transaction.payMethod || '',
    paidAmount,
    changeAmount: Number(transaction.changeAmount) || 0,
    paymentStatus: statusLabel,
    charPerLine: config.charPerLine || 32,
    footerText: config.footerText || 'Terima kasih! Cucian >30 hari bukan tanggung jawab kami.',
    printerType: config.printerType || 'thermal_58',
    copies: config.copies || 1,
    printerName: printerName,
  };
}

export function getPrinterState() {
  return { connected, printerType, printerName };
}

export default {
  checkServerStatus,
  getAvailablePrinters,
  connectPrinter,
  disconnectPrinter,
  printReceipt,
  printTestPage,
  buildReceiptFromTransaction,
  buildESCPOSData,
  openPrintDialog,
  getPrinterState,
};
