/**
 * Robust Print Test with retry
 * Usage: node print-final.cjs COM4
 */

const { SerialPort } = require('serialport');

const COM_PORT = process.argv[2] || 'COM4';
const BAUD = 9600;

console.log(`\n========================================`);
console.log(`   PRINT TEST - ${COM_PORT}`);
console.log(`========================================\n`);

// Simple text print (no ESC/POS first)
function buildSimpleTest() {
  return Buffer.from(`================================
MY WASCHEN
Clean, Fast, Reliable
================================
No. Nota : TEST-001
Tanggal  : ${new Date().toLocaleDateString('id-ID')}
Kasir    : Admin
--------------------------------
Pelanggan: Budi Santoso
HP       : 0812-3456-7890
--------------------------------
LAYANAN:
  Cuci Setrika  2 kg
    @7000    = 14000
  Dry Clean Jas 1 pcs
    @45000   = 45000
--------------------------------
Subtotal   : 59000
TOTAL      : 59000
Bayar      : 60000
Kembalian  :  1000
================================
     Terima Kasih!
================================

`, 'ascii');
}

// ESC/POS test
function buildESCPOS() {
  const chunks = [];

  // Init
  chunks.push(Buffer.from([0x1B, 0x40]));

  // Center + Bold + Double
  chunks.push(Buffer.from([0x1B, 0x61, 0x01])); // center
  chunks.push(Buffer.from([0x1B, 0x45, 0x01])); // bold
  chunks.push(Buffer.from([0x1B, 0x21, 0x30])); // double
  chunks.push(Buffer.from('MY WASCHEN\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00]));
  chunks.push(Buffer.from([0x1B, 0x21, 0x00]));
  chunks.push(Buffer.from('Clean, Fast, Reliable\n', 'ascii'));

  // Divider
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('================================\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  // Left
  chunks.push(Buffer.from([0x1B, 0x61, 0x00]));

  // Info
  chunks.push(Buffer.from('No. Nota : TEST-001\n', 'ascii'));
  chunks.push(Buffer.from('Tanggal  : ' + new Date().toLocaleDateString('id-ID') + '\n', 'ascii'));
  chunks.push(Buffer.from('Kasir    : Admin\n', 'ascii'));

  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('--------------------------------\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  chunks.push(Buffer.from('Pelanggan: Budi Santoso\n', 'ascii'));
  chunks.push(Buffer.from('HP       : 0812-3456-7890\n', 'ascii'));

  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('--------------------------------\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  chunks.push(Buffer.from('LAYANAN:\n', 'ascii'));
  chunks.push(Buffer.from('  Cuci Setrika  2 kg\n', 'ascii'));
  chunks.push(Buffer.from('    @7000    = 14000\n', 'ascii'));
  chunks.push(Buffer.from('  Dry Clean Jas 1 pcs\n', 'ascii'));
  chunks.push(Buffer.from('    @45000   = 45000\n', 'ascii'));

  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('--------------------------------\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  chunks.push(Buffer.from('Subtotal   : 59000\n', 'ascii'));

  // Bold + Double for TOTAL
  chunks.push(Buffer.from([0x1B, 0x45, 0x01]));
  chunks.push(Buffer.from([0x1B, 0x21, 0x10]));
  chunks.push(Buffer.from('TOTAL      : 59000\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x21, 0x00]));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00]));

  chunks.push(Buffer.from('Bayar      : 60000\n', 'ascii'));
  chunks.push(Buffer.from('Kembalian  :  1000\n', 'ascii'));

  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('================================\n', 'ascii'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  // Center footer
  chunks.push(Buffer.from([0x1B, 0x61, 0x01]));
  chunks.push(Buffer.from('Terima Kasih!\n', 'ascii'));

  // Feed + Cut
  chunks.push(Buffer.from([0x1B, 0x64, 0x05]));
  chunks.push(Buffer.from([0x1D, 0x56, 0x00]));

  return Buffer.concat(chunks);
}

// Try printing
async function tryPrint(port) {
  return new Promise((resolve, reject) => {
    console.log('Opening port...');

    const serialPort = new SerialPort({
      path: port,
      baudRate: BAUD,
      autoOpen: false,
    });

    serialPort.open((err) => {
      if (err) {
        reject(new Error('Cannot open: ' + err.message));
        return;
      }

      console.log('✅ Port opened!');
      console.log('Sending data...\n');

      // Wait a bit for printer to be ready
      setTimeout(() => {
        const data = buildESCPOS();
        console.log(`Data size: ${data.length} bytes`);

        serialPort.write(data, (writeErr) => {
          if (writeErr) {
            console.log('❌ Write error:', writeErr.message);
            serialPort.close();
            reject(writeErr);
            return;
          }

          console.log('✅ Data written!');

          // Flush
          serialPort.flush((flushErr) => {
            if (flushErr) {
              console.log('⚠️ Flush error:', flushErr.message);
            } else {
              console.log('✅ Data flushed!');
            }

            // Wait for printer to process
            console.log('\n⏳ Waiting for print...');
            setTimeout(() => {
              serialPort.close((closeErr) => {
                if (closeErr) {
                  console.log('⚠️ Close warning:', closeErr.message);
                }
                console.log('\n✅ DONE! Cek printer!');
                resolve();
              });
            }, 2000);
          });
        });
      }, 500);
    });

    serialPort.on('error', (err) => {
      console.log('❌ Port error:', err.message);
    });

    serialPort.on('close', () => {
      console.log('Port closed');
    });
  });
}

// Run
console.log(`Connecting to ${COM_PORT} @ ${BAUD} baud...\n`);

tryPrint(COM_PORT)
  .then(() => {
    console.log('\n========================================');
    console.log('SUCCESS! Nota harusnya sudah keluar!');
    console.log('========================================\n');
    process.exit(0);
  })
  .catch((err) => {
    console.log('\n========================================');
    console.log('FAILED:', err.message);
    console.log('========================================\n');
    process.exit(1);
  });
