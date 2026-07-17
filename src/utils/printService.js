/**
 * Print Service - Auto-detect Bluetooth Thermal Printer
 * No setup needed - just plug and print!
 */

// ─── Detection ──────────────────────────────────────────────────────────────────
const isElectron = typeof window !== 'undefined' && window.electronPrint?.isElectron;

// ─── State ─────────────────────────────────────────────────────────────────────
let savedComPort = '';
let savedBaudRate = 9600;
let printerConnected = false;
let printerConfig = {};

try {
  savedComPort = localStorage.getItem('waschen_com_port') || '';
  savedBaudRate = parseInt(localStorage.getItem('waschen_baud_rate') || '9600');
  printerConfig = JSON.parse(localStorage.getItem('waschen_printer_config') || '{}');
} catch {}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Auto-detect and connect to printer
 */
export async function autoConnect() {
  if (isElectron) {
    try {
      const ports = await window.electronPrint.getPorts();
      if (ports && ports.length > 0) {
        savedComPort = ports[0].comPort;
        localStorage.setItem('waschen_com_port', savedComPort);
        printerConnected = true;
        return { success: true, comPort: savedComPort, auto: true };
      }
    } catch {}
    return { success: false, error: 'Tidak ada port tersedia' };
  }

  // Browser mode - use HTTP
  try {
    const res = await fetch('http://localhost:3456/scan');
    const data = await res.json();
    if (data.ports && data.ports.length > 0) {
      const port = data.ports[0].path;
      const connectRes = await fetch('http://localhost:3456/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comPort: port }),
      });
      const result = await connectRes.json();
      if (result.success) {
        savedComPort = port;
        savedBaudRate = result.baudRate || 9600;
        localStorage.setItem('waschen_com_port', savedComPort);
        localStorage.setItem('waschen_baud_rate', String(savedBaudRate));
        printerConnected = true;
        return { success: true, comPort: port, baudRate: savedBaudRate, auto: true };
      }
    }
    return { success: false, error: 'Printer tidak ditemukan' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Check printer status
 */
export async function checkServerStatus() {
  if (isElectron) {
    return { connected: !!savedComPort, type: 'electron', comPort: savedComPort };
  }
  try {
    const res = await fetch('http://localhost:3456/status');
    const data = await res.json();
    printerConnected = data.connected;
    return { connected: data.connected, type: 'http', comPort: data.comPort };
  } catch {
    return { connected: false, error: 'Server tidak berjalan' };
  }
}

/**
 * Get available COM ports
 */
export async function getAvailablePrinters() {
  if (isElectron) {
    try {
      const ports = await window.electronPrint.getPorts();
      return { bluetooth: ports, usb: ports, windows: [] };
    } catch {
      return { bluetooth: [], usb: [], windows: [] };
    }
  }
  try {
    const res = await fetch('http://localhost:3456/scan');
    const data = await res.json();
    return {
      bluetooth: data.ports || [],
      usb: data.ports || [],
      windows: [],
    };
  } catch {
    return { bluetooth: [], usb: [], windows: [] };
  }
}

/**
 * Connect to specific printer
 */
export async function connectPrinter(type, config = {}) {
  if (!config.comPort) {
    throw new Error('COM port diperlukan');
  }

  savedComPort = config.comPort;
  savedBaudRate = config.baudRate || 9600;

  try {
    localStorage.setItem('waschen_com_port', savedComPort);
    localStorage.setItem('waschen_baud_rate', String(savedBaudRate));
  } catch {}

  if (isElectron) {
    printerConnected = true;
    return { success: true, name: savedComPort };
  }

  // Browser mode
  try {
    const res = await fetch('http://localhost:3456/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comPort: savedComPort, baudRate: savedBaudRate }),
    });
    const data = await res.json();
    if (data.success) {
      printerConnected = true;
      return { success: true, name: savedComPort };
    }
    throw new Error(data.error || 'Connection failed');
  } catch (err) {
    throw err;
  }
}

/**
 * Disconnect printer
 */
export async function disconnectPrinter() {
  savedComPort = '';
  printerConnected = false;
  try {
    localStorage.removeItem('waschen_com_port');
    localStorage.removeItem('waschen_baud_rate');
  } catch {}

  if (isElectron) return { success: true };

  try {
    await fetch('http://localhost:3456/disconnect', { method: 'POST' });
  } catch {}
  return { success: true };
}

/**
 * Print nota - THE MAIN FUNCTION
 */
export async function printReceipt(notaData) {
  if (!savedComPort) {
    throw new Error('Printer belum disetting. Buka Pengaturan Printer.');
  }

  const receipt = buildNotaData(notaData);

  if (isElectron) {
    const result = await window.electronPrint.printNota(savedComPort, receipt);
    if (!result.success) throw new Error(result.error || 'Print gagal');
    return result;
  }

  // Browser HTTP mode
  try {
    const res = await fetch('http://localhost:3456/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notaData),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Print gagal');
    return data;
  } catch (err) {
    throw new Error('Print server tidak terhubung. Jalankan: node print-backend.cjs server');
  }
}

/**
 * Test print - sends config to backend for custom test receipt
 */
export async function printTestPage() {
  if (!savedComPort) {
    throw new Error('Printer belum disetting');
  }

  // Build test receipt data from saved config
  const testNotaData = buildTestNotaData(printerConfig);

  if (isElectron) {
    const result = await window.electronPrint.printNota(savedComPort, testNotaData);
    if (!result.success) throw new Error(result.error || 'Test print gagal');
    return result;
  }

  // Browser HTTP mode - send nota data to backend
  try {
    const res = await fetch('http://localhost:3456/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testNotaData),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Print gagal');
    return data;
  } catch (err) {
    throw new Error('Print server tidak terhubung. Jalankan: node print-backend.cjs');
  }
}

/**
 * Build test nota data from config (for test print)
 */
function buildTestNotaData(cfg) {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);

  return {
    outletName: cfg.outletName || 'MY WASCHEN',
    outletTagline: cfg.outletTagline || 'Clean, Fast, Reliable',
    outletAddress: cfg.outletAddress || '',
    outletPhone: cfg.outletPhone || '',

    transactionNo: 'TEST-' + Date.now().toString(36).toUpperCase(),
    transactionDate: now.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    cashierName: 'Admin Kasir',
    estimatedDone: tomorrow.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),

    showDate: cfg.showTransactionDate !== false,
    showCashier: cfg.showCashierName !== false,
    showCustomer: cfg.showCustomerName !== false,
    showPhone: cfg.showCustomerPhone !== false,
    showAddress: cfg.showCustomerAddress || false,
    showEstDone: cfg.showEstimatedDone !== false,
    showFragrance: cfg.showFragrance !== false,

    customerName: 'Budi Santoso',
    customerPhone: '0812-3456-7890',
    customerAddress: 'Jl. Mawar No.5',

    items: [
      { name: 'Cuci Setrika', qty: 2, unit: 'kg', price: 7000, subtotal: 14000, fragrance: 'Lavender', isExpress: true },
      { name: 'Dry Clean Jas', qty: 1, unit: 'pcs', price: 45000, subtotal: 45000 },
    ],

    subtotal: 59000,
    memberDiscount: 0,
    promoDiscount: 0,
    deliveryFee: 0,
    total: 59000,
    balance: 0,

    payMethod: 'Tunai',
    paidAmount: 60000,
    changeAmount: 1000,

    paymentStatus: 'LUNAS',
    footerText: cfg.footerText || 'Terima kasih! Cucian >30 hari bukan tanggung jawab kami.',
    charPerLine: cfg.charPerLine || 32,
  };
}

/**
 * Build nota data from transaction
 */
export function buildNotaData(transactionOrData) {
  // Support both transaction object or pre-built nota data
  if (transactionOrData.items || transactionOrData.transactionNo) {
    return buildFromTransaction(transactionOrData);
  }
  return transactionOrData;
}

function buildFromTransaction(transaction) {
  const cfg = printerConfig;
  const total = Number(transaction.total) || 0;
  const paidAmount = Number(transaction.paidAmount) || 0;
  const balance = Math.max(0, total - paidAmount);

  let status = 'HUTANG';
  if (paidAmount >= total) status = 'LUNAS';
  else if (paidAmount > 0) status = 'DP';

  return {
    // Outlet - 58mm thermal default
    outletName: cfg.outletName || 'MY WASCHEN',
    outletTagline: cfg.outletTagline || 'Clean, Fast, Reliable',
    outletAddress: cfg.outletAddress || '',
    outletPhone: cfg.outletPhone || '',

    // Transaction
    transactionNo: transaction.transactionNo || transaction.id || '',
    transactionDate: formatDate(transaction.createdAt || transaction.date),
    cashierName: transaction.createdBy || transaction.kasirName || '',
    estimatedDone: transaction.estimatedDoneAt ? formatDate(transaction.estimatedDoneAt) : '',

    // Show flags
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

    // Status
    paymentStatus: status,

    // Config - 58mm default
    footerText: cfg.footerText || 'Terima kasih! Cucian >30 hari bukan tanggung jawab kami.',
    charPerLine: 32, // 58mm = 32 chars
  };
}

/**
 * Get saved COM port
 */
export function getSavedComPort() {
  return savedComPort;
}

/**
 * Get printer state
 */
export function getPrinterState() {
  return {
    connected: !!savedComPort,
    comPort: savedComPort,
    baudRate: savedBaudRate,
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

// ─── Helpers ───────────────────────────────────────────────────────────────────
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
  autoConnect,
  checkServerStatus,
  getAvailablePrinters,
  connectPrinter,
  disconnectPrinter,
  printReceipt,
  printTestPage,
  buildNotaData,
  getSavedComPort,
  getPrinterState,
  savePrinterConfig,
};
