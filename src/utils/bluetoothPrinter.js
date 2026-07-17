/**
 * Bluetooth Printer Service - Simple Direct Print
 * No empty filters - just show available devices
 */

const BLUETOOTH_UUIDS = {
  SPP: '00001101-0000-1000-8000-00805f9b34fb',
};

const STORAGE_KEY = 'waschen_bt_printer';

let device = null;
let server = null;
let characteristic = null;
let isConnected = false;

export function isBluetoothSupported() {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export function isAndroid() {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

export function isWebBluetoothAvailable() {
  return isBluetoothSupported() && (isAndroid() || /chrome|edge/i.test(navigator.userAgent));
}

// ─── Device Storage ─────────────────────────────────────────────────────────

function saveDevice(btDevice) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      id: btDevice.id,
      name: btDevice.name || 'Bluetooth Printer',
      address: btDevice.address,
      savedAt: Date.now(),
    }));
  } catch (e) {}
}

export function getSavedDevice() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

export function clearSavedDevice() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

// ─── Connection ────────────────────────────────────────────────────────────

/**
 * Connect to printer - SIMPLE version
 * Shows device picker, saves selection
 */
export async function connect() {
  if (!isWebBluetoothAvailable()) {
    throw new Error('Bluetooth tidak tersedia. Gunakan Chrome.');
  }

  if (isConnected && device) {
    return { success: true, name: device.name, alreadyConnected: true };
  }

  try {
    // Simple: just request any device, user picks
    const btDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [BLUETOOTH_UUIDS.SPP],
    });

    if (!btDevice) {
      throw new Error('Printer tidak dipilih');
    }

    console.log('[BT] Selected:', btDevice.name, btDevice.id);

    // Connect to GATT
    if (btDevice.gatt && btDevice.gatt.connected) {
      btDevice.gatt.disconnect();
    }

    const gattServer = await btDevice.gatt.connect();
    server = gattServer;
    device = btDevice;
    isConnected = true;

    // Try to find characteristic
    try {
      const service = await gattServer.getPrimaryService(BLUETOOTH_UUIDS.SPP);
      characteristic = await service.getCharacteristic(BLUETOOTH_UUIDS.SPP);
    } catch (e) {
      console.log('[BT] SPP not found, trying without characteristic');
      characteristic = null;
    }

    // Save for next time
    saveDevice(btDevice);

    return { success: true, name: btDevice.name, address: btDevice.address };

  } catch (e) {
    if (e.name === 'NotFoundError') {
      throw new Error('Tidak ada printer dipilih');
    }
    throw new Error(e.message);
  }
}

/**
 * Disconnect
 */
export async function disconnect() {
  if (device?.gatt?.connected) {
    device.gatt.disconnect();
  }
  device = null;
  server = null;
  characteristic = null;
  isConnected = false;
}

/**
 * Get status
 */
export function getStatus() {
  return {
    connected: isConnected,
    deviceName: device?.name || null,
    savedDevice: getSavedDevice(),
  };
}

// ─── Printing ──────────────────────────────────────────────────────────────

/**
 * Build ESC/POS receipt
 */
export function buildReceipt(data) {
  const w = data.charPerLine || 32;
  const chunks = [];

  const rp = (n) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
  const fmt = (n) => (Number(n) || 0).toLocaleString('id-ID');
  const center = (t) => {
    const spaces = Math.max(0, Math.floor((w - t.length) / 2));
    return ' '.repeat(spaces) + t;
  };
  const padR = (t, len) => String(t).padEnd(len).substring(0, len);
  const padL = (t, len) => String(t).padStart(len).substring(0, len);
  const two = (l, r) => {
    const half = Math.floor(w / 2) - 1;
    return padR(l, half) + ' ' + padL(r, half);
  };

  const ESC = 0x1B;
  const GS = 0x1D;
  const LF = 0x0A;

  // Init
  chunks.push(ESC, 0x40);

  // Header
  chunks.push(ESC, 0x61, 0x01); // Center
  chunks.push(ESC, 0x45, 0x01); // Bold on
  chunks.push(ESC, 0x21, 0x10); // Double height
  chunks.push(...textToBytes(data.outletName || 'MY WASCHEN'));
  chunks.push(LF);
  chunks.push(ESC, 0x21, 0x00);
  chunks.push(ESC, 0x45, 0x00);

  if (data.outletTagline) {
    chunks.push(...textToBytes(data.outletTagline), LF);
  }
  if (data.outletAddress) {
    chunks.push(...textToBytes(data.outletAddress), LF);
  }
  if (data.outletPhone) {
    chunks.push(...textToBytes('Telp: ' + data.outletPhone), LF);
  }

  // Divider
  chunks.push(ESC, 0x61, 0x00);
  chunks.push(ESC, 0x2D, 0x01);
  chunks.push(...textToBytes('─'.repeat(w)), LF);
  chunks.push(ESC, 0x2D, 0x00);

  // Transaction info
  if (data.transactionNo) {
    chunks.push(...textToBytes(two('No Nota:', data.transactionNo)), LF);
  }
  if (data.showDate !== false && data.transactionDate) {
    chunks.push(...textToBytes(two('Tgl:', data.transactionDate)), LF);
  }
  if (data.showCashier !== false && data.cashierName) {
    chunks.push(...textToBytes(two('Kasir:', data.cashierName)), LF);
  }
  if (data.showEstDone !== false && data.estimatedDone) {
    chunks.push(...textToBytes(two('Est Selesai:', data.estimatedDone)), LF);
  }

  // Customer
  chunks.push(ESC, 0x2D, 0x01);
  chunks.push(...textToBytes('─'.repeat(w)), LF);
  chunks.push(ESC, 0x2D, 0x00);

  if (data.showCustomer !== false && data.customerName) {
    chunks.push(ESC, 0x45, 0x01);
    chunks.push(...textToBytes(center(data.customerName)), LF);
    chunks.push(ESC, 0x45, 0x00);
  }
  if (data.showPhone !== false && data.customerPhone) {
    chunks.push(...textToBytes(two('HP:', data.customerPhone)), LF);
  }

  // Items
  chunks.push(ESC, 0x2D, 0x01);
  chunks.push(...textToBytes('─'.repeat(w)), LF);
  chunks.push(ESC, 0x2D, 0x00);

  chunks.push(ESC, 0x45, 0x01);
  chunks.push(...textToBytes(center('LAYANAN')), LF);
  chunks.push(ESC, 0x45, 0x00);

  if (data.items && Array.isArray(data.items)) {
    for (const item of data.items) {
      const name = (item.name || '').substring(0, w);
      chunks.push(...textToBytes(padR(name + (item.isExpress ? ' *' : ''), w)), LF);

      if (item.fragrance && data.showFragrance !== false) {
        chunks.push(...textToBytes(padR('  Parfum: ' + item.fragrance, w)), LF);
      }

      const priceLine = padR('  ' + item.qty + 'x' + fmt(item.price), Math.floor(w / 2) - 1) +
                       padL(fmt(item.subtotal || item.price), Math.floor(w / 2) - 1);
      chunks.push(...textToBytes(priceLine), LF);
    }
  }

  // Totals
  chunks.push(ESC, 0x2D, 0x01);
  chunks.push(...textToBytes('─'.repeat(w)), LF);
  chunks.push(ESC, 0x2D, 0x00);

  if (data.subtotal) {
    chunks.push(...textToBytes(two('Subtotal:', rp(data.subtotal))), LF);
  }
  if (data.memberDiscount > 0) {
    chunks.push(...textToBytes(two('Diskon:', '-' + rp(data.memberDiscount))), LF);
  }
  if (data.deliveryFee > 0) {
    chunks.push(...textToBytes(two('Ongkir:', rp(data.deliveryFee))), LF);
  }

  // Total
  chunks.push(ESC, 0x45, 0x01);
  chunks.push(ESC, 0x21, 0x10);
  chunks.push(...textToBytes(two('TOTAL:', rp(data.total || 0))), LF);
  chunks.push(ESC, 0x21, 0x00);
  chunks.push(ESC, 0x45, 0x00);

  // Payment
  if (data.payMethod) {
    chunks.push(...textToBytes(two('Bayar(' + data.payMethod + '):', rp(data.paidAmount || 0))), LF);
  }
  if (data.changeAmount > 0) {
    chunks.push(...textToBytes(two('Kembalian:', rp(data.changeAmount))), LF);
  }

  // Status
  if (data.paymentStatus) {
    chunks.push(ESC, 0x61, 0x01);
    chunks.push(...textToBytes('[' + data.paymentStatus + ']'), LF);
  }

  // Footer
  chunks.push(ESC, 0x2D, 0x01);
  chunks.push(...textToBytes('─'.repeat(w)), LF);
  chunks.push(ESC, 0x2D, 0x00);
  chunks.push(ESC, 0x61, 0x01);

  if (data.footerText) {
    const lines = data.footerText.split('\n');
    for (const line of lines) {
      chunks.push(...textToBytes(line.substring(0, w)), LF);
    }
  }

  // Feed & Cut
  chunks.push(ESC, 0x64, 0x05);
  chunks.push(GS, 0x56, 0x00);

  return new Uint8Array(chunks);
}

function textToBytes(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    bytes.push(text.charCodeAt(i));
  }
  return bytes;
}

/**
 * Send data to printer
 */
async function sendData(data) {
  if (!isConnected) {
    throw new Error('Printer belum terhubung');
  }

  if (!characteristic) {
    // Try to find characteristic again
    try {
      const service = await server.getPrimaryService(BLUETOOTH_UUIDS.SPP);
      characteristic = await service.getCharacteristic(BLUETOOTH_UUIDS.SPP);
    } catch (e) {
      throw new Error('Printer tidak mendukung mencetak');
    }
  }

  const buffer = data instanceof Uint8Array ? data : new Uint8Array(data);
  await characteristic.writeValue(buffer);
  console.log('[BT] Sent', buffer.length, 'bytes');
  return { success: true, bytes: buffer.length };
}

/**
 * Print receipt
 */
export async function print(data) {
  if (!isConnected) {
    await connect();
  }

  const receipt = buildReceipt(data);
  return await sendData(receipt);
}

/**
 * Test print
 */
export async function printTest() {
  const testData = {
    outletName: 'MY WASCHEN',
    outletTagline: 'Clean, Fast, Reliable',
    outletAddress: 'Jl. Kemang Raya No.45',
    outletPhone: '021-1234-5678',
    transactionNo: 'TEST-' + Date.now().toString(36).toUpperCase(),
    transactionDate: new Date().toLocaleString('id-ID'),
    cashierName: 'Admin Kasir',
    showDate: true,
    showCashier: true,
    showCustomer: true,
    customerName: 'Budi Santoso',
    showPhone: true,
    customerPhone: '0812-3456-7890',
    showEstDone: true,
    estimatedDone: new Date(Date.now() + 86400000).toLocaleString('id-ID'),
    showFragrance: true,
    items: [
      { name: 'Cuci Setrika', qty: 2, price: 7000, subtotal: 14000, fragrance: 'Lavender', isExpress: true },
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

  return await print(testData);
}

// ─── Export ────────────────────────────────────────────────────────────────

export default {
  isBluetoothSupported,
  isAndroid,
  isWebBluetoothAvailable,
  connect,
  disconnect,
  getStatus,
  getSavedDevice,
  clearSavedDevice,
  print,
  printTest,
  buildReceipt,
};
