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
      preload: path.join(__dirname, 'preload.cjs'),
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
  // Get Bluetooth COM ports
  ipcMain.handle('print:getBluetoothPorts', async () => {
    return await getBluetoothPorts();
  });

  // Get Windows printers
  ipcMain.handle('print:getWindowsPrinters', async () => {
    return await getWindowsPrinters();
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
