/**
 * Preload Script - Secure IPC bridge for Electron
 * Exposes print APIs to React app without exposing Node.js directly
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronPrint', {
  // Get COM ports
  getPorts: () => ipcRenderer.invoke('print:getPorts'),

  // Print nota (to thermal printer via Serial)
  printNota: (comPort, notaData) =>
    ipcRenderer.invoke('print:nota', { comPort, notaData }),

  // Test print
  testPrint: (comPort) =>
    ipcRenderer.invoke('print:test', { comPort }),

  // Print raw data via Serial
  printSerial: (comPort, data) =>
    ipcRenderer.invoke('print:printSerial', { comPort, data }),

  // Check if running in Electron
  isElectron: true,
});

console.log('[Preload] Print bridge exposed');
