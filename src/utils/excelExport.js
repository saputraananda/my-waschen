// ─────────────────────────────────────────────────────────────────────────────
// Excel Export helper — pakai xlsx library
// ─────────────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';

/**
 * Export array of objects ke file Excel (.xlsx)
 * @param {Array<Object>} rows - data rows
 * @param {string} filename - tanpa extension (akan otomatis ditambah .xlsx)
 * @param {string} sheetName - nama sheet (max 31 char)
 * @param {Array<{key, label, format?}>} [columns] - kalau diisi, mapping kolom kustom
 */
export function exportToExcel(rows, filename = 'laporan', sheetName = 'Sheet1', columns = null) {
  if (!Array.isArray(rows) || rows.length === 0) {
    alert('Tidak ada data untuk di-export.');
    return;
  }

  let worksheetData;
  if (columns) {
    // Header row
    const header = columns.map(c => c.label);
    // Data rows
    const dataRows = rows.map(r => columns.map(c => {
      const value = r[c.key];
      if (typeof c.format === 'function') return c.format(value, r);
      return value ?? '';
    }));
    worksheetData = [header, ...dataRows];
  } else {
    // Auto: pakai keys dari first row
    const keys = Object.keys(rows[0]);
    worksheetData = [keys, ...rows.map(r => keys.map(k => r[k] ?? ''))];
  }

  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Auto-width kolom (estimasi dari panjang konten)
  const colWidths = worksheetData[0].map((_, colIdx) => {
    let max = String(worksheetData[0][colIdx] || '').length;
    for (let i = 1; i < worksheetData.length; i++) {
      const v = String(worksheetData[i][colIdx] ?? '');
      if (v.length > max) max = v.length;
    }
    return { wch: Math.min(50, Math.max(10, max + 2)) };
  });
  ws['!cols'] = colWidths;

  // Bold header
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[cell]) {
      ws[cell].s = { font: { bold: true } };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  // Tambah timestamp ke filename
  const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  XLSX.writeFile(wb, `${filename}-${ts}.xlsx`);
}

/**
 * Export laporan revenue harian dengan multiple sheets
 */
export function exportLaporanRevenue(data, filename = 'laporan-revenue') {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  if (data.summary) {
    const summaryRows = [
      ['Metrik', 'Nilai'],
      ['Total Pendapatan', data.summary.revenue || 0],
      ['Total Transaksi', data.summary.txCount || 0],
      ['Rata-rata Per Transaksi', data.summary.avgPerTx || 0],
      ['Rata-rata Harian', data.summary.avgPerDay || 0],
      ['Periode', data.period?.label || '-'],
      ['Dari', data.period?.startDate || '-'],
      ['Sampai', data.period?.endDate || '-'],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws1['!cols'] = [{ wch: 30 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan');
  }

  // Sheet 2: Daily breakdown
  if (Array.isArray(data.daily) && data.daily.length > 0) {
    const dailyRows = [
      ['Tanggal', 'Hari', 'Pendapatan (Rp)', 'Transaksi', 'Target', 'Tercapai (%)'],
      ...data.daily.map(d => [
        d.date,
        new Date(d.date).toLocaleDateString('id-ID', { weekday: 'long' }),
        d.revenue || 0,
        d.txCount || 0,
        d.target || 0,
        d.target > 0 ? Math.round((d.revenue / d.target) * 100) : 0,
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(dailyRows);
    ws2['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Harian');
  }

  // Sheet 3: Payment mix
  if (Array.isArray(data.paymentMix) && data.paymentMix.length > 0) {
    const payRows = [
      ['Metode', 'Transaksi', 'Pendapatan (Rp)', 'Persentase (%)'],
      ...data.paymentMix.map(p => [
        p.method || '-',
        p.txCount || 0,
        p.revenue || 0,
        p.percentage || 0,
      ]),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(payRows);
    ws3['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Metode Pembayaran');
  }

  // Sheet 4: Top services
  if (Array.isArray(data.topServices) && data.topServices.length > 0) {
    const svcRows = [
      ['#', 'Layanan', 'Dipesan', 'Pendapatan (Rp)'],
      ...data.topServices.map((s, i) => [
        i + 1,
        s.name || '-',
        s.count || 0,
        s.revenue || 0,
      ]),
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(svcRows);
    ws4['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Top Layanan');
  }

  const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  XLSX.writeFile(wb, `${filename}-${ts}.xlsx`);
}
