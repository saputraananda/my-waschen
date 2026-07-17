/**
 * Simple Direct Print Test
 * Usage: node simple-test.cjs COM5
 */

const { SerialPort } = require('serialport');

const COM_PORT = process.argv[2] || 'COM5';
const BAUD = 9600;

console.log(`Testing ${COM_PORT} @ ${BAUD} baud...\n`);

// Simple test receipt
function buildTest() {
  return Buffer.from([
    0x1B, 0x40,           // Init
    0x1B, 0x61, 0x01,     // Center
    0x1B, 0x45, 0x01,     // Bold
    0x1B, 0x21, 0x30,     // Double
    'WASCHEN\n',
    0x1B, 0x45, 0x00,     // Bold off
    0x1B, 0x21, 0x00,     // Normal
    'Clean Fast Reliable\n',
    0x1B, 0x2D, 0x01,
    '================================\n',
    0x1B, 0x2D, 0x00,
    0x1B, 0x61, 0x00,     // Left
    'No. Nota : TEST-001\n',
    'Tanggal  : ' + new Date().toLocaleDateString('id-ID') + '\n',
    'Kasir    : Admin\n',
    '--------------------------------\n',
    'Pelanggan: Budi Santoso\n',
    'HP       : 0812-3456-7890\n',
    '--------------------------------\n',
    'LAYANAN:\n',
    '  Cuci Setrika  2 kg\n',
    '    @7000    = 14000\n',
    '  Dry Clean Jas 1 pcs\n',
    '    @45000   = 45000\n',
    '--------------------------------\n',
    'Subtotal   : 59000\n',
    0x1B, 0x45, 0x01,     // Bold
    0x1B, 0x21, 0x10,     // Double height
    'TOTAL      : 59000\n',
    0x1B, 0x21, 0x00,
    0x1B, 0x45, 0x00,
    'Bayar      : 60000\n',
    'Kembalian  :  1000\n',
    0x1B, 0x2D, 0x01,
    '================================\n',
    0x1B, 0x2D, 0x00,
    0x1B, 0x61, 0x01,     // Center
    'Terima Kasih!\n',
    0x1B, 0x64, 0x05,     // Feed
    0x1D, 0x56, 0x00,     // Cut
  ]);
}

// Open, print, close
const port = new SerialPort({
  path: COM_PORT,
  baudRate: BAUD,
});

port.on('open', () => {
  console.log('Port opened!');
  const data = buildTest();
  port.write(data, (err) => {
    if (err) {
      console.log('Write error:', err.message);
      port.close();
      process.exit(1);
    }
    console.log('Data sent! ' + data.length + ' bytes');
    setTimeout(() => {
      port.close(() => {
        console.log('\n✅ SUCCESS! Cek printer!');
        process.exit(0);
      });
    }, 1000);
  });
});

port.on('error', (err) => {
  console.log('Error:', err.message);
  process.exit(1);
});
