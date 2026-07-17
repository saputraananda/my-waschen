/**
 * Simple Thermal Printer Backend
 * Direct connection to 58mm Bluetooth/USB Thermal Printer
 *
 * Usage:
 *   node print-backend.js                        # Interactive menu
 *   node print-backend.js test                  # Test print
 *   node print-backend.js scan                 # Scan COM ports
 *   node print-backend.js print <comPort>       # Print nota
 */

const { SerialPort } = require('serialport');
const http = require('http');
const fs = require('fs');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const PORT = 3456;
const CHAR_PER_LINE = 32; // 58mm thermal = 32 chars

// ─── ESC/POS Helpers ─────────────────────────────────────────────────────────
function rp(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); }
function fmt(n) { return (Number(n) || 0).toLocaleString('id-ID'); }
function center(t, w = CHAR_PER_LINE) { return ' '.repeat(Math.max(0, Math.floor((w - t.length) / 2))) + t; }
function padR(t, len) { return String(t).padEnd(len).substring(0, len); }
function padL(t, len) { return String(t).padStart(len).substring(0, len); }
function two(l, r, w = CHAR_PER_LINE) {
  const half = Math.floor(w / 2) - 1;
  return padR(l, half) + ' ' + padL(r, half);
}

// Build ESC/POS receipt
function buildReceipt(data) {
  const w = data.charPerLine || CHAR_PER_LINE;
  const chunks = [];

  // Init
  chunks.push(Buffer.from([0x1B, 0x40])); // ESC @
  chunks.push(Buffer.from([0x1B, 0x74, 0x00])); // PC437

  // ===== HEADER =====
  chunks.push(Buffer.from([0x1B, 0x61, 0x01])); // center
  chunks.push(Buffer.from([0x1B, 0x45, 0x01])); // bold on
  chunks.push(Buffer.from([0x1B, 0x21, 0x10])); // double height
  chunks.push(Buffer.from((data.outletName || 'MY WASCHEN') + '\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x21, 0x00])); // normal
  chunks.push(Buffer.from([0x1B, 0x45, 0x00])); // bold off

  if (data.outletTagline) chunks.push(Buffer.from(data.outletTagline + '\n', 'ascii'));
  if (data.outletAddress) chunks.push(Buffer.from(data.outletAddress + '\n', 'ascii'));
  if (data.outletPhone) chunks.push(Buffer.from('Telp: ' + data.outletPhone + '\n', 'ascii'));

  // Divider
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('-'.repeat(w) + '\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  // ===== TRANSAKSI =====
  chunks.push(Buffer.from([0x1B, 0x61, 0x00])); // left
  chunks.push(Buffer.from([0x1B, 0x45, 0x01])); // bold
  chunks.push(Buffer.from(two('No. Nota:', data.transactionNo || '-', w) + '\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00])); // bold off

  if (data.showDate !== false && data.transactionDate)
    chunks.push(Buffer.from(two('Tgl:', data.transactionDate, w) + '\n', 'ascii'));
  if (data.showCashier !== false && data.cashierName)
    chunks.push(Buffer.from(two('Kasir:', data.cashierName, w) + '\n', 'ascii'));
  if (data.showEstDone !== false && data.estimatedDone)
    chunks.push(Buffer.from(two('Est. Selesai:', data.estimatedDone, w) + '\n', 'ascii'));

  // ===== CUSTOMER =====
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('-'.repeat(w) + '\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  if (data.showCustomer !== false && data.customerName) {
    chunks.push(Buffer.from([0x1B, 0x45, 0x01]));
    chunks.push(Buffer.from(center(data.customerName, w) + '\n', 'ascii'));
    chunks.push(Buffer.from([0x1B, 0x45, 0x00]));
  }
  if (data.showPhone !== false && data.customerPhone)
    chunks.push(Buffer.from(two('HP:', data.customerPhone, w) + '\n', 'ascii'));
  if (data.showAddress && data.customerAddress)
    chunks.push(Buffer.from(two('Alamat:', data.customerAddress.substring(0, 15), w) + '\n', 'ascii'));

  // ===== ITEMS =====
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('-'.repeat(w) + '\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  chunks.push(Buffer.from([0x1B, 0x45, 0x01]));
  chunks.push(Buffer.from(center('LAYANAN', w) + '\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00]));

  if (data.items && Array.isArray(data.items)) {
    for (const item of data.items) {
      const name = (item.name || item.serviceName || '').substring(0, w);
      chunks.push(Buffer.from(padR(name + (item.isExpress ? ' *' : ''), w) + '\n', 'ascii'));
      if (item.fragrance && data.showFragrance !== false)
        chunks.push(Buffer.from(padR('  Par: ' + item.fragrance, w) + '\n', 'ascii'));
      const priceLine = padR('  ' + item.qty + 'x' + fmt(item.price), Math.floor(w/2)-1) + padL(fmt(item.subtotal || item.price), Math.floor(w/2)-1);
      chunks.push(Buffer.from(priceLine + '\n', 'ascii'));
    }
  }

  // ===== TOTAL =====
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('-'.repeat(w) + '\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  if (data.subtotal)
    chunks.push(Buffer.from(two('Subtotal:', rp(data.subtotal), w) + '\n', 'ascii'));
  if (data.memberDiscount > 0)
    chunks.push(Buffer.from(two('Diskon:', '-' + rp(data.memberDiscount), w) + '\n', 'ascii'));
  if (data.promoDiscount > 0)
    chunks.push(Buffer.from(two('Promo:', '-' + rp(data.promoDiscount), w) + '\n', 'ascii'));
  if (data.deliveryFee > 0)
    chunks.push(Buffer.from(two('Ongkir:', rp(data.deliveryFee), w) + '\n', 'ascii'));

  // TOTAL - bold + double height
  chunks.push(Buffer.from([0x1B, 0x45, 0x01]));
  chunks.push(Buffer.from([0x1B, 0x21, 0x10])); // double height
  chunks.push(Buffer.from(two('TOTAL:', rp(data.total || 0), w) + '\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x21, 0x00]));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00]));

  // ===== PEMBAYARAN =====
  if (data.payMethod) {
    chunks.push(Buffer.from(two('Bayar(' + data.payMethod + '):', rp(data.paidAmount || 0), w) + '\n', 'ascii'));
  }
  if (data.changeAmount > 0)
    chunks.push(Buffer.from(two('Kembalian:', rp(data.changeAmount), w) + '\n', 'ascii'));
  if (data.balance > 0) {
    chunks.push(Buffer.from([0x1B, 0x45, 0x01]));
    chunks.push(Buffer.from(two('SISA:', rp(data.balance), w) + '\n', 'ascii'));
    chunks.push(Buffer.from([0x1B, 0x45, 0x00]));
  }

  // Status badge
  if (data.paymentStatus) {
    chunks.push(Buffer.from([0x1B, 0x61, 0x01])); // center
    chunks.push(Buffer.from('[' + data.paymentStatus + ']\n', 'ascii'));
  }

  // ===== FOOTER =====
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('-'.repeat(w) + '\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));
  chunks.push(Buffer.from([0x1B, 0x61, 0x01])); // center
  if (data.footerText) {
    const lines = data.footerText.split('\n');
    for (const line of lines) {
      chunks.push(Buffer.from(line.substring(0, w) + '\n', 'ascii'));
    }
  }

  // Feed + Cut
  chunks.push(Buffer.from([0x1B, 0x64, 0x05])); // feed 5 lines
  chunks.push(Buffer.from([0x1D, 0x56, 0x00])); // cut

  return Buffer.concat(chunks);
}

// Test receipt
function buildTestReceipt() {
  return buildReceipt({
    outletName: 'MY WASCHEN',
    outletTagline: 'Clean, Fast, Reliable',
    outletAddress: 'Jl. Kemang Raya No.45',
    outletPhone: '021-1234-5678',
    transactionNo: 'TEST-' + Date.now().toString(36).toUpperCase(),
    transactionDate: new Date().toLocaleString('id-ID'),
    cashierName: 'Admin',
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
    charPerLine: CHAR_PER_LINE,
  });
}

// ─── PRINT ENGINE ──────────────────────────────────────────────────────────────
class ThermalPrinter {
  constructor() {
    this.port = null;
    this.comPort = null;
    this.baudRate = 9600;
    this.connected = false;
  }

  // Scan available COM ports
  async scanPorts() {
    try {
      const ports = await SerialPort.list();
      return ports
        .filter(p => p.path && p.path.match(/COM\d+/i))
        .map(p => ({
          path: p.path,
          manufacturer: p.manufacturer || 'Unknown',
          serialNumber: p.serialNumber || '',
        }));
    } catch (err) {
      console.error('Scan error:', err.message);
      return [];
    }
  }

  // Connect to printer
  async connect(comPort, baudRate = 9600) {
    return new Promise((resolve, reject) => {
      if (this.port) {
        this.port.close();
      }

      this.comPort = comPort;
      this.baudRate = baudRate;

      console.log(`[Printer] Connecting to ${comPort} @ ${baudRate}...`);

      this.port = new SerialPort({
        path: comPort,
        baudRate: baudRate,
        autoOpen: false,
      });

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      this.port.open((err) => {
        clearTimeout(timeout);

        if (err) {
          reject(new Error('Failed to open port: ' + err.message));
          return;
        }

        this.connected = true;
        console.log(`[Printer] Connected!`);
        resolve();
      });

      this.port.on('error', (err) => {
        console.error('[Printer] Error:', err.message);
      });

      this.port.on('close', () => {
        this.connected = false;
        console.log('[Printer] Disconnected');
      });
    });
  }

  // Disconnect
  disconnect() {
    if (this.port && this.port.isOpen) {
      this.port.close();
    }
    this.connected = false;
  }

  // Print data
  async print(data) {
    if (!this.connected || !this.port) {
      throw new Error('Printer not connected');
    }

    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

    return new Promise((resolve, reject) => {
      this.port.write(buf, (err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log(`[Printer] Sent ${buf.length} bytes`);
        resolve();
      });
    });
  }

  // Auto-detect baud rate
  async autoConnect(comPort) {
    const BAUD_RATES = [9600, 19200, 38400, 115200];

    for (const baud of BAUD_RATES) {
      try {
        console.log(`[Printer] Trying ${baud} baud...`);
        await this.connect(comPort, baud);
        console.log(`[Printer] Success at ${baud} baud!`);
        return baud;
      } catch (err) {
        if (this.port) this.disconnect();
        continue;
      }
    }

    throw new Error('Could not connect at any baud rate');
  }
}

// ─── HTTP SERVER ───────────────────────────────────────────────────────────────
const printer = new ThermalPrinter();

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true });
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  console.log(`[HTTP] ${req.method} ${path}`);

  try {
    // GET / → Status
    if (path === '/' && req.method === 'GET') {
      jsonResponse(res, 200, {
        service: 'Waschen Print Server',
        version: '1.0.0',
        printer: printer.connected ? printer.comPort : null,
        baudRate: printer.baudRate,
      });
      return;
    }

    // GET /status → Printer status
    if (path === '/status' && req.method === 'GET') {
      jsonResponse(res, 200, {
        connected: printer.connected,
        comPort: printer.comPort,
        baudRate: printer.baudRate,
      });
      return;
    }

    // GET /scan → Scan COM ports
    if (path === '/scan' && req.method === 'GET') {
      const ports = await printer.scanPorts();
      jsonResponse(res, 200, { ports });
      return;
    }

    // POST /connect → Connect to printer
    if (path === '/connect' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          const { comPort, baudRate } = JSON.parse(body);

          if (!comPort) {
            jsonResponse(res, 400, { success: false, error: 'comPort required' });
            return;
          }

          await printer.connect(comPort, baudRate || 9600);
          jsonResponse(res, 200, {
            success: true,
            comPort: printer.comPort,
            baudRate: printer.baudRate,
          });
        } catch (err) {
          jsonResponse(res, 400, { success: false, error: err.message });
        }
      });
      return;
    }

    // POST /print → Print receipt
    if (path === '/print' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          if (!printer.connected) {
            jsonResponse(res, 400, { success: false, error: 'Printer not connected. Call /connect first.' });
            return;
          }

          const data = JSON.parse(body);
          const receipt = buildReceipt(data);
          await printer.print(receipt);

          jsonResponse(res, 200, { success: true, bytes: receipt.length });
        } catch (err) {
          jsonResponse(res, 400, { success: false, error: err.message });
        }
      });
      return;
    }

    // POST /test → Test print
    if (path === '/test' && req.method === 'POST') {
      try {
        if (!printer.connected) {
          jsonResponse(res, 400, { success: false, error: 'Printer not connected' });
          return;
        }

        const receipt = buildTestReceipt();
        await printer.print(receipt);

        jsonResponse(res, 200, { success: true, bytes: receipt.length });
      } catch (err) {
        jsonResponse(res, 400, { success: false, error: err.message });
      }
      return;
    }

    // POST /disconnect
    if (path === '/disconnect' && req.method === 'POST') {
      printer.disconnect();
      jsonResponse(res, 200, { success: true });
      return;
    }

    // 404
    jsonResponse(res, 404, { error: 'Not found' });

  } catch (err) {
    console.error('[ERROR]', err);
    jsonResponse(res, 500, { error: err.message });
  }
});

// ─── CLI MODE ─────────────────────────────────────────────────────────────────
async function cli() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'help';

  console.log('\n========================================');
  console.log('   WASCHEN THERMAL PRINTER BACKEND');
  console.log('========================================\n');

  switch (cmd) {
    case 'scan':
      console.log('Scanning COM ports...\n');
      const ports = await printer.scanPorts();
      if (ports.length === 0) {
        console.log('No COM ports found. Pastikan printer terhubung.\n');
      } else {
        console.log(`Found ${ports.length} COM port(s):\n`);
        for (const p of ports) {
          console.log(`  ${p.path}`);
          console.log(`    Manufacturer: ${p.manufacturer}`);
          console.log('');
        }
        console.log('Tip: Gunakan COM port printer untuk connect\n');
      }
      break;

    case 'test':
      const testPort = args[1] || 'COM3';
      console.log(`Test print ke ${testPort}...\n`);

      try {
        await printer.autoConnect(testPort);
        const receipt = buildTestReceipt();
        await printer.print(receipt);
        console.log(`\n✅ Test print berhasil! ${receipt.length} bytes`);
        console.log('Cek printer - nota test harus keluar!\n');
        printer.disconnect();
      } catch (err) {
        console.log(`\n❌ Gagal: ${err.message}`);
        console.log('\nTips:');
        console.log('1. Pastikan printer menyala');
        console.log('2. Pastikan USB/Bluetooth terconnect');
        console.log('3. Jalankan "scan" untuk lihat port tersedia\n');
      }
      break;

    case 'print':
      const printPort = args[1];
      if (!printPort) {
        console.log('Usage: print-backend.js print COM3\n');
        return;
      }
      console.log(`Connect ke ${printPort}...`);
      try {
        await printer.autoConnect(printPort);
        const receipt = buildTestReceipt();
        await printer.print(receipt);
        console.log(`✅ Print berhasil!\n`);
        printer.disconnect();
      } catch (err) {
        console.log(`❌ Error: ${err.message}\n`);
      }
      break;

    case 'server':
      server.listen(PORT, () => {
        console.log(`HTTP Server running at http://localhost:${PORT}`);
        console.log('');
        console.log('Endpoints:');
        console.log('  GET  /         - Server status');
        console.log('  GET  /status   - Printer status');
        console.log('  GET  /scan     - Scan COM ports');
        console.log('  POST /connect  - Connect to printer');
        console.log('  POST /print    - Print receipt');
        console.log('  POST /test     - Test print');
        console.log('  POST /disconnect');
        console.log('');
      });
      break;

    case 'help':
    default:
      console.log('Commands:');
      console.log('  print-backend.js scan     - Scan COM ports');
      console.log('  print-backend.js test    - Test print ke COM3');
      console.log('  print-backend.js test COM4 - Test print ke COM4');
      console.log('  print-backend.js print COM3 - Direct print');
      console.log('  print-backend.js server  - Start HTTP server');
      console.log('');
      console.log('HTTP Server Mode (for browser):');
      console.log('  print-backend.js server');
      console.log('');
  }
}

// ─── AUTO START ───────────────────────────────────────────────────────────────
if (require.main === module) {
  if (process.argv.length > 2) {
    // CLI mode
    cli();
  } else {
    // Server mode - auto-detect printer
    console.log('========================================');
    console.log('   WASCHEN PRINT SERVER v1.0');
    console.log('========================================\n');
    console.log('Starting server...\n');

    server.listen(PORT, () => {
      console.log(`✅ HTTP Server: http://localhost:${PORT}`);

      // Auto-detect printer
      printer.scanPorts().then((ports) => {
        if (ports.length === 0) {
          console.log('⚠️  Tidak ada COM port ditemukan');
          console.log('   Pastikan printer Bluetooth menyala');
          console.log('   dan USB/Bluetooth cable terhubung\n');
          return;
        }

        // Try each port until one works
        const tryPort = (idx) => {
          if (idx >= ports.length) {
            console.log('⚠️  Tidak ada printer yang merespons\n');
            return;
          }

          const port = ports[idx];
          console.log(`🔍 Mencoba ${port.path}...`);

          printer.autoConnect(port.path)
            .then((baud) => {
              console.log(`✅ Printer connected: ${port.path} @ ${baud} baud\n`);
              console.log('📟 Printer siap! Nota akan otomatis tercetak.\n');
            })
            .catch((err) => {
              console.log(`   ❌ ${port.path}: ${err.message}`);
              tryPort(idx + 1);
            });
        };

        tryPort(0);
      });
    });
  }
}

module.exports = { printer, buildReceipt, buildTestReceipt };
