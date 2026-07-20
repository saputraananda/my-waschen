/**
 * Bluetooth Thermal Printer Service
 * Smart reconnect: saves device ID + discovered UUIDs for instant reconnection.
 * No hardcoded UUIDs — discovers and saves whatever the printer exposes.
 */

const STORAGE_KEY = 'waschen_bt_printer';

// ─── State ────────────────────────────────────────────────────────────────

let device = null;
let server = null;
let service = null;
let characteristic = null;
let isConnected = false;

// ─── Availability ─────────────────────────────────────────────────────────

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

// ─── Storage ─────────────────────────────────────────────────────────────

/**
 * Get ALL paired/known Bluetooth devices from:
 * 1. navigator.bluetooth.getDevices() — devices user previously authorized
 * 2. localStorage saved device info
 * Returns array of { id, name, macAddress, serviceUUID, charUUID, connected }
 */
export async function getPairedDevices() {
  const saved = getSavedDevice();
  const devices = [];

  // 1. Get devices from Web Bluetooth API (previously authorized)
  if (navigator.bluetooth?.getDevices) {
    try {
      const btDevices = await navigator.bluetooth.getDevices();
      for (const btDevice of btDevices) {
        if (btDevice.gatt?.connected) {
          devices.push({
            deviceId: btDevice.id,
            name: btDevice.name || 'Unknown Device',
            macAddress: btDevice.address || null,
            connected: true,
            source: 'paired',
          });
        }
      }
      console.log('[BT] Found', btDevices.length, 'paired device(s) from Bluetooth API');
    } catch (e) {
      console.warn('[BT] getDevices() failed:', e);
    }
  }

  // 2. Add saved device if not already in list (may not be connected)
  if (saved?.deviceId) {
    const alreadyInList = devices.some(d => d.deviceId === saved.deviceId);
    if (!alreadyInList) {
      devices.unshift({
        deviceId: saved.deviceId,
        name: saved.name || saved.deviceId,
        macAddress: saved.macAddress || null,
        serviceUUID: saved.serviceUUID || null,
        charUUID: saved.charUUID || null,
        connected: false,
        source: 'saved',
      });
    }
  }

  return devices;
}

/**
 * Save discovered device info for smart reconnect.
 * Saves: deviceId, name, MAC, serviceUUID, charUUID
 */
function saveDeviceInfo(btDevice, svc, char) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      deviceId: btDevice.id,
      name: btDevice.name || 'Bluetooth Printer',
      macAddress: btDevice.address || null,
      serviceUUID: svc?.uuid || null,
      charUUID: char?.uuid || null,
      savedAt: Date.now(),
    }));
  } catch (e) {
    console.warn('[BT] Failed to save device info:', e);
  }
}

/**
 * Get saved device info (null if never connected before)
 */
export function getSavedDevice() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Clear saved device info
 */
export function clearSavedDevice() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

/**
 * Reset ALL Bluetooth state — clears saved device AND resets in-memory connection.
 * Call this when Bluetooth gets stuck or permissions are revoked.
 * Usage: Buka DevTools Console → ketik:
 *   const BT = (await import('/src/utils/bluetoothPrinter.js')).default;
 *   await BT.resetAll();
 */
export async function resetAll() {
  await disconnect();
  clearSavedDevice();
  console.log('[BT] All Bluetooth state cleared. Refresh page and reconnect.');
}

// ─── Service Discovery ────────────────────────────────────────────────────

/**
 * Discover all services & characteristics on the connected GATT server.
 * Returns { service, characteristic } of the first writable characteristic found.
 * Also saves the successful combo to localStorage for fast reconnect.
 */
async function discoverAndSave(serverInstance, btDevice) {
  const allServices = await serverInstance.getPrimaryServices();

  console.log('[BT] Services:');
  let foundService = null;
  let foundChar = null;

  for (const svc of allServices) {
    console.log('[BT] Service:', svc.uuid);
    try {
      const chars = await svc.getCharacteristics();
      for (const ch of chars) {
        const writeable = ch.properties.write || ch.properties.writeWithoutResponse;
        const props = [];
        if (ch.properties.write) props.push('WRITE');
        if (ch.properties.writeWithoutResponse) props.push('WRITE_NO_RESP');
        if (ch.properties.read) props.push('READ');
        if (ch.properties.notify) props.push('NOTIFY');
        console.log('[BT]   ->', ch.uuid, '[' + props.join(' + ') + ']');

        if (writeable && !foundChar) {
          foundChar = ch;
          foundService = svc;
        }
      }
    } catch (e) {
      console.log('[BT]   (could not read chars)');
    }
  }

  if (foundChar && foundService) {
    saveDeviceInfo(btDevice, foundService, foundChar);
    console.log('[BT] Saved:', foundService.uuid, '->', foundChar.uuid);
  }

  return { service: foundService, characteristic: foundChar };
}

// ─── Connection ────────────────────────────────────────────────────────────

/**
 * Connect to printer — tries silent reconnect via getDevices() first,
 * only shows device picker (requestDevice) if no previously-authorized
 * device is available.
 *
 * @param {string} [deviceId] - Optional: connect to specific device ID
 * @returns {{ success, name, silent, serviceUUID?, charUUID?, alreadyConnected? }}
 */
export async function connect(deviceId) {
  if (!isWebBluetoothAvailable()) {
    throw new Error('Bluetooth tidak tersedia. Gunakan Chrome di Android.');
  }

  if (isConnected && device && server) {
    return { success: true, name: device.name, alreadyConnected: true };
  }

  const saved = getSavedDevice();

  // ── STEP 1: Silent reconnect — try getDevices() first (NO chooser) ────────
  if (navigator.bluetooth?.getDevices && (deviceId || saved?.deviceId)) {
    const silentResult = await silentReconnect(deviceId, saved);
    if (silentResult) {
      return silentResult;
    }
  }

  // ── STEP 2: No authorized device found → MUST show device picker ─────────
  // requestDevice() always triggers a chooser popup — this is the only path
  // that shows UI. It runs after user gesture (onClick), so user activation
  // is still fresh and Chrome won't silently cancel the chooser.
  console.log('[BT] No saved/authorized device — showing device picker...');
  return await connectWithPicker(deviceId, saved);
}

/**
 * Silent reconnect using navigator.bluetooth.getDevices().
 * Returns a result object on success, or null if the device is not available.
 * This method does NOT show any browser UI.
 *
 * IMPORTANT: getDevices() only returns devices that:
 * 1. Were previously authorized by the user for this origin
 * 2. Are still in range and the device hasn't been "forgotten" in Chrome settings
 *
 * If saved device ID is no longer in the authorized list, we return null
 * and let the caller fall through to connectWithPicker().
 */
async function silentReconnect(deviceId, saved) {
  try {
    const known = await navigator.bluetooth.getDevices();
    const targetId = deviceId || saved?.deviceId;
    const btDevice = known.find(d => d.id === targetId);

    if (!btDevice) {
      // Device not in authorized list — could be:
      // 1. First time connecting (normal)
      // 2. Device was "forgotten" in Chrome settings
      // 3. localStorage has stale device ID from different browser/context
      // Clear saved data so we don't keep trying with invalid ID
      if (saved?.deviceId) {
        console.log('[BT] Saved device ID not in authorized list. Clearing stale data...');
        clearSavedDevice();
      }
      console.log('[BT] getDevices(): device not in authorized list, skipping silent reconnect');
      return null;
    }

    console.log('[BT] Silent reconnect via getDevices():', btDevice.name);

    // Already connected? Just re-use
    if (btDevice.gatt?.connected) {
      device = btDevice;
      server = btDevice.gatt;
      isConnected = true;
    } else {
      // Reconnect GATT — no picker, works if device is nearby
      try {
        const gattServer = await btDevice.gatt.connect();
        device = btDevice;
        server = gattServer;
        isConnected = true;
      } catch (err) {
        // GATT connect failed — could be device out of range, turned off,
        // or permission was revoked. Clear saved data and fall through to picker.
        if (/origin.*not allowed|not allowed to access|permission/i.test(err.message) ||
            err.name === 'SecurityError') {
          console.warn('[BT] Permission revoked or device forgotten. Clearing saved data...');
          clearSavedDevice();
        } else {
          console.warn('[BT] GATT connect failed:', err.message);
        }
        return null; // Fall through to connectWithPicker
      }
    }

    // Try saved UUIDs first (fast path)
    let charFound = false;
    if (saved?.serviceUUID && saved?.charUUID) {
      try {
        const svc = await server.getPrimaryService(saved.serviceUUID);
        characteristic = await svc.getCharacteristic(saved.charUUID);
        service = svc;
        charFound = true;
        console.log('[BT] Silent reconnect OK — saved UUIDs still valid');
      } catch (e) {
        console.log('[BT] Saved UUIDs invalid, re-discovering...');
      }
    }

    // Discovery needed
    if (!charFound) {
      const result = await discoverAndSave(server, btDevice);
      service = result.service;
      characteristic = result.characteristic;
      if (characteristic) {
        console.log('[BT] Silent reconnect OK — discovered fresh UUIDs');
      }
    }

    if (!characteristic) {
      throw new Error('Printer terhubung tapi tidak ada karakteristik yang bisa ditulis.');
    }

    return {
      success: true,
      name: btDevice.name,
      serviceUUID: service?.uuid,
      charUUID: characteristic?.uuid,
      silent: true, // marks: no chooser was shown
    };
  } catch (e) {
    console.warn('[BT] Silent reconnect failed:', e.message);
    return null;
  }
}

/**
 * Connect using browser device picker (requestDevice).
 * This ALWAYS shows the Bluetooth device picker popup.
 * Only called as a last resort when no previously-authorized device exists.
 *
 * CRITICAL: optionalServices MUST be set for the origin to get ANY service access.
 * Without it, Chrome will error: "Origin is not allowed to access any service."
 * We include common thermal printer service UUIDs to maximize compatibility.
 */
async function connectWithPicker(deviceId, saved) {
  // Common thermal printer service UUIDs (ESC/POS standard)
  // Including these increases chance of getting service access permission.
  // If saved.serviceUUID exists, it's automatically included.
  const KNOWN_PRINTER_UUIDS = [
    '0000ffe0-0000-1000-8000-00805f9b34fb', // Common HM-10 / CC2541 BLE UART
    '49535343-fe7d-4ae5-8fa9-9fafd202e124', // Serial Port Profile (SPP)
    '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service
    '00001101-0000-1000-8000-00805f9b34fb', // Serial Port (RFCOMM)
  ];

  const optionalServices = [
    ...KNOWN_PRINTER_UUIDS,
    ...(saved?.serviceUUID && !KNOWN_PRINTER_UUIDS.includes(saved.serviceUUID)
      ? [saved.serviceUUID]
      : []),
  ];

  const btDevice = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices,
  });

  if (!btDevice) throw new Error('Printer tidak dipilih.');

  console.log('[BT] Selected:', btDevice.name, '|', btDevice.id);

  if (btDevice.gatt?.connected) btDevice.gatt.disconnect();

  let gattServer;
  try {
    gattServer = await btDevice.gatt.connect();
  } catch (err) {
    // "Origin is not allowed to access any service" → permission denied or device revoked
    if (err.name === 'SecurityError' ||
        /origin.*not allowed|not allowed to access|permission.*denied/i.test(err.message)) {
      throw new Error(
        'Izin akses ditolak. Pastikan kamu:\n' +
        '1. Centang "Izinkan" / "Allow" saat memilih perangkat\n' +
        '2. Printer masih dalam jangkauan dan menyala\n' +
        '3. Coba lagi — tekan "Hubungkan Printer" untuk memilih ulang'
      );
    }
    throw err;
  }

  device = btDevice;
  server = gattServer;
  isConnected = true;

  const { service: discoveredSvc, characteristic: discoveredChar } =
    await discoverAndSave(gattServer, btDevice);

  service = discoveredSvc;
  characteristic = discoveredChar;

  if (!characteristic) {
    saveDeviceInfo(btDevice, null, null);
    throw new Error(
      'Printer terhubung tapi tidak ada karakteristik yang bisa ditulis.\n\n' +
      'Buka chrome://bluetooth-internals -> devices -> ' + (btDevice.name || 'printer') +
      '\nLihat tab Services & Characteristics, kirim hasilnya ke developer.'
    );
  }

  console.log('[BT] Connected:', btDevice.name);
  console.log('[BT]   Service:', service.uuid);
  console.log('[BT]   Char:', characteristic.uuid);
  console.log('[BT]   Next time → auto-reconnect TANPA picker!');

  return {
    success: true,
    name: btDevice.name,
    macAddress: btDevice.address,
    serviceUUID: service.uuid,
    charUUID: characteristic.uuid,
    silent: false,
  };
}

export async function disconnect() {
  if (device?.gatt?.connected) {
    device.gatt.disconnect();
  }
  device = null;
  server = null;
  service = null;
  characteristic = null;
  isConnected = false;
}

export async function forgetAndDisconnect() {
  await disconnect();
  clearSavedDevice();
}

export function getStatus() {
  const saved = getSavedDevice();
  return {
    connected: isConnected,
    deviceName: device?.name || saved?.name || null,
    savedDevice: saved,
    readyForReconnect: !!(saved?.deviceId && saved?.serviceUUID && saved?.charUUID),
  };
}

// ─── Utilities ─────────────────────────────────────────────────────────────

function wrapText(text, len) {
  if (!text) return [];
  const lines = [];
  const parts = String(text).split(/\s+/);
  let current = '';
  for (const part of parts) {
    if (!part) continue;
    if (current.length + part.length + (current ? 1 : 0) <= len) {
      current += (current ? ' ' : '') + part;
    } else {
      if (current) lines.push(current);
      current = part.length > len ? part.substring(0, len) : part;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const padR = (t, len) => String(t ?? '').padEnd(len, ' ').substring(0, len);
const padL = (t, len) => String(t ?? '').padStart(len, ' ').substring(0, len);

const two = (l, r, w) => {
  const half = Math.floor(w / 2);
  const left  = padR(l, half - 1);
  const right = padL(r, w - left.length - 1);
  return left + ' ' + right;
};

const center = (t, len) => {
  const s = String(t ?? '').substring(0, len);
  const pad = Math.max(0, Math.floor((len - s.length) / 2));
  return s.padStart(pad + s.length, ' ').padEnd(len, ' ');
};

// ─── Receipt Builder ───────────────────────────────────────────────────────

export function buildReceipt(data) {
  const w = data.charPerLine || 32;
  const chunks = [];

  const rp  = (n) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
  const fmt = (n) => (Number(n) || 0).toLocaleString('id-ID');

  const ESC = 0x1B, GS = 0x1D, LF = 0x0A;

  // Init printer
  chunks.push(ESC, 0x40);
  // Set character set to PC437 (standard US) — helps avoid encoding mismatches
  chunks.push(ESC, 0x74, 0x00);

  // Header
  chunks.push(ESC, 0x61, 0x01);          // center
  chunks.push(ESC, 0x45, 0x01);          // bold on
  chunks.push(ESC, 0x21, 0x10);          // double height
  chunks.push(...textToBytes(center(data.outletName || 'MY WASCHEN', w)));
  chunks.push(LF);
  chunks.push(ESC, 0x21, 0x00, ESC, 0x45, 0x00);

  if (data.outletTagline) {
    for (const line of wrapText(data.outletTagline, w)) {
      chunks.push(...textToBytes(center(line, w)), LF);
    }
  }
  if (data.outletAddress) {
    for (const line of wrapText(data.outletAddress, w)) {
      chunks.push(...textToBytes(center(line, w)), LF);
    }
  }
  if (data.outletPhone) {
    chunks.push(...textToBytes(center('Telp: ' + data.outletPhone, w)), LF);
  }

  // Divider
  const div = '-'.repeat(w);
  chunks.push(ESC, 0x61, 0x00, ESC, 0x2D, 0x01);
  chunks.push(...textToBytes(div), LF, ESC, 0x2D, 0x00);

  // Transaction info
  if (data.transactionNo) chunks.push(...textToBytes(two('No Nota:', data.transactionNo, w)), LF);
  if (data.showDate !== false && data.transactionDate)
    chunks.push(...textToBytes(two('Tgl:', data.transactionDate, w)), LF);
  if (data.showCashier !== false && data.cashierName)
    chunks.push(...textToBytes(two('Kasir:', data.cashierName, w)), LF);
  if (data.showEstDone !== false && data.estimatedDone)
    chunks.push(...textToBytes(two('Est Selesai:', data.estimatedDone, w)), LF);

  // Customer section
  chunks.push(ESC, 0x2D, 0x01, ...textToBytes(div), LF, ESC, 0x2D, 0x00);
  if (data.showCustomer !== false && data.customerName) {
    for (const line of wrapText(data.customerName, w)) {
      chunks.push(ESC, 0x45, 0x01, ...textToBytes(line), LF, ESC, 0x45, 0x00);
    }
  }
  if (data.showPhone !== false && data.customerPhone)
    chunks.push(...textToBytes(two('HP:', data.customerPhone, w)), LF);
  if (data.showAddress !== false && data.customerAddress) {
    for (const line of wrapText(data.customerAddress, w)) {
      chunks.push(...textToBytes(line), LF);
    }
  }

  // Items
  chunks.push(ESC, 0x2D, 0x01, ...textToBytes(div), LF, ESC, 0x2D, 0x00);
  chunks.push(ESC, 0x45, 0x01, ...textToBytes(padR('LAYANAN', w)), LF, ESC, 0x45, 0x00);

  if (data.items && Array.isArray(data.items)) {
    for (const item of data.items) {
      const nameLines = wrapText((item.name || item.serviceName || '') + (item.isExpress ? ' *' : ''), w);
      for (const ln of nameLines) chunks.push(...textToBytes(padR(ln, w)), LF);

      if (item.fragrance && data.showFragrance !== false)
        chunks.push(...textToBytes(padR('  Par: ' + item.fragrance, w)), LF);

      const qtyPrice = '  ' + item.qty + 'x' + fmt(item.price);
      const qtyLen   = Math.floor(w / 2) - 1;
      const subLen   = w - qtyLen - 1;
      chunks.push(...textToBytes(padR(qtyPrice, qtyLen) + ' ' + padL(fmt(item.subtotal || item.price), subLen)), LF);
    }
  }

  // Totals
  chunks.push(ESC, 0x2D, 0x01, ...textToBytes(div), LF, ESC, 0x2D, 0x00);
  if (data.subtotal) chunks.push(...textToBytes(two('Subtotal:', rp(data.subtotal), w)), LF);
  if (data.memberDiscount > 0)
    chunks.push(...textToBytes(two('Diskon:', '-' + rp(data.memberDiscount), w)), LF);
  if (data.deliveryFee > 0)
    chunks.push(...textToBytes(two('Ongkir:', rp(data.deliveryFee), w)), LF);

  // Total
  chunks.push(ESC, 0x45, 0x01, ESC, 0x21, 0x10);
  chunks.push(...textToBytes(two('TOTAL:', rp(data.total || 0), w)), LF);
  chunks.push(ESC, 0x21, 0x00, ESC, 0x45, 0x00);

  // Payment
  if (data.payMethod)
    chunks.push(...textToBytes(two('Bayar(' + data.payMethod + '):', rp(data.paidAmount || 0), w)), LF);
  if (data.changeAmount > 0)
    chunks.push(...textToBytes(two('Kembalian:', rp(data.changeAmount), w)), LF);
  if (data.balance > 0) {
    chunks.push(ESC, 0x45, 0x01);
    chunks.push(...textToBytes(two('SISA:', rp(data.balance), w)), LF);
    chunks.push(ESC, 0x45, 0x00);
  }

  if (data.paymentStatus) {
    chunks.push(ESC, 0x61, 0x01, ...textToBytes('[' + data.paymentStatus + ']'), LF);
  }

  // Footer
  chunks.push(ESC, 0x2D, 0x01, ...textToBytes(div), LF, ESC, 0x2D, 0x00);
  chunks.push(ESC, 0x61, 0x01);
  if (data.footerText) {
    for (const line of data.footerText.split('\n')) {
      for (const wrapped of wrapText(line, w)) {
        chunks.push(...textToBytes(wrapped), LF);
      }
    }
  }

  // Feed & cut
  chunks.push(ESC, 0x64, 0x05, GS, 0x56, 0x00);

  return new Uint8Array(chunks);
}

// ─── Label Builder ─────────────────────────────────────────────────────────

export function buildLabel(unitData, fullData) {
  const w = fullData.charPerLine || 32;
  const chunks = [];
  const ESC = 0x1B, GS = 0x1D, LF = 0x0A;

  // Init
  chunks.push(ESC, 0x40);
  // Set character set to PC437 (standard US) — helps avoid encoding mismatches
  chunks.push(ESC, 0x74, 0x00);

  // Outlet name
  chunks.push(ESC, 0x61, 0x01);
  chunks.push(ESC, 0x45, 0x01);
  chunks.push(ESC, 0x21, 0x10);
  chunks.push(...textToBytes(padR(fullData.outletName || 'MY WASCHEN', w)));
  chunks.push(LF);
  chunks.push(ESC, 0x21, 0x00, ESC, 0x45, 0x00);

  // Customer info
  const name = (fullData.customerName || '').substring(0, w);
  chunks.push(...textToBytes(padR(name, w)), LF);

  const phone = 'HP: ' + (fullData.customerPhone || '');
  chunks.push(...textToBytes(phone.substring(0, w)), LF);

  // Divider
  const div = '-'.repeat(w);
  chunks.push(ESC, 0x2D, 0x01);
  chunks.push(...textToBytes(div), LF, ESC, 0x2D, 0x00);

  // Unit number — extra large
  const unitNo = unitData.unitNo || unitData.service_name || unitData.transaction_no || '';
  chunks.push(ESC, 0x61, 0x01);
  chunks.push(ESC, 0x45, 0x01);
  chunks.push(ESC, 0x21, 0x11);
  chunks.push(...textToBytes(padR(unitNo, w)));
  chunks.push(LF);
  chunks.push(ESC, 0x21, 0x00, ESC, 0x45, 0x00);

  // Divider
  chunks.push(ESC, 0x2D, 0x01);
  chunks.push(...textToBytes(div), LF, ESC, 0x2D, 0x00);

  // QR Code — native ESC/POS QR command (supported by virtually all thermal printers)
  const qrData = unitData.barcode_data || `${unitData.transaction_no || ''}#${(unitData._index !== undefined ? unitData._index + 1 : 1)}`;
  if (qrData) {
    chunks.push(...buildQRCommand(qrData));
  }

  // Divider
  chunks.push(ESC, 0x2D, 0x01);
  chunks.push(...textToBytes(div), LF, ESC, 0x2D, 0x00);

  // Date info
  chunks.push(ESC, 0x61, 0x00);
  const inDate = fullData.transactionDate
    ? 'Masuk: ' + fullData.transactionDate.split(',')[0].trim()
    : '';
  const unitIdx   = unitData._index !== undefined ? unitData._index + 1 : 1;
  const totalUnits = unitData._total   !== undefined ? unitData._total   : 1;
  const itemLabel = 'Item ' + unitIdx + ' dr ' + totalUnits;

  const footerLine = inDate + (inDate && itemLabel ? ' | ' : '') + itemLabel;
  for (const ln of wrapText(footerLine, w)) {
    chunks.push(...textToBytes(ln), LF);
  }

  // Feed & partial cut
  chunks.push(ESC, 0x64, 0x04, GS, 0x56, 0x01);

  return new Uint8Array(chunks);
}

// ─── Text Encoding ──────────────────────────────────────────────────────────

/**
 * Unicode -> ASCII fallback map for ESC/POS thermal printers.
 * CRITICAL: Thermal printers expect single-byte ASCII (0-127).
 * Any Unicode char outside that range gets replaced with an ASCII equivalent.
 * Box-drawing characters (U+2500-U+257F) are EXCLUDED — they map to bytes
 * 0x80-0xFF which render as graphical chars on non-PC437 printers.
 * Use plain ASCII: '-' '-' '=' '+' '|' instead.
 */
const UNICODE_FALLBACK = {
  0x2014: '-',  // Em Dash
  0x2013: '-',  // En Dash
  0x2018: "'",  // Left Single Quote
  0x2019: "'",  // Right Single Quote
  0x201C: '"',  // Left Double Quote
  0x201D: '"',  // Right Double Quote
  0x2022: '*',  // Bullet
  0x2026: '.',  // Ellipsis
  0x20AC: 'E',  // Euro
  0x00A9: 'C',  // Copyright
  0x00AE: 'R',  // Registered
  0x2122: 'T',  // Trademark
};

function textToBytes(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 128) {
      bytes.push(c);
    } else if (UNICODE_FALLBACK[c] !== undefined) {
      bytes.push(UNICODE_FALLBACK[c].charCodeAt(0));
    } else {
      bytes.push(0x3F); // '?'
    }
  }
  return bytes;
}

// ─── QR Code (native ESC/POS command) ──────────────────────────────────────

/**
 * Build native ESC/POS QR code command bytes (Model 2).
 * Supported by virtually all thermal printers.
 * @param {string} data - string to encode
 * @param {number} size - module size 1-16 (default 6 = good for 58mm paper)
 * @returns {number[]} QR command bytes as array of numbers
 */
function buildQRCommand(data, size = 6) {
  const GS = 0x1D;
  const dataBytes = new TextEncoder().encode(data);
  const dataLen = dataBytes.length;

  const chunks = [];

  // 1. Select QR Model 2
  chunks.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x41, 0x32, 0x00);

  // 2. Set module size (1-16)
  chunks.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, (size & 0xFF));

  // 3. Set error correction level (49=M, 48=L, 50=Q, 51=H)
  chunks.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31); // M = ~15% recovery

  // 4. Store QR data in printer memory
  const storeLen = dataLen + 3;
  chunks.push(GS, 0x28, 0x6B, (storeLen & 0xFF), ((storeLen >> 8) & 0xFF), 0x31, 0x50, 0x30);
  for (let i = 0; i < dataBytes.length; i++) {
    chunks.push(dataBytes[i]);
  }

  // 5. Print QR code
  chunks.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);

  return chunks;
}

// ─── Send Data ─────────────────────────────────────────────────────────────

/**
 * Write bytes to the printer. If the GATT connection has dropped (e.g. printer
 * went to sleep), this automatically reconnects and retries once.
 */
async function sendData(data) {
  const buffer = data instanceof Uint8Array ? data : new Uint8Array(data);
  const MAX_CHUNK = 256;

  async function doWrite() {
    if (!server || !characteristic) {
      // More specific error message based on what went wrong
      if (!isConnected && !server) {
        throw new Error(
          'Printer belum terhubung.\n' +
          'Buka Pengaturan Printer → Tekan "Hubungkan Printer"'
        );
      }
      throw new Error(
        'Printer terhubung tapi karakteristik tulis tidak ditemukan.\n' +
        'Coba "Lupakan Printer" lalu hubungkan ulang.'
      );
    }
    if (buffer.length <= MAX_CHUNK) {
      await characteristic.writeValue(buffer);
      console.log('[BT] Sent', buffer.length, 'bytes');
    } else {
      console.log('[BT] Sending', buffer.length, 'bytes in', Math.ceil(buffer.length / MAX_CHUNK), 'chunks');
      for (let offset = 0; offset < buffer.length; offset += MAX_CHUNK) {
        const chunk = buffer.slice(offset, offset + MAX_CHUNK);
        await characteristic.writeValue(chunk);
        await new Promise(r => setTimeout(r, 30));
      }
      console.log('[BT] All chunks sent');
    }
    return { success: true, bytes: buffer.length };
  }

  // Try once; on GATT error, reconnect and retry
  try {
    return await doWrite();
  } catch (err) {
    const isGattError = err.name === 'NetworkError' || err.name === 'InvalidStateError' ||
      /GATT.*disconnected/i.test(err.message) ||
      /cannot perform/i.test(err.message);

    if (!isGattError) throw err;

    console.warn('[BT] GATT disconnected, attempting silent reconnect...');
    isConnected = false;
    characteristic = null;

    // Try reconnect using getDevices() (no picker) — works if previously authorized
    if (navigator.bluetooth?.getDevices) {
      try {
        const devices = await navigator.bluetooth.getDevices();
        const saved = getSavedDevice();
        const knownDevice = devices.find(d => d.id === saved?.deviceId);
        if (knownDevice) {
          console.log('[BT] Reconnecting via getDevices()...');
          await reconnectWithDevice(knownDevice, saved);
          return await doWrite();
        }
      } catch (e) {
        console.warn('[BT] getDevices reconnect failed:', e.message);
      }
    }

    throw new Error('Printer terputus. Tekan "Hubungkan Printer" untuk menyambungkan kembali.');
  }
}

/**
 * Reconnect to a Bluetooth device obtained via getDevices() — no picker shown.
 */
async function reconnectWithDevice(btDevice, savedInfo) {
  if (btDevice.gatt?.connected) {
    device = btDevice;
    server = btDevice.gatt;
    isConnected = true;
  } else {
    await btDevice.gatt.connect();
    device = btDevice;
    server = btDevice.gatt;
    isConnected = true;
  }

  // Re-establish characteristic
  if (savedInfo?.serviceUUID && savedInfo?.charUUID) {
    try {
      const svc = await server.getPrimaryService(savedInfo.serviceUUID);
      characteristic = await svc.getCharacteristic(savedInfo.charUUID);
      service = svc;
      console.log('[BT] Reconnected via getDevices() — saved UUIDs still valid!');
      return;
    } catch (e) {
      console.log('[BT] Saved UUIDs invalid, re-discovering...');
    }
  }

  // Fall back to fresh discovery
  const result = await discoverAndSave(server, device);
  service = result.service;
  characteristic = result.characteristic;
  if (!characteristic) {
    throw new Error('Printer terhubung tapi tidak ada karakteristik yang bisa ditulis.');
  }
}

// ─── Print Functions ───────────────────────────────────────────────────────

export async function print(data) {
  // Ensure we have a connection before sending
  if (!isConnected || !server) {
    try {
      await connect();
    } catch (err) {
      // Re-throw with clearer context
      if (/printer.*belum|printer.*terputus/i.test(err.message)) {
        throw new Error('Printer belum terhubung. Tekan "Hubungkan Printer" di halaman Pengaturan Printer terlebih dahulu.');
      }
      throw err;
    }
  }
  if (!characteristic) {
    throw new Error(
      'Printer terhubung tapi tidak siap cetak.\n' +
      'Tekan "Hubungkan Printer" di halaman Pengaturan Printer untuk mengatur ulang koneksi.'
    );
  }
  const receipt = buildReceipt(data);
  return await sendData(receipt);
}

export async function printLabel(unitData, fullData) {
  if (!isConnected || !server) {
    try {
      await connect();
    } catch (err) {
      if (/printer.*belum|printer.*terputus/i.test(err.message)) {
        throw new Error('Printer belum terhubung. Tekan "Hubungkan Printer" di halaman Pengaturan Printer terlebih dahulu.');
      }
      throw err;
    }
  }
  if (!characteristic) {
    throw new Error(
      'Printer terhubung tapi tidak siap cetak label.\n' +
      'Tekan "Hubungkan Printer" di halaman Pengaturan Printer untuk mengatur ulang koneksi.'
    );
  }
  const label = buildLabel(unitData, fullData);
  return await sendData(label);
}

export async function printTest() {
  return await print({
    outletName: 'MY WASCHEN',
    outletTagline: 'Clean, Fast, Reliable',
    outletAddress: 'Jl. Kemang Raya No.45',
    outletPhone: '021-1234-5678',
    transactionNo: 'TEST-' + Date.now().toString(36).toUpperCase(),
    transactionDate: new Date().toLocaleString('id-ID'),
    cashierName: 'Admin Kasir',
    customerName: 'Budi Santoso',
    customerPhone: '0812-3456-7890',
    estimatedDone: new Date(Date.now() + 86400000).toLocaleString('id-ID'),
    showDate: true,
    showCashier: true,
    showCustomer: true,
    showPhone: true,
    showEstDone: true,
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
  });
}

// ─── Debug ────────────────────────────────────────────────────────────────

export async function debugDiscoverPrinter() {
  if (!isConnected || !server) {
    console.log('[BT] Not connected -- run connect() first.');
    return;
  }

  console.log('[BT] Full discovery on connected printer...');
  const allServices = await server.getPrimaryServices();
  console.log('[' + allServices.length + ' service(s) found]');

  for (const svc of allServices) {
    console.log('\n[BT] Service:', svc.uuid);
    try {
      const chars = await svc.getCharacteristics();
      for (const ch of chars) {
        const props = [];
        if (ch.properties.write) props.push('WRITE');
        if (ch.properties.writeWithoutResponse) props.push('WRITE_NO_RESP');
        if (ch.properties.read) props.push('READ');
        if (ch.properties.notify) props.push('NOTIFY');
        if (ch.properties.indicate) props.push('INDICATE');
        console.log('   ->', ch.uuid, '[' + props.join(' + ') + ']');
      }
    } catch {
      console.log('   (could not enumerate)');
    }
  }
}

// ─── Export ──────────────────────────────────────────────────────────────

export default {
  isBluetoothSupported,
  isAndroid,
  isWebBluetoothAvailable,
  connect,
  disconnect,
  forgetAndDisconnect,
  getStatus,
  getSavedDevice,
  clearSavedDevice,
  getPairedDevices,
  print,
  printTest,
  printLabel,
  buildReceipt,
  buildLabel,
  debugDiscoverPrinter,
  resetAll,
};
