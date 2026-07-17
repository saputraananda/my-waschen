/**
 * Preload Script - Secure IPC bridge for Electron
 * Exposes print APIs to React app without exposing Node.js directly
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronPrint', {
  // Get Bluetooth COM ports
  getBluetoothPorts: () => ipcRenderer.invoke('print:getBluetoothPorts'),

  // Get Windows printers
  getWindowsPrinters: () => ipcRenderer.invoke('print:getWindowsPrinters'),

  // Print via Serial (Bluetooth/USB)
  printSerial: (comPort, data) =>
    ipcRenderer.invoke('print:printSerial', { comPort, data }),

  // Print via Windows Print Spooler
  printWindows: (printerName, data) =>
    ipcRenderer.invoke('print:printWindows', { printerName, data }),

  // Open Windows Print Dialog
  openPrintDialog: () => ipcRenderer.invoke('print:openPrintDialog'),

  // Check if running in Electron
  isElectron: true,
});

console.log('[Preload] Print bridge exposed to renderer');
