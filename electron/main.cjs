/**
 * Electron Main Process - Waschen POS
 * Simple print bridge: Bluetooth + USB + LAN via Electron IPC
 */

const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { SerialPort } = require('serialport');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

let mainWindow = null;
const BAUD_RATES = [9600, 19200, 38400, 115200];

// ─── ESC/POS Receipt Builder ─────────────────────────────────────────────────────
const CHAR_PER_LINE = 32; // 58mm thermal

function rp(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); }
function fmt(n) { return (Number(n) || 0).toLocaleString('id-ID'); }
function center(t, w = CHAR_PER_LINE) { return ' '.repeat(Math.max(0, Math.floor((w - t.length) / 2))) + t; }
function padR(t, len) { return String(t).padEnd(len).substring(0, len); }
function padL(t, len) { return String(t).padStart(len).substring(0, len); }
function two(l, r, w = CHAR_PER_LINE) {
  const half = Math.floor(w / 2) - 1;
  return padR(l, half) + ' ' + padL(r, half);
}

function buildReceipt(data) {
  const w = data.charPerLine || CHAR_PER_LINE;
  const chunks = [];

  // Init
  chunks.push(Buffer.from([0x1B, 0x40]));
  chunks.push(Buffer.from([0x1B, 0x74, 0x00]));

  // Header
  chunks.push(Buffer.from([0x1B, 0x61, 0x01])); // center
  chunks.push(Buffer.from([0x1B, 0x45, 0x01])); // bold on
  chunks.push(Buffer.from([0x1B, 0x21, 0x10])); // double height
  chunks.push(Buffer.from((data.outletName || 'MY WASCHEN') + '\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x21, 0x00]));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00]));

  if (data.outletTagline) chunks.push(Buffer.from(data.outletTagline + '\n', 'ascii'));
  if (data.outletAddress) chunks.push(Buffer.from(data.outletAddress + '\n', 'ascii'));
  if (data.outletPhone) chunks.push(Buffer.from('Telp: ' + data.outletPhone + '\n', 'ascii'));

  // Divider
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('-'.repeat(w) + '\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  // Transaksi
  chunks.push(Buffer.from([0x1B, 0x61, 0x00]));
  chunks.push(Buffer.from([0x1B, 0x45, 0x01]));
  chunks.push(Buffer.from(two('No. Nota:', data.transactionNo || '-', w) + '\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00]));

  if (data.showDate !== false && data.transactionDate)
    chunks.push(Buffer.from(two('Tgl:', data.transactionDate, w) + '\n', 'ascii'));
  if (data.showCashier !== false && data.cashierName)
    chunks.push(Buffer.from(two('Kasir:', data.cashierName, w) + '\n', 'ascii'));
  if (data.showEstDone !== false && data.estimatedDone)
    chunks.push(Buffer.from(two('Est. Selesai:', data.estimatedDone, w) + '\n', 'ascii'));

  // Customer
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

  // Items
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

  // Totals
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('-'.repeat(w) + '\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  if (data.subtotal)
    chunks.push(Buffer.from(two('Subtotal:', rp(data.subtotal), w) + '\n', 'ascii'));
  if (data.memberDiscount > 0)
    chunks.push(Buffer.from(two('Diskon:', '-' + rp(data.memberDiscount), w) + '\n', 'ascii'));
  if (data.deliveryFee > 0)
    chunks.push(Buffer.from(two('Ongkir:', rp(data.deliveryFee), w) + '\n', 'ascii'));

  // TOTAL
  chunks.push(Buffer.from([0x1B, 0x45, 0x01]));
  chunks.push(Buffer.from([0x1B, 0x21, 0x10]));
  chunks.push(Buffer.from(two('TOTAL:', rp(data.total || 0), w) + '\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x21, 0x00]));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00]));

  // Pembayaran
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

  // Status
  if (data.paymentStatus) {
    chunks.push(Buffer.from([0x1B, 0x61, 0x01]));
    chunks.push(Buffer.from('[' + data.paymentStatus + ']\n', 'ascii'));
  }

  // Footer
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('-'.repeat(w) + '\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));
  chunks.push(Buffer.from([0x1B, 0x61, 0x01]));
  if (data.footerText) {
    const lines = data.footerText.split('\n');
    for (const line of lines) {
      chunks.push(Buffer.from(line.substring(0, w) + '\n', 'ascii'));
    }
  }

  // Feed + Cut
  chunks.push(Buffer.from([0x1B, 0x64, 0x05]));
  chunks.push(Buffer.from([0x1D, 0x56, 0x00]));

  return Buffer.concat(chunks);
}

function buildTestReceipt() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);

  return buildReceipt({
    outletName: 'MY WASCHEN',
    outletTagline: 'Clean, Fast, Reliable',
    outletAddress: 'Jl. Kemang Raya No.45',
    outletPhone: '021-1234-5678',
    transactionNo: 'TEST-' + Date.now().toString(36).toUpperCase(),
    transactionDate: now.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    cashierName: 'Admin Kasir',
    showDate: true,
    showCashier: true,
    showCustomer: true,
    customerName: 'Budi Santoso',
    showPhone: true,
    customerPhone: '0812-3456-7890',
    showEstDone: true,
    estimatedDone: tomorrow.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
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

// ─── Bluetooth COM Ports via Windows API ─────────────────────────────────────────
async function getBluetoothPorts() {
  try {
    // Method 1: SerialPort.list() - works for USB-Serial adapters
    const ports = await SerialPort.list();
    const comPorts = ports.filter(p => p.comName?.startsWith('COM'));

    // Method 2: WMI for Bluetooth RFCOMM ports
    try {
      const { stdout } = await execAsync(
        `powershell -Command "Get-WmiObject Win32_SerialPort | Where-Object { $_.DeviceID -match 'COM' -and ($_.Description -match 'Bluetooth|RFCOMM|Bluetooth Serial') } | Select-Object DeviceID, Description | ConvertTo-Json -Compress"`
      );
      if (stdout.trim()) {
        const btPorts = JSON.parse(stdout);
        const arr = Array.isArray(btPorts) ? btPorts : [btPorts];
        for (const p of arr) {
          if (p.DeviceID && !comPorts.find(c => c.comName === p.DeviceID)) {
            comPorts.push({
              comName: p.DeviceID,
              manufacturer: 'Bluetooth',
              description: p.Description,
              isBluetooth: true
            });
          }
        }
      }
    } catch { /* WMI failed */ }

    return comPorts.map(p => ({
      comPort: p.comName,
      name: p.description || p.comName,
      manufacturer: p.manufacturer || (p.isBluetooth ? 'Bluetooth' : 'Unknown'),
      isBluetooth: p.isBluetooth || false
    }));
  } catch (err) {
    console.error('[BT] Get ports error:', err.message);
    return [];
  }
}

// ─── Print via Serial (USB or Bluetooth) ────────────────────────────────────────
async function printSerial(comPort, data, baudRate = 9600) {
  return new Promise((resolve, reject) => {
    let port = null;

    const tryBaud = async (baudIdx) => {
      if (baudIdx >= BAUD_RATES.length) {
        reject(new Error(`Failed to connect at all baud rates on ${comPort}`));
        return;
      }

      const rate = BAUD_RATES[baudIdx];
      console.log(`[Print] Trying ${comPort} @ ${rate} baud...`);

      port = new SerialPort({
        path: comPort,
        baudRate: rate,
        autoOpen: false,
      });

      port.open((err) => {
        if (err) {
          console.log(`[Print] ${rate} failed: ${err.message}`);
          port.close(() => tryBaud(baudIdx + 1));
          return;
        }

        console.log(`[Print] Connected @ ${rate} baud!`);

        // Send data
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        port.write(buf, (writeErr) => {
          if (writeErr) {
            port.close();
            reject(writeErr);
            return;
          }

          // Feed + cut for thermal printers
          const escCommands = Buffer.from([
            0x1B, 0x64, 0x04,  // ESC d 4 (feed 4 lines)
            0x1D, 0x56, 0x00,  // GS V 0 (full cut)
          ]);

          port.write(escCommands, () => {
            setTimeout(() => {
              port.close(() => resolve({ success: true, baudRate: rate }));
            }, 200);
          });
        });
      });
    };

    tryBaud(0);
  });
}

// ─── Print via Windows Print Spooler ─────────────────────────────────────────────
async function printWindows(printerName, data) {
  const tempFile = path.join(app.getPath('temp'), `waschen_print_${Date.now()}.bin`);
  fs.writeFileSync(tempFile, Buffer.from(data));

  try {
    // Use Windows copy command to print
    const cmd = `copy /b "${tempFile}" "${printerName || 'POS'}"`;
    await execAsync(cmd);
    return { success: true, method: 'windows' };
  } finally {
    try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
  }
}

// ─── Get Windows Printers ───────────────────────────────────────────────────────
async function getWindowsPrinters() {
  try {
    const { stdout } = await execAsync(
      `powershell -Command "Get-WmiObject Win32_Printer | Where-Object { $_.Status -eq 'OK' } | Select-Object Name, PortName | ConvertTo-Json -Compress"`
    );
    if (stdout.trim()) {
      const printers = JSON.parse(stdout);
      return (Array.isArray(printers) ? printers : [printers]).map(p => ({
        name: p.Name,
        portName: p.PortName
      }));
    }
  } catch { /* ignore */ }
  return [];
}

// ─── Create Main Window ─────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Waschen POS',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../public/icon.png'),
  });

  // Load the app
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Remove menu in production
  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  console.log('[Electron] Window created');
}

// ─── IPC Handlers ───────────────────────────────────────────────────────────────
function setupIPC() {
  // Get COM ports (for Bluetooth/USB)
  ipcMain.handle('print:getPorts', async () => {
    return await getBluetoothPorts();
  });

  // Print nota to thermal printer
  ipcMain.handle('print:nota', async (event, { comPort, notaData }) => {
    try {
      const receipt = buildReceipt(notaData);
      const result = await printSerial(comPort, receipt);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Test print
  ipcMain.handle('print:test', async (event, { comPort }) => {
    try {
      const testData = buildTestReceipt();
      const result = await printSerial(comPort, testData);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Print via Serial (Bluetooth/USB)
  ipcMain.handle('print:printSerial', async (event, { comPort, data }) => {
    try {
      return await printSerial(comPort, data);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Print via Windows
  ipcMain.handle('print:printWindows', async (event, { printerName, data }) => {
    try {
      return await printWindows(printerName, data);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Open Windows Print Dialog (for Bluetooth - user selects printer once)
  ipcMain.handle('print:openPrintDialog', async () => {
    return new Promise((resolve) => {
      // Use PowerShell to open print dialog with the current window
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.print({
          silent: false,
          printBackground: false,
        }, (success, errorType) => {
          resolve({ success, error: errorType });
        });
      } else {
        resolve({ success: false, error: 'No window' });
      }
    });
  });

  console.log('[Electron] IPC handlers registered');
}

// ─── App Events ────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  setupIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

console.log('[Electron] Main process starting...');
