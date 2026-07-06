// ─────────────────────────────────────────────────────────────────────────────
// Waschen Export/Import Suite v2.0
// Supports: Excel (xlsx), CSV, PDF — for transactions, customers, services,
//           inventory, reports
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios';
import { rp } from './helpers';

// ─── 1. Generic Excel Exporter ────────────────────────────────────────────────
/**
 * Export array of objects to Excel (.xlsx)
 * @param {object[]} rows
 * @param {object} opts
 *   - filename, sheetName, columns: [{key, header, width}],
 *   - title, subtitle, freezeHeader, autoFilter, bandedRows
 */
export async function exportToExcel(rows, opts = {}) {
  const XLSX = (await import('xlsx')).default;
  const {
    filename = 'laporan',
    sheetName = 'Data',
    columns,
    title,
    subtitle,
    freezeHeader = true,
    autoFilter = true,
    bandedRows = true,
  } = opts;

  if (!rows?.length) throw new Error('Tidak ada data untuk diekspor.');

  const cols = columns || Object.keys(rows[0]).map(k => ({ key: k, header: k }));

  // Build data — title rows + header + data
  const wsData = [];
  if (title) {
    wsData.push([title]);
    if (subtitle) wsData.push([subtitle]);
    wsData.push([]); // spacer
  }

  wsData.push(cols.map(c => c.header));

  rows.forEach((row, i) => {
    wsData.push(cols.map(c => {
      const val = row[c.key];
      if (val == null) return '';
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val ? 'Ya' : 'Tidak';
      if (val instanceof Date) return val.toLocaleDateString('id-ID');
      return String(val);
    }));
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = cols.map(c => ({ wch: c.width || 20 }));

  // Title merge
  if (title) {
    const mergeEnd = cols.length - 1;
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: mergeEnd } }];
  }

  // Freeze + auto-filter on header row
  const headerRow = title ? (subtitle ? 3 : 2) : 0;
  if (freezeHeader) {
    ws['!freeze'] = { xSplit: 0, ySplit: headerRow + 1 };
  }
  if (autoFilter && rows.length > 0) {
    ws['!autofilter'] = { ref: `A${headerRow + 1}:${XLSX.utils.encode_col(cols.length - 1)}${headerRow + 1}` };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}_${timestamp()}.xlsx`);
}

// ─── 2. CSV Exporter ────────────────────────────────────────────────────────────
/**
 * Export to CSV (for large datasets, faster than xlsx)
 */
export async function exportToCSV(rows, opts = {}) {
  const XLSX = (await import('xlsx')).default;
  const { filename = 'laporan', columns, delimiter = ',' } = opts;
  if (!rows?.length) throw new Error('Tidak ada data untuk diekspor.');

  const cols = columns || Object.keys(rows[0]).map(k => ({ key: k, header: k }));
  const wsData = [
    cols.map(c => c.header),
    ...rows.map(row => cols.map(c => {
      const val = row[c.key];
      if (val == null) return '';
      if (typeof val === 'boolean') return val ? 'Ya' : 'Tidak';
      return String(val);
    })),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, `${filename}_${timestamp()}.csv`);
}

// ─── 3. PDF Exporter ───────────────────────────────────────────────────────────
/**
 * Export to PDF with Waschen branding
 */
export async function exportToPDF(rows, opts = {}) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const {
    filename = 'laporan',
    title = 'Laporan Wäschen',
    subtitle,
    columns,
    orientation = 'portrait',
    summary,
    footerText = 'Wäschen Expert Laundry Solutions',
  } = opts;

  if (!rows?.length) throw new Error('Tidak ada data untuk diekspor.');

  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(110, 46, 120); // brand purple
  doc.text(title, margin, 18);
  doc.setTextColor(0);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(subtitle, margin, 26);
    doc.setTextColor(0);
  }

  // Generated date (top right)
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Dicetak: ${new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}`,
    pageWidth - margin, 18, { align: 'right' }
  );
  doc.setTextColor(0);

  let startY = subtitle ? 34 : 28;

  // Summary boxes
  if (summary?.length) {
    const boxW = (pageWidth - margin * 2) / Math.min(summary.length, 3);
    summary.forEach((s, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = margin + col * boxW;
      const y = startY + row * 10;
      doc.setFillColor(245, 238, 247);
      doc.roundedRect(x, y, boxW - 4, 8, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(110, 46, 120);
      doc.text(`${s.label}:`, x + 3, y + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30);
      doc.text(String(s.value), x + 3 + doc.getTextWidth(`${s.label}: `), y + 5.5);
    });
    startY += Math.ceil(summary.length / 3) * 10 + 6;
  }

  const cols = columns || Object.keys(rows[0]).map(k => ({ key: k, header: k }));
  autoTable(doc, {
    startY,
    head: [cols.map(c => c.header)],
    body: rows.map(row => cols.map(c => {
      const v = row[c.key];
      if (v == null) return '';
      if (typeof v === 'number') return v;
      return String(v);
    })),
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2.5, font: 'helvetica' },
    headStyles: {
      fillColor: [110, 46, 120],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 245, 250] },
    columnStyles: cols.reduce((acc, c, i) => {
      if (c.width) acc[i] = { cellWidth: c.width };
      return acc;
    }, {}),
    didDrawPage: (data) => {
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `${footerText} — Halaman ${data.pageNumber}`,
        pageWidth / 2, doc.internal.pageSize.getHeight() - 6,
        { align: 'center' }
      );
      doc.setTextColor(0);
    },
  });

  doc.save(`${filename}_${timestamp()}.pdf`);
}

// ─── 4. API Download (server-generated file) ──────────────────────────────────
/**
 * Download file from API endpoint (server generates CSV/Excel)
 * @param {string} url - API endpoint
 * @param {object} params - query params
 * @param {string} filename - output filename
 */
export async function downloadFromAPI(url, params = {}, filename = 'download') {
  const response = await axios.get(url, {
    params,
    responseType: 'blob',
    timeout: 60000,
  });
  const blob = new Blob([response.data]);
  const contentDisposition = response.headers['content-disposition'];
  const serverFilename = contentDisposition
    ? contentDisposition.match(/filename[^;=\n]*=(?:(\\?['"])(.*?)\1|[^;\n]*)/i)?.[2]
    : null;
  const finalName = serverFilename || `${filename}_${timestamp()}.xlsx`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = finalName;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ─── 5. Excel Template Generator ───────────────────────────────────────────────
/**
 * Generate a blank Excel template for data import
 * @param {object[]} columns - [{key, header, example, required}]
 */
export async function generateImportTemplate(columns, filename = 'template') {
  const XLSX = (await import('xlsx')).default;
  const wsData = [
    columns.map(c => c.header),
    columns.map(c => c.example || ''),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = columns.map(c => ({ wch: Math.max(c.header.length, 30) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, `${filename}_template_${timestamp()}.xlsx`);
}

// ─── 6. Excel Import Parser ────────────────────────────────────────────────────
/**
 * Parse uploaded Excel/CSV file → array of objects
 * @param {File} file
 * @param {object[]} columns - expected columns [{key, header}]
 * @returns {Promise<{data: object[], errors: string[]}>}
 */
export async function parseImportFile(file, columns) {
  const XLSX = (await import('xlsx')).default;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!raw.length) {
          return resolve({ data: [], errors: ['File kosong atau tidak memiliki data.'] });
        }

        // Build header map: normalize both sides
        const headerMap = {};
        const rawHeaders = Object.keys(raw[0]);
        columns.forEach(col => {
          const normalized = col.header.toLowerCase().trim();
          const match = rawHeaders.find(h => h.toLowerCase().trim() === normalized);
          if (match) headerMap[col.key] = match;
        });

        const parsed = [];
        const errors = [];

        raw.forEach((row, i) => {
          const obj = {};
          let rowHasData = false;
          columns.forEach(col => {
            const rawKey = headerMap[col.key];
            const val = rawKey ? row[rawKey] : undefined;
            if (val !== undefined && val !== '' && val !== null) {
              obj[col.key] = val;
              rowHasData = true;
            } else if (col.required) {
              errors.push(`Baris ${i + 2}: kolom "${col.header}" wajib diisi.`);
            }
          });
          if (rowHasData) parsed.push(obj);
        });

        resolve({ data: parsed, errors: errors.slice(0, 50) }); // cap errors
      } catch (err) {
        reject(new Error(`Gagal membaca file: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── 7. Pre-built Exporters for Each Domain ────────────────────────────────────

/** Transaction export */
export async function exportTransactions(rows, format = 'xlsx') {
  const COLS = [
    { key: 'transaction_no', header: 'No. Nota', width: 22 },
    { key: 'customer_name', header: 'Pelanggan', width: 24 },
    { key: 'outlet_name',   header: 'Cabang', width: 20 },
    { key: 'created_at',    header: 'Tanggal', width: 18 },
    { key: 'status',        header: 'Status', width: 14 },
    { key: 'payment_status', header: 'Pembayaran', width: 14 },
    { key: 'subtotal',      header: 'Subtotal', width: 16 },
    { key: 'discount',      header: 'Diskon', width: 12 },
    { key: 'total',         header: 'Total', width: 16 },
    { key: 'paid_amount',   header: 'Terbayar', width: 16 },
    { key: 'remaining',     header: 'Sisa', width: 16 },
    { key: 'created_by_name', header: 'Kasir', width: 18 },
  ];
  const summary = rows.length ? [
    { label: 'Total Transaksi', value: rp(rows.reduce((s, r) => s + Number(r.total || 0), 0)) },
    { label: 'Jumlah Nota', value: rows.length },
    { label: 'Total Terbayar', value: rp(rows.reduce((s, r) => s + Number(r.paid_amount || 0), 0)) },
  ] : [];

  if (format === 'pdf') return exportToPDF(rows, { filename: 'transaksi', title: 'Laporan Transaksi', columns: COLS, summary });
  if (format === 'csv') return exportToCSV(rows, { filename: 'transaksi', columns: COLS });
  return exportToExcel(rows, { filename: 'transaksi', title: 'Laporan Transaksi', columns: COLS, summary });
}

/** Customer export */
export async function exportCustomers(rows, format = 'xlsx') {
  const COLS = [
    { key: 'name',       header: 'Nama', width: 24 },
    { key: 'phone',      header: 'No. HP', width: 16 },
    { key: 'email',      header: 'Email', width: 28 },
    { key: 'membership_status', header: 'Member', width: 12 },
    { key: 'deposit_balance', header: 'Saldo Deposit', width: 16 },
    { key: 'address',    header: 'Alamat', width: 36 },
    { key: 'area_zone',  header: 'Zona', width: 20 },
    { key: 'total_transactions', header: 'Total Nota', width: 12 },
    { key: 'created_at', header: 'Terdaftar', width: 18 },
  ];
  if (format === 'pdf') return exportToPDF(rows, { filename: 'pelanggan', title: 'Daftar Pelanggan', columns: COLS });
  if (format === 'csv') return exportToCSV(rows, { filename: 'pelanggan', columns: COLS });
  return exportToExcel(rows, { filename: 'pelanggan', title: 'Daftar Pelanggan', columns: COLS });
}

/** Service/Layanan export */
export async function exportServices(rows, format = 'xlsx') {
  const COLS = [
    { key: 'name',            header: 'Nama Layanan', width: 24 },
    { key: 'category',        header: 'Kategori', width: 18 },
    { key: 'unit',           header: 'Satuan', width: 12 },
    { key: 'price',          header: 'Harga', width: 14 },
    { key: 'express_price',  header: 'Harga Express', width: 14 },
    { key: 'sla_hours',      header: 'SLA (jam)', width: 12 },
    { key: 'is_active',      header: 'Aktif', width: 10 },
  ];
  if (format === 'pdf') return exportToPDF(rows, { filename: 'layanan', title: 'Daftar Layanan', columns: COLS });
  if (format === 'csv') return exportToCSV(rows, { filename: 'layanan', columns: COLS });
  return exportToExcel(rows, { filename: 'layanan', title: 'Daftar Layanan', columns: COLS });
}

/** Inventory export */
export async function exportInventory(rows, format = 'xlsx') {
  const COLS = [
    { key: 'item_name',     header: 'Nama Barang', width: 24 },
    { key: 'category',     header: 'Kategori', width: 18 },
    { key: 'outlet_name',   header: 'Cabang', width: 20 },
    { key: 'stock',         header: 'Stok', width: 10 },
    { key: 'unit',          header: 'Satuan', width: 12 },
    { key: 'min_stock',     header: 'Min Stok', width: 10 },
    { key: 'last_restock',  header: 'Restock Terakhir', width: 18 },
  ];
  if (format === 'pdf') return exportToPDF(rows, { filename: 'inventory', title: 'Stok Inventori', columns: COLS });
  if (format === 'csv') return exportToCSV(rows, { filename: 'inventory', columns: COLS });
  return exportToExcel(rows, { filename: 'inventory', title: 'Stok Inventori', columns: COLS });
}

/** Financial report export */
export async function exportFinancialReport(rows, format = 'xlsx') {
  const COLS = [
    { key: 'date',          header: 'Tanggal', width: 16 },
    { key: 'outlet_name',   header: 'Cabang', width: 20 },
    { key: 'total_sales',   header: 'Total Penjualan', width: 18 },
    { key: 'total_payment', header: 'Total Pembayaran', width: 18 },
    { key: 'cash',          header: 'Tunai', width: 16 },
    { key: 'transfer',      header: 'Transfer', width: 16 },
    { key: 'qris',          header: 'QRIS', width: 14 },
    { key: 'deposit',       header: 'Deposit', width: 14 },
    { key: 'pending',       header: 'Piutang', width: 16 },
  ];
  const summary = rows.length ? [
    { label: 'Total Penjualan', value: rp(rows.reduce((s, r) => s + Number(r.total_sales || 0), 0)) },
    { label: 'Total Pembayaran', value: rp(rows.reduce((s, r) => s + Number(r.total_payment || 0), 0)) },
  ] : [];
  if (format === 'pdf') return exportToPDF(rows, { filename: 'keuangan', title: 'Laporan Keuangan', columns: COLS, summary });
  if (format === 'csv') return exportToCSV(rows, { filename: 'keuangan', columns: COLS });
  return exportToExcel(rows, { filename: 'keuangan', title: 'Laporan Keuangan', columns: COLS, summary });
}

// ─── 8. Import Templates Config ────────────────────────────────────────────────

/** Template columns for customer import */
export const CUSTOMER_IMPORT_COLS = [
  { key: 'name',    header: 'Nama',         example: 'Budi Santoso',   required: true },
  { key: 'phone',   header: 'No. HP',      example: '081234567890',  required: true },
  { key: 'email',   header: 'Email',        example: 'budi@email.com', required: false },
  { key: 'address', header: 'Alamat',       example: 'Jl. Merdeka No.1', required: false },
  { key: 'zone',    header: 'Zona',         example: 'Zona 1 (0-3 km)', required: false },
];

/** Template columns for service import */
export const SERVICE_IMPORT_COLS = [
  { key: 'name',         header: 'Nama Layanan', example: 'Cuci Kering',   required: true },
  { key: 'category',     header: 'Kategori',     example: 'Cuci',          required: true },
  { key: 'unit',         header: 'Satuan',        example: 'kg',            required: true },
  { key: 'price',        header: 'Harga',         example: '15000',         required: true },
  { key: 'express_price',header: 'Harga Express', example: '30000',         required: false },
  { key: 'sla_hours',    header: 'SLA (jam)',     example: '24',            required: false },
];

/** Template columns for inventory import */
export const INVENTORY_IMPORT_COLS = [
  { key: 'item_name', header: 'Nama Barang', example: 'Deterjen 5L', required: true },
  { key: 'category',  header: 'Kategori',    example: 'Bahan Kimia', required: true },
  { key: 'stock',     header: 'Stok',        example: '50',          required: true },
  { key: 'unit',      header: 'Satuan',      example: 'unit',        required: true },
  { key: 'min_stock', header: 'Min Stok',    example: '10',           required: false },
];

// ─── 9. Utility ────────────────────────────────────────────────────────────────
function timestamp() {
  return new Date().toISOString().slice(0, 10);
}
