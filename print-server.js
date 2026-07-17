/**
 * Print Server - Local print bridge untuk browser app
 * Mendukung koneksi dari 3rd party POS
 *
 * Usage: node print-server.js
 *
 * Features:
 * - USB Printer (ESC/POS)
 * - LAN Printer (ESC/POS)
 * - Bluetooth Printer (via COM port)
 * - Windows Print Spooler
 * - API untuk 3rd party POS integration
 */

import http from 'http';
import { NetworkPrinter } from 'escpos-network';
import USB from 'escpos-usb';
import { Printer as ESCPOSPrinter } from 'escpos';
import { SerialPort } from 'serialport';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

const PORT = process.env.PORT || 3456;
const HOST = process.env.HOST || '0.0.0.0'; // 0.0.0.0 untuk accept dari network

// State
let connectedPrinter = null;
let printerType = null; // 'usb' | 'lan' | 'bluetooth' | 'windows'

// ─── Helper: Send JSON response ─────────────────────────────────────────────────
function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

// ─── Helper: Get Windows default printer ──────────────────────────────────────
async function getWindowsPrinter() {
  try {
    const { stdout } = await execAsync(
      'powershell -Command "Get-WmiObject -Class Win32_Printer | Where-Object {$_.Default} | Select-Object -First 1 -ExpandProperty Name"'
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

// ─── Helper: Get Windows available printers ───────────────────────────────────
async function getWindowsPrinters() {
  try {
    const { stdout } = await execAsync(
      'powershell -Command "Get-WmiObject -Class Win32_Printer | Select-Object Name, PortName | ConvertTo-Json"'
    );
    const printers = JSON.parse(stdout || '[]');
    return Array.isArray(printers) ? printers : [printers];
  } catch {
    return [];
  }
}

// ─── Helper: Get USB printers ──────────────────────────────────────────────────
async function getUSBPrinters() {
  return new Promise((resolve) => {
    try {
      USB.find((err, devices) => {
        if (err || !devices) {
          resolve([]);
          return;
        }
        resolve(devices.map(d => ({
          deviceId: d.deviceId,
          vendorId: d.vendorId,
          productId: d.productId,
          name: d.deviceName || `USB Printer ${d.vendorId}:${d.productId}`
        })));
      });
    } catch {
      resolve([]);
    }
  });
}

// ─── Helper: Get Bluetooth devices (COM ports + paired devices) ─────────────────
async function getBluetoothPorts() {
  const ports = [];
  const seenPorts = new Set();

  try {
    // Method 1: Standard SerialPort enumeration
    const serialPorts = await SerialPort.list();
    for (const p of serialPorts) {
      if (p.comName && p.comName.startsWith('COM') && !seenPorts.has(p.comName)) {
        seenPorts.add(p.comName);
        ports.push({
          comPort: p.comName,
          manufacturer: p.manufacturer || 'Unknown',
          serialNumber: p.serialNumber || '',
          name: p.path || p.comName,
          type: 'serial'
        });
      }
    }

    // Method 2: Windows-specific Bluetooth COM ports via WMI
    try {
      const { stdout } = await execAsync(
        'powershell -Command "Get-WmiObject Win32_SerialPort | Where-Object { $_.DeviceID -match \'COM\\d+\' -and ($_.Description -match \'Bluetooth|Bluetooth Serial|RFCOMM|Serial over BT\' -or $_.PNPDeviceID -match \'BTHENUM\') } | Select-Object DeviceID, Description, PNPDeviceID | ConvertTo-Json"'
      );

      if (stdout && stdout.trim()) {
        const btPorts = JSON.parse(stdout);
        const portArray = Array.isArray(btPorts) ? btPorts : [btPorts];
        for (const p of portArray) {
          if (p.DeviceID && !seenPorts.has(p.DeviceID)) {
            seenPorts.add(p.DeviceID);
            ports.push({
              comPort: p.DeviceID,
              manufacturer: 'Bluetooth',
              serialNumber: p.PNPDeviceID || '',
              name: p.Description || `Bluetooth ${p.DeviceID}`,
              type: 'bluetooth'
            });
          }
        }
      }
    } catch {
      // WMI query failed, continue with SerialPort only
    }

  } catch (err) {
    console.error('[BT] Error getting Bluetooth ports:', err.message);
  }

  return ports;
}

// ─── Connect to USB printer ─────────────────────────────────────────────────────
async function connectUSB(deviceId) {
  return new Promise((resolve, reject) => {
    try {
      const device = new USB();

      device.find((err, devices) => {
        if (err) {
          reject(new Error('Gagal scan USB devices: ' + err.message));
          return;
        }

        if (!devices || devices.length === 0) {
          reject(new Error('Printer USB tidak ditemukan. Pastikan printer terhubung dan menyala.'));
          return;
        }

        // Find device by deviceId if provided, otherwise use first device
        const targetDevice = deviceId
          ? devices.find(d => d.deviceId === deviceId || `${d.vendorId}:${d.productId}` === deviceId)
          : devices[0];

        if (!targetDevice) {
          reject(new Error('Printer USB tidak cocok. Pilih printer dari daftar.'));
          return;
        }

        try {
          const adapter = new USB(targetDevice);
          adapter.open((openErr) => {
            if (openErr) {
              reject(new Error('Gagal buka koneksi USB: ' + openErr.message));
              return;
            }

            connectedPrinter = new ESCPOSPrinter(adapter);
            printerType = 'usb';
            resolve({ success: true, type: 'usb', name: targetDevice.deviceName || `USB Printer ${targetDevice.vendorId}:${targetDevice.productId}` });
          });
        } catch (initErr) {
          reject(new Error('Gagal inisialisasi USB printer: ' + initErr.message));
        }
      });
    } catch (err) {
      reject(new Error(`Gagal konek USB: ${err.message}`));
    }
  });
}

// ─── Connect to LAN printer ─────────────────────────────────────────────────────
async function connectLAN(ip, port = 9100) {
  try {
    const printer = new NetworkPrinter({ host: ip, port: parseInt(port) });
    connectedPrinter = new ESCPOSPrinter(printer);
    printerType = 'lan';

    return { success: true, type: 'lan', name: `LAN Printer ${ip}:${port}` };
  } catch (err) {
    throw new Error(`Gagal konek LAN: ${err.message}`);
  }
}

// ─── Connect to Bluetooth (COM port) ─────────────────────────────────────────
async function connectBluetooth(comPort) {
  return new Promise((resolve, reject) => {
    try {
      // Try multiple baud rates common for thermal printers
      const BAUD_RATES = [9600, 19200, 38400, 115200];
      let connectionRefused = true;

      const tryConnect = async (baudIndex = 0) => {
        if (baudIndex >= BAUD_RATES.length) {
          reject(new Error(`Gagal konek Bluetooth ${comPort}: Semua baud rate gagal. Coba baud rate 9600 di pairing settings.`));
          return;
        }

        const baudRate = BAUD_RATES[baudIndex];

        const port = new SerialPort({
          path: comPort,
          baudRate: baudRate,
          autoOpen: false,
        });

        // Set ESC/POS specific settings
        port.open((err) => {
          if (err) {
            console.log(`[BT] ${comPort} @ ${baudRate}bps failed: ${err.message}`);
            tryConnect(baudIndex + 1);
            return;
          }

          connectionRefused = false;

          // Set DTR for some Bluetooth adapters
          port.set({ dtr: true, rts: true }, (setErr) => {
            if (setErr) {
              console.log(`[BT] Warning: Could not set DTR/RTS: ${setErr.message}`);
            }
          });

          connectedPrinter = new ESCPOSPrinter(port, { encoding: 'GB18030' });
          printerType = 'bluetooth';

          port.on('error', (err) => {
            console.error(`[BT] ${comPort} error: ${err.message}`);
          });

          port.on('close', () => {
            console.log(`[BT] ${comPort} disconnected`);
            connectedPrinter = null;
            printerType = null;
          });

          resolve({ success: true, type: 'bluetooth', name: `Bluetooth ${comPort} @ ${baudRate}bps` });
        });
      };

      tryConnect();
    } catch (err) {
      reject(new Error(`Gagal konek Bluetooth: ${err.message}`));
    }
  });
}

// ─── Print via Windows Spooler ─────────────────────────────────────────────────
async function printWindows(printerName, data) {
  try {
    const tempFile = `C:\\Windows\\Temp\\waschen_print_${Date.now()}.bin`;
    fs.writeFileSync(tempFile, Buffer.from(data));

    const cmd = `copy /b "${tempFile}" "${printerName}"`;
    await execAsync(cmd);
    fs.unlinkSync(tempFile);

    return { success: true };
  } catch (err) {
    throw new Error(`Gagal print via Windows: ${err.message}`);
  }
}

// ─── Print via connected printer ───────────────────────────────────────────────
async function printToConnected(data) {
  if (!connectedPrinter) {
    throw new Error('Printer belum terhubung. Panggil /connect terlebih dahulu.');
  }

  return new Promise((resolve, reject) => {
    try {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

      connectedPrinter.raw(buf, (err) => {
        if (err) {
          reject(err);
          return;
        }

        connectedPrinter.cut((cutErr) => {
          if (cutErr) {
            console.warn('[Print] Cut failed:', cutErr.message);
          }

          // Close connection after print (for USB/BT)
          if (printerType === 'usb' || printerType === 'bluetooth') {
            if (typeof connectedPrinter.close === 'function') {
              try { connectedPrinter.close(); } catch { /* ignore */ }
            }
            connectedPrinter = null;
            printerType = null;
          }

          resolve({ success: true });
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

// ─── Build ESC/POS from JSON payload ──────────────────────────────────────────
function buildESCPOS(data) {
  const chunks = [];

  // Initialize printer
  chunks.push(Buffer.from([0x1B, 0x40])); // ESC @

  // Character set - Indonesia (PC437 / Code page 437)
  chunks.push(Buffer.from([0x1B, 0x52, 0x00])); // ESC R n (PC437)

  // Font settings
  if (data.bold) {
    chunks.push(Buffer.from([0x1B, 0x45, 0x01])); // ESC E n
  }
  if (data.doubleHeight) {
    chunks.push(Buffer.from([0x1B, 0x21, 0x10])); // ESC ! n
  }
  if (data.doubleWidth) {
    chunks.push(Buffer.from([0x1B, 0x21, 0x20])); // ESC ! n
  }
  if (data.center) {
    chunks.push(Buffer.from([0x1B, 0x61, 0x01])); // ESC a n (center)
  } else if (data.right) {
    chunks.push(Buffer.from([0x1B, 0x61, 0x02])); // ESC a n (right)
  } else {
    chunks.push(Buffer.from([0x1B, 0x61, 0x00])); // ESC a n (left)
  }

  // Text
  if (data.text) {
    chunks.push(Buffer.from(data.text + '\n', 'utf8'));
  }

  // Line
  if (data.line) {
    const char = data.lineChar || '-';
    const len = data.lineLength || 32;
    chunks.push(Buffer.from(char.repeat(len) + '\n'));
  }

  // Divider
  if (data.divider) {
    chunks.push(Buffer.from([0x1B, 0x2D, 0x01])); // ESC - n (underline)
    chunks.push(Buffer.from('─'.repeat(32) + '\n', 'utf8'));
    chunks.push(Buffer.from([0x1B, 0x2D, 0x00])); // ESC - n (no underline)
  }

  // Feed
  if (data.feed) {
    chunks.push(Buffer.from([0x1B, 0x64, data.feed])); // ESC d n
  }

  // Cut
  if (data.cut) {
    chunks.push(Buffer.from([0x1D, 0x56, 0x00])); // GS V m (full cut)
  }

  // Reset
  chunks.push(Buffer.from([0x1B, 0x45, 0x00])); // ESC E n (bold off)
  chunks.push(Buffer.from([0x1B, 0x21, 0x00])); // ESC ! n (normal)
  chunks.push(Buffer.from([0x1B, 0x61, 0x00])); // ESC a n (left)

  return Buffer.concat(chunks);
}

// ─── Build full receipt ESC/POS ───────────────────────────────────────────────
function buildReceipt(data) {
  const chunks = [];
  const width = data.charPerLine || 32;

  // Helper: center text
  const center = (text) => {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  };

  // Helper: pad right
  const padRight = (text, len) => text.padEnd(len).substring(0, len);

  // Helper: pad left
  const padLeft = (text, len) => text.padStart(len).substring(0, len);

  // Helper: two column
  const twoCol = (left, right) => {
    const maxLen = Math.floor(width / 2) - 1;
    return padRight(left, maxLen) + ' ' + padLeft(right, maxLen);
  };

  // Initialize
  chunks.push(Buffer.from([0x1B, 0x40]));
  chunks.push(Buffer.from([0x1B, 0x74, 0x00])); // Code page 437 (Indonesia chars)

  // Header
  chunks.push(Buffer.from([0x1B, 0x61, 0x01])); // Center
  chunks.push(Buffer.from([0x1B, 0x45, 0x01])); // Bold on
  chunks.push(Buffer.from([0x1B, 0x21, 0x30])); // Double size
  chunks.push(Buffer.from((data.outletName || 'MY WASCHEN') + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00])); // Bold off
  chunks.push(Buffer.from([0x1B, 0x21, 0x00])); // Normal size

  if (data.outletTagline) {
    chunks.push(Buffer.from(data.outletTagline + '\n', 'utf8'));
  }
  if (data.outletAddress) {
    chunks.push(Buffer.from(data.outletAddress + '\n', 'utf8'));
  }
  if (data.outletPhone) {
    chunks.push(Buffer.from('Telp: ' + data.outletPhone + '\n', 'utf8'));
  }

  // Divider
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('─'.repeat(width) + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  // Transaction info
  chunks.push(Buffer.from([0x1B, 0x61, 0x00])); // Left
  chunks.push(Buffer.from([0x1B, 0x45, 0x01])); // Bold
  chunks.push(Buffer.from(twoCol('No. Nota:', data.transactionNo || '') + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00])); // Bold off

  if (data.showDate && data.transactionDate) {
    chunks.push(Buffer.from(twoCol('Tgl Masuk:', data.transactionDate) + '\n', 'utf8'));
  }
  if (data.showCashier && data.cashierName) {
    chunks.push(Buffer.from(twoCol('Kasir:', data.cashierName) + '\n', 'utf8'));
  }
  if (data.showEstDone && data.estimatedDone) {
    chunks.push(Buffer.from(twoCol('Est. Selesai:', data.estimatedDone) + '\n', 'utf8'));
  }

  // Customer info
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('─'.repeat(width) + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  if (data.showCustomer && data.customerName) {
    chunks.push(Buffer.from([0x1B, 0x45, 0x01]));
    chunks.push(Buffer.from(twoCol('Pelanggan:', '') + '\n', 'utf8'));
    chunks.push(Buffer.from([0x1B, 0x45, 0x00]));
    chunks.push(Buffer.from(center(data.customerName) + '\n', 'utf8'));
  }
  if (data.showPhone && data.customerPhone) {
    chunks.push(Buffer.from(twoCol('HP:', data.customerPhone) + '\n', 'utf8'));
  }

  // Items
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('─'.repeat(width) + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  chunks.push(Buffer.from([0x1B, 0x45, 0x01]));
  chunks.push(Buffer.from(center('LAYANAN') + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00]));

  if (data.items && Array.isArray(data.items)) {
    for (const item of data.items) {
      const name = item.name || item.serviceName || '';
      chunks.push(Buffer.from(padRight(name, width) + '\n', 'utf8'));
      if (item.fragrance && data.showFragrance) {
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

  if (data.subtotal) {
    chunks.push(Buffer.from(twoCol('Subtotal:', formatRupiah(data.subtotal)) + '\n', 'utf8'));
  }
  if (data.memberDiscount > 0) {
    chunks.push(Buffer.from(twoCol('Diskon Member:', '-' + formatRupiah(data.memberDiscount)) + '\n', 'utf8'));
  }
  if (data.promoDiscount > 0) {
    chunks.push(Buffer.from(twoCol('Diskon Promo:', '-' + formatRupiah(data.promoDiscount)) + '\n', 'utf8'));
  }
  if (data.deliveryFee > 0) {
    chunks.push(Buffer.from(twoCol('Ongkir:', formatRupiah(data.deliveryFee)) + '\n', 'utf8'));
  }

  // Total
  chunks.push(Buffer.from([0x1B, 0x45, 0x01]));
  chunks.push(Buffer.from([0x1B, 0x21, 0x10])); // Double height
  chunks.push(Buffer.from(twoCol('TOTAL:', formatRupiah(data.total || 0)) + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x21, 0x00])); // Normal height
  chunks.push(Buffer.from([0x1B, 0x45, 0x00]));

  // Payment info
  if (data.showPayment && data.payMethod) {
    chunks.push(Buffer.from(twoCol('Bayar (' + data.payMethod + '):', formatRupiah(data.paidAmount || 0)) + '\n', 'utf8'));
  }
  if (data.changeAmount > 0) {
    chunks.push(Buffer.from(twoCol('Kembalian:', formatRupiah(data.changeAmount)) + '\n', 'utf8'));
  }
  if (data.balance > 0) {
    chunks.push(Buffer.from(twoCol('Sisa:', formatRupiah(data.balance)) + '\n', 'utf8'));
  }

  // Footer
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('─'.repeat(width) + '\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  if (data.footerText) {
    chunks.push(Buffer.from([0x1B, 0x61, 0x01])); // Center
    chunks.push(Buffer.from((data.footerText || '') + '\n', 'utf8'));
  }

  // Feed and cut
  chunks.push(Buffer.from([0x1B, 0x64, 0x04])); // Feed 4 lines
  chunks.push(Buffer.from([0x1D, 0x56, 0x00])); // Cut

  return Buffer.concat(chunks);
}

// Helper: format rupiah
function formatRupiah(num) {
  return 'Rp ' + (Number(num) || 0).toLocaleString('id-ID');
}

// ─── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true });
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const path = url.pathname;

  try {
    // ── GET / ────────────────────────────────────────────────────────────────
    if (path === '/' && req.method === 'GET') {
      jsonResponse(res, 200, {
        service: 'Waschen Print Server',
        version: '1.0.0',
        status: 'running',
        printerConnected: printerType !== null,
        printerType: printerType,
      });
      return;
    }

    // ── GET /status ───────────────────────────────────────────────────────────
    if (path === '/status' && req.method === 'GET') {
      jsonResponse(res, 200, {
        connected: connectedPrinter !== null,
        type: printerType,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // ── GET /printers ─────────────────────────────────────────────────────────
    if (path === '/printers' && req.method === 'GET') {
      const printers = {
        usb: await getUSBPrinters(),
        bluetooth: await getBluetoothPorts(),
        windows: await getWindowsPrinters(),
      };
      jsonResponse(res, 200, printers);
      return;
    }

    // ── POST /connect ──────────────────────────────────────────────────────────
    if (path === '/connect' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { type, deviceId, ip, port, comPort, printerName } = JSON.parse(body);

          let result;
          switch (type) {
            case 'usb':
              result = await connectUSB(deviceId);
              break;
            case 'lan':
              result = await connectLAN(ip, port);
              break;
            case 'bluetooth':
              result = await connectBluetooth(comPort);
              break;
            case 'windows':
              printerType = 'windows';
              result = { success: true, type: 'windows', name: printerName || 'Default Printer' };
              break;
            default:
              throw new Error('Tipe koneksi tidak valid: ' + type);
          }

          jsonResponse(res, 200, result);
        } catch (err) {
          jsonResponse(res, 400, { success: false, error: err.message });
        }
      });
      return;
    }

    // ── POST /disconnect ───────────────────────────────────────────────────────
    if (path === '/disconnect' && req.method === 'POST') {
      if (connectedPrinter) {
        try {
          if (typeof connectedPrinter.close === 'function') {
            connectedPrinter.close();
          }
        } catch { /* ignore close errors */ }
      }
      connectedPrinter = null;
      printerType = null;
      jsonResponse(res, 200, { success: true });
      return;
    }

    // ── POST /print ───────────────────────────────────────────────────────────
    if (path === '/print' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);

          let result;
          if (printerType === 'windows') {
            // Build receipt data
            const receiptData = buildReceipt(payload);
            result = await printWindows(payload.printerName || 'POS', receiptData);
          } else if (printerType) {
            const receiptData = buildReceipt(payload);
            result = await printToConnected(receiptData);
          } else {
            // Fallback: return receipt as base64 for client-side handling
            const receiptData = buildReceipt(payload);
            jsonResponse(res, 200, {
              success: true,
              method: 'fallback',
              data: receiptData.toString('base64'),
              message: 'Printer belum terhubung. Gunakan window.print() sebagai fallback.'
            });
            return;
          }

          jsonResponse(res, 200, { success: true, ...result });
        } catch (err) {
          jsonResponse(res, 500, { success: false, error: err.message });
        }
      });
      return;
    }

    // ── POST /print-test ──────────────────────────────────────────────────────
    if (path === '/print-test' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { printerName } = JSON.parse(body) || {};

          const testReceipt = buildReceipt({
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
              { name: 'Cuci Setrika Express', qty: 2, unit: 'kg', price: 7000, subtotal: 14000, fragrance: 'Lavender' },
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

          if (printerType === 'windows') {
            const result = await printWindows(printerName || 'POS', testReceipt);
            jsonResponse(res, 200, { success: true, method: 'windows', ...result });
          } else if (printerType) {
            const result = await printToConnected(testReceipt);
            jsonResponse(res, 200, { success: true, method: printerType, ...result });
          } else {
            jsonResponse(res, 200, {
              success: false,
              error: 'Printer belum terhubung. Hubungkan printer terlebih dahulu.',
              connected: false,
            });
          }
        } catch (err) {
          jsonResponse(res, 500, { success: false, error: err.message });
        }
      });
      return;
    }

    // ── 404 ───────────────────────────────────────────────────────────────────
    jsonResponse(res, 404, { error: 'Endpoint tidak ditemukan' });

  } catch (err) {
    console.error('[ERROR]', err);
    jsonResponse(res, 500, { error: err.message });
  }
});

// ─── Start server ──────────────────────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           WASCHEN PRINT SERVER v1.0.0                        ║
╠══════════════════════════════════════════════════════════════╣
║  Status  : Running                                          ║
║  URL      : http://${HOST}:${PORT}                            ║
║  PID      : ${process.pid}                                           ║
╠══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                 ║
║  GET  /           - Server info                             ║
║  GET  /status     - Connection status                       ║
║  GET  /printers   - List available printers                 ║
║  POST /connect    - Connect to printer                      ║
║  POST /disconnect - Disconnect printer                      ║
║  POST /print      - Print receipt                          ║
║  POST /print-test - Print test page                        ║
╚══════════════════════════════════════════════════════════════╝

  Catatan:
  - Pastikan printer USB/LAN/Bluetooth sudah terhubung
  - Untuk Windows Print, gunakan nama printer default
  - Print server harus jalan di komputer kasir yang sama dengan browser
`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nMenghentikan Print Server...');
  if (connectedPrinter) {
    try {
      if (typeof connectedPrinter.close === 'function') {
        connectedPrinter.close();
      }
    } catch { /* ignore */ }
  }
  server.close(() => {
    console.log('Print Server berhenti.');
    process.exit(0);
  });
});
