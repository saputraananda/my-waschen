/**
 * Print Test Script - Auto-detect thermal printer
 * Usage: node test-print.js [COM_PORT]
 *        node test-print.js           # Scan all ports
 *        node test-print.js COM3      # Test specific port
 */

const { SerialPort } = require('serialport');
const fs = require('fs');

// ESC/POS Test receipt
function buildTestReceipt() {
  const chunks = [];

  // Initialize
  chunks.push(Buffer.from([0x1B, 0x40]));

  // Header - Center, Bold
  chunks.push(Buffer.from([0x1B, 0x61, 0x01])); // Center
  chunks.push(Buffer.from([0x1B, 0x45, 0x01])); // Bold on
  chunks.push(Buffer.from([0x1B, 0x21, 0x30])); // Double size
  chunks.push(Buffer.from('MY WASCHEN\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00]));
  chunks.push(Buffer.from([0x1B, 0x21, 0x00]));

  chunks.push(Buffer.from('Clean, Fast, Reliable\n', 'utf8'));
  chunks.push(Buffer.from('Jl. Kemang Raya No. 45\n', 'utf8'));
  chunks.push(Buffer.from('Telp: 021-1234-5678\n', 'utf8'));

  // Divider
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('================================\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));

  // Transaction info
  chunks.push(Buffer.from([0x1B, 0x61, 0x00])); // Left
  chunks.push(Buffer.from('No. Nota: TEST-001\n', 'utf8'));
  chunks.push(Buffer.from('Tanggal: ' + new Date().toLocaleString('id-ID') + '\n', 'utf8'));
  chunks.push(Buffer.from('Kasir: Admin\n', 'utf8'));

  // Customer
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('--------------------------------\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));
  chunks.push(Buffer.from('Pelanggan: Budi Santoso\n', 'utf8'));
  chunks.push(Buffer.from('HP: 0812-3456-7890\n', 'utf8'));

  // Items
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('================================\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));
  chunks.push(Buffer.from('LAYANAN:\n', 'utf8'));
  chunks.push(Buffer.from('Cuci Setrika Express\n', 'utf8'));
  chunks.push(Buffer.from('  2 kg x Rp 7.000        Rp 14.000\n', 'utf8'));
  chunks.push(Buffer.from('Dry Cleaning Jas\n', 'utf8'));
  chunks.push(Buffer.from('  1 pcs x Rp 45.000       Rp 45.000\n', 'utf8'));

  // Totals
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('--------------------------------\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));
  chunks.push(Buffer.from('Subtotal:                 Rp 59.000\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x45, 0x01])); // Bold
  chunks.push(Buffer.from([0x1B, 0x21, 0x10])); // Double height
  chunks.push(Buffer.from('TOTAL:                   Rp 59.000\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x21, 0x00]));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00]));
  chunks.push(Buffer.from('Bayar (Tunai):           Rp 60.000\n', 'utf8'));
  chunks.push(Buffer.from('Kembalian:                Rp  1.000\n', 'utf8'));

  // Footer
  chunks.push(Buffer.from([0x1B, 0x2D, 0x01]));
  chunks.push(Buffer.from('================================\n', 'utf8'));
  chunks.push(Buffer.from([0x1B, 0x2D, 0x00]));
  chunks.push(Buffer.from([0x1B, 0x61, 0x01])); // Center
  chunks.push(Buffer.from('Terima kasih!\n', 'utf8'));
  chunks.push(Buffer.from('Cucian >30 hari bukan\n', 'utf8'));
  chunks.push(Buffer.from('tanggung jawab kami.\n', 'utf8'));

  // Feed + Cut
  chunks.push(Buffer.from([0x1B, 0x64, 0x05])); // Feed 5 lines
  chunks.push(Buffer.from([0x1D, 0x56, 0x00])); // Cut

  return Buffer.concat(chunks);
}

// Test a specific port
async function testPort(comPort, baudRate = 9600) {
  return new Promise((resolve) => {
    console.log(`\n🔌 Testing ${comPort} @ ${baudRate} baud...`);

    const port = new SerialPort({
      path: comPort,
      baudRate: baudRate,
      autoOpen: false,
    });

    const timeout = setTimeout(() => {
      port.close();
      resolve({ port: comPort, success: false, error: 'Timeout - no response' });
    }, 3000);

    port.open((err) => {
      if (err) {
        clearTimeout(timeout);
        port.close();
        resolve({ port: comPort, success: false, error: err.message });
        return;
      }

      console.log(`   ✅ Port opened!`);

      // Send test data
      const data = buildTestReceipt();
      port.write(data, (writeErr) => {
        if (writeErr) {
          clearTimeout(timeout);
          port.close();
          resolve({ port: comPort, success: false, error: writeErr.message });
          return;
        }

        console.log(`   ✅ Data sent!`);

        // Wait a bit for printer to process
        setTimeout(() => {
          clearTimeout(timeout);
          port.close(() => {
            console.log(`   ✅ Port closed`);
            resolve({ port: comPort, success: true, baudRate });
          });
        }, 1000);
      });

      port.on('error', (e) => {
        clearTimeout(timeout);
        port.close();
        resolve({ port: comPort, success: false, error: e.message });
      });
    });
  });
}

// Main
async function main() {
  const targetPort = process.argv[2];

  console.log('===========================================');
  console.log('   WASCHEN PRINTER TEST');
  console.log('===========================================');

  if (targetPort) {
    // Test specific port with multiple baud rates
    const BAUD_RATES = [9600, 19200, 38400, 115200];
    for (const baud of BAUD_RATES) {
      const result = await testPort(targetPort, baud);
      if (result.success) {
        console.log('\n🎉 SUCCESS! Printer found at', targetPort, '@', baud, 'baud');
        console.log('   Cek printer - apakah nota sudah keluar?');
        return;
      }
    }
    console.log('\n❌ Printer not responding at', targetPort);
    console.log('   Pastikan:');
    console.log('   1. Printer menyala');
    console.log('   2. Kabel USB/Cable terconnect');
    console.log('   3. Printer Bluetooth sudah paired');
  } else {
    // Scan all COM ports
    const ports = await SerialPort.list();
    const comPorts = ports.filter(p => p.path && p.path.match(/COM\d+/i));

    console.log(`\n📡 Found ${comPorts.length} COM ports\n`);

    for (const port of comPorts) {
      console.log(`Testing ${port.path}...`);
      const result = await testPort(port.path);
      if (result.success) {
        console.log('🎉 SUCCESS! Printer found!');
        console.log('\nCatat COM port ini:', port.path);
        console.log('Baud rate:', result.baudRate);
        console.log('\nSekarang bisa print!');
        return;
      }
    }

    console.log('\n❌ Tidak ada printer yang merespons');
    console.log('\n💡 Tips:');
    console.log('   - Pastikan printer menyala');
    console.log('   - Pastikan USB/Bluetooth connected');
    console.log('   - Cek Windows Device Manager');
  }
}

main().catch(console.error);
