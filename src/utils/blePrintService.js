/**
 * Web Bluetooth Print Service
 * Direct BLE connection to thermal printers - no COM port needed!
 * Works in Electron (Chromium) with Web Bluetooth API enabled
 *
 * Common BLE Thermal Printer UUIDs:
 * - Service: 0xFFE0 (RPP02N, RPrinter, Xprinter BLE series)
 * - Write Characteristic: 0xFFE1
 */

// ─── Check availability ─────────────────────────────────────────────────────────
export function isWebBluetoothAvailable() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

// ─── UUIDs for common BLE thermal printers ─────────────────────────────────────
const THERMAL_PRINTER_SERVICE = 0xffe0;
const THERMAL_PRINTER_WRITE = 0xffe1;

// ─── State ─────────────────────────────────────────────────────────────────────
let connectedDevice = null;
let connectedServer = null;
let writeCharacteristic = null;

// ─── Scan & Connect ───────────────────────────────────────────────────────────

/**
 * Request a BLE printer device (shows native Bluetooth picker)
 * Returns device info: { id, name, rssi }
 */
export async function requestBluetoothDevice() {
  if (!isWebBluetoothAvailable()) {
    throw new Error('Web Bluetooth tidak tersedia di browser ini');
  }

  try {
    console.log('[BLE] Requesting device...');
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        // Common thermal printer name patterns
        { namePrefix: 'RPrinter' },
        { namePrefix: 'RPP' },
        { namePrefix: 'Xprinter' },
        { namePrefix: 'ZJ' },
        { namePrefix: 'POS' },
        { namePrefix: 'Printer' },
      ],
      optionalServices: [
        '0000ffe0-0000-1000-8000-00805f9b34fb', // Standard BLE Serial (SPP-like)
        THERMAL_PRINTER_SERVICE,
      ],
    });

    console.log('[BLE] Device selected:', device.name, device.id);

    return {
      id: device.id,
      name: device.name || 'Unknown Device',
    };
  } catch (err) {
    if (err.name === 'NotFoundError') {
      throw new Error('Tidak ada perangkat Bluetooth yang dipilih');
    }
    throw new Error('Gagal memilih perangkat Bluetooth: ' + err.message);
  }
}

/**
 * Connect to a BLE device and get the write characteristic
 */
export async function connectToPrinter(deviceInfo) {
  if (!isWebBluetoothAvailable()) {
    throw new Error('Web Bluetooth tidak tersedia');
  }

  try {
    console.log('[BLE] Connecting to:', deviceInfo.name);

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: '' }],
      optionalServices: [
        '0000ffe0-0000-1000-8000-00805f9b34fb',
        THERMAL_PRINTER_SERVICE,
      ],
    });

    // Override device if ID matches (reconnect scenario)
    const activeDevice = device;

    // Add disconnect listener
    activeDevice.addEventListener('gattserverdisconnected', () => {
      console.log('[BLE] Device disconnected');
      connectedDevice = null;
      connectedServer = null;
      writeCharacteristic = null;
    });

    console.log('[BLE] Connecting to GATT server...');
    const server = await activeDevice.gatt.connect();
    connectedServer = server;
    connectedDevice = activeDevice;

    console.log('[BLE] Getting primary service...');
    let service;
    try {
      service = await server.getPrimaryService(THERMAL_PRINTER_SERVICE);
    } catch {
      // Try the string UUID version
      service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
    }

    console.log('[BLE] Getting write characteristic...');
    try {
      writeCharacteristic = await service.getCharacteristic(THERMAL_PRINTER_WRITE);
    } catch {
      writeCharacteristic = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');
    }

    console.log('[BLE] Connected successfully!');

    return {
      success: true,
      name: activeDevice.name,
      id: activeDevice.id,
    };
  } catch (err) {
    console.error('[BLE] Connection error:', err);
    throw new Error('Gagal terhubung ke printer: ' + err.message);
  }
}

/**
 * Disconnect from current device
 */
export async function disconnectFromPrinter() {
  if (connectedDevice && connectedDevice.gatt.connected) {
    connectedDevice.gatt.disconnect();
  }
  connectedDevice = null;
  connectedServer = null;
  writeCharacteristic = null;
  return { success: true };
}

/**
 * Write data to connected printer
 */
async function writeToPrinter(data) {
  if (!writeCharacteristic) {
    throw new Error('Printer belum terhubung. Jalankan connectToPrinter dulu.');
  }

  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  // Convert to Uint8Array for Web Bluetooth API
  const uint8 = new Uint8Array(buffer);
  await writeCharacteristic.writeValue(uint8);
  console.log('[BLE] Written', uint8.byteLength, 'bytes to printer');
}

// ─── Print Receipt via BLE ─────────────────────────────────────────────────────

/**
 * Build ESC/POS bytes for receipt (browser-compatible, no Buffer)
 */
function buildReceiptBytes(notaData) {
  const w = notaData.charPerLine || 32;
  const chunks = [];

  function rp(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); }
  function fmt(n) { return (Number(n) || 0).toLocaleString('id-ID'); }
  function padR(t, len) { return String(t).padEnd(len).substring(0, len); }
  function padL(t, len) { return String(t).padStart(len).substring(0, len); }
  function two(l, r) {
    const half = Math.floor(w / 2) - 1;
    return padR(l, half) + ' ' + padL(r, half);
  }

  function concat(...bufs) {
    const total = bufs.reduce((s, b) => s + b.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const b of bufs) {
      out.set(new Uint8Array(b), offset);
      offset += b.byteLength;
    }
    return out;
  }

  function bytes(arr) { return new Uint8Array(arr); }
  function text(str) { return new TextEncoder().encode(str); }

  // Init printer
  chunks.push(bytes([0x1B, 0x40]));

  // Header - centered, bold, double height
  chunks.push(bytes([0x1B, 0x61, 0x01])); // center
  chunks.push(bytes([0x1B, 0x45, 0x01])); // bold on
  chunks.push(bytes([0x1B, 0x21, 0x10])); // double height
  chunks.push(text((notaData.outletName || 'MY WASCHEN') + '\n'));
  chunks.push(bytes([0x1B, 0x21, 0x00]));
  chunks.push(bytes([0x1B, 0x45, 0x00]));

  if (notaData.outletTagline) chunks.push(text(notaData.outletTagline + '\n'));
  if (notaData.outletAddress) chunks.push(text(notaData.outletAddress + '\n'));
  if (notaData.outletPhone) chunks.push(text('Telp: ' + notaData.outletPhone + '\n'));

  // Divider
  chunks.push(bytes([0x1B, 0x2D, 0x01]));
  chunks.push(text('-'.repeat(w) + '\n'));
  chunks.push(bytes([0x1B, 0x2D, 0x00]));

  // Transaction info
  chunks.push(bytes([0x1B, 0x61, 0x00])); // left align
  chunks.push(bytes([0x1B, 0x45, 0x01]));
  chunks.push(text(two('No. Nota:', notaData.transactionNo || '-') + '\n'));
  chunks.push(bytes([0x1B, 0x45, 0x00]));

  if (notaData.showDate !== false && notaData.transactionDate)
    chunks.push(text(two('Tgl:', notaData.transactionDate) + '\n'));
  if (notaData.showCashier !== false && notaData.cashierName)
    chunks.push(text(two('Kasir:', notaData.cashierName) + '\n'));

  // Customer
  chunks.push(bytes([0x1B, 0x2D, 0x01]));
  chunks.push(text('-'.repeat(w) + '\n'));
  chunks.push(bytes([0x1B, 0x2D, 0x00]));

  if (notaData.showCustomer !== false && notaData.customerName) {
    chunks.push(bytes([0x1B, 0x45, 0x01]));
    chunks.push(text(padR(notaData.customerName, w) + '\n'));
    chunks.push(bytes([0x1B, 0x45, 0x00]));
  }
  if (notaData.showPhone !== false && notaData.customerPhone)
    chunks.push(text(two('HP:', notaData.customerPhone) + '\n'));

  // Items
  chunks.push(bytes([0x1B, 0x2D, 0x01]));
  chunks.push(text('-'.repeat(w) + '\n'));
  chunks.push(bytes([0x1B, 0x2D, 0x00]));

  chunks.push(bytes([0x1B, 0x45, 0x01]));
  chunks.push(text(padR('LAYANAN', w) + '\n'));
  chunks.push(bytes([0x1B, 0x45, 0x00]));

  if (notaData.items && Array.isArray(notaData.items)) {
    for (const item of notaData.items) {
      const name = (item.name || item.serviceName || '').substring(0, w);
      chunks.push(text(padR(name + (item.isExpress ? ' *' : ''), w) + '\n'));
      if (item.fragrance && notaData.showFragrance !== false)
        chunks.push(text(padR('  Par: ' + item.fragrance, w) + '\n'));
      const priceLine = padR('  ' + item.qty + 'x' + fmt(item.price), Math.floor(w/2)-1) + padL(fmt(item.subtotal || item.price), Math.floor(w/2)-1);
      chunks.push(text(priceLine + '\n'));
    }
  }

  // Totals
  chunks.push(bytes([0x1B, 0x2D, 0x01]));
  chunks.push(text('-'.repeat(w) + '\n'));
  chunks.push(bytes([0x1B, 0x2D, 0x00]));

  if (notaData.subtotal)
    chunks.push(text(two('Subtotal:', rp(notaData.subtotal)) + '\n'));
  if (notaData.memberDiscount > 0)
    chunks.push(text(two('Diskon:', '-' + rp(notaData.memberDiscount)) + '\n'));
  if (notaData.deliveryFee > 0)
    chunks.push(text(two('Ongkir:', rp(notaData.deliveryFee)) + '\n'));

  // TOTAL - bold, double
  chunks.push(bytes([0x1B, 0x45, 0x01]));
  chunks.push(bytes([0x1B, 0x21, 0x10]));
  chunks.push(text(two('TOTAL:', rp(notaData.total || 0)) + '\n'));
  chunks.push(bytes([0x1B, 0x21, 0x00]));
  chunks.push(bytes([0x1B, 0x45, 0x00]));

  // Payment
  if (notaData.payMethod) {
    chunks.push(text(two('Bayar(' + notaData.payMethod + '):', rp(notaData.paidAmount || 0)) + '\n'));
  }
  if (notaData.changeAmount > 0)
    chunks.push(text(two('Kembalian:', rp(notaData.changeAmount)) + '\n'));
  if (notaData.balance > 0) {
    chunks.push(bytes([0x1B, 0x45, 0x01]));
    chunks.push(text(two('SISA:', rp(notaData.balance)) + '\n'));
    chunks.push(bytes([0x1B, 0x45, 0x00]));
  }

  // Status badge
  if (notaData.paymentStatus) {
    chunks.push(bytes([0x1B, 0x61, 0x01]));
    chunks.push(text('[' + notaData.paymentStatus + ']\n'));
  }

  // Footer
  chunks.push(bytes([0x1B, 0x2D, 0x01]));
  chunks.push(text('-'.repeat(w) + '\n'));
  chunks.push(bytes([0x1B, 0x2D, 0x00]));
  chunks.push(bytes([0x1B, 0x61, 0x01]));
  if (notaData.footerText) {
    const lines = notaData.footerText.split('\n');
    for (const line of lines) {
      chunks.push(text(line.substring(0, w) + '\n'));
    }
  }

  // Feed & Cut
  chunks.push(bytes([0x1B, 0x64, 0x05]));
  chunks.push(bytes([0x1D, 0x56, 0x00]));

  return concat(...chunks);
}

/**
 * Print receipt via BLE - the main function
 */
export async function printReceiptViaBLE(notaData) {
  const bytes = buildReceiptBytes(notaData);
  await writeToPrinter(bytes);
  console.log('[BLE] Receipt printed!');
  return { success: true, method: 'ble', bytes: bytes.length };
}

/**
 * Test print via BLE
 */
export async function testPrintViaBLE() {
  const now = new Date();
  const testData = {
    outletName: 'MY WASCHEN',
    outletTagline: 'Clean, Fast, Reliable',
    outletAddress: 'Jl. Kemang Raya No.45',
    outletPhone: '021-1234-5678',
    transactionNo: 'TEST-' + Date.now().toString(36).toUpperCase(),
    transactionDate: now.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    cashierName: 'Admin Kasir',
    customerName: 'Budi Santoso',
    customerPhone: '0812-3456-7890',
    items: [
      { name: 'Cuci Setrika', qty: 2, price: 7000, subtotal: 14000, fragrance: 'Lavender' },
      { name: 'Dry Clean Jas', qty: 1, price: 45000, subtotal: 45000 },
    ],
    subtotal: 59000,
    total: 59000,
    payMethod: 'Tunai',
    paidAmount: 60000,
    changeAmount: 1000,
    balance: 0,
    paymentStatus: 'LUNAS',
    footerText: 'Terima kasih!\n>30 hari bukan tanggung jawab kami',
    charPerLine: 32,
  };

  return await printReceiptViaBLE(testData);
}

/**
 * Check if currently connected to a printer
 */
export function isPrinterConnected() {
  return connectedDevice !== null && connectedDevice.gatt.connected;
}

/**
 * Get connected device info
 */
export function getConnectedDevice() {
  if (!isPrinterConnected()) return null;
  return {
    name: connectedDevice.name,
    id: connectedDevice.id,
  };
}

export default {
  isWebBluetoothAvailable,
  requestBluetoothDevice,
  connectToPrinter,
  disconnectFromPrinter,
  printReceiptViaBLE,
  testPrintViaBLE,
  isPrinterConnected,
  getConnectedDevice,
};
