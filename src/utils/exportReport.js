// ─────────────────────────────────────────────────────────────────────────────
// Export Report Helper — Excel (XLSX) & PDF (jsPDF)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Export data ke Excel (.xlsx)
 *
 * @param {object[]} rows - Array of objects (each key = column)
 * @param {object} options
 *   - filename: string (without extension)
 *   - sheetName: string
 *   - columns: [{ key, header, width }] — optional, auto-detect if omitted
 *   - title: string — optional header row
 */
export async function exportToExcel(rows, options = {}) {
  const XLSX = (await import('xlsx')).default;

  const {
    filename = 'laporan',
    sheetName = 'Data',
    columns,
    title,
  } = options;

  if (!rows || rows.length === 0) {
    throw new Error('Tidak ada data untuk diekspor.');
  }

  // Build worksheet data
  const wsData = [];

  // Optional title row
  if (title) {
    wsData.push([title]);
    wsData.push([]); // empty row
  }

  // Header row
  const cols = columns || Object.keys(rows[0]).map(k => ({ key: k, header: k }));
  wsData.push(cols.map(c => c.header));

  // Data rows
  rows.forEach(row => {
    wsData.push(cols.map(c => {
      const val = row[c.key];
      // Format numbers nicely
      if (typeof val === 'number') return val;
      if (val instanceof Date) return val.toLocaleDateString('id-ID');
      return val ?? '';
    }));
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  if (columns) {
    ws['!cols'] = columns.map(c => ({ wch: c.width || 18 }));
  }

  // Style title row if present
  if (title) {
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: cols.length - 1 } }];
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Download
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Export data ke PDF (.pdf)
 *
 * @param {object[]} rows
 * @param {object} options
 *   - filename: string
 *   - title: string
 *   - subtitle: string
 *   - columns: [{ key, header, width }]
 *   - orientation: 'portrait' | 'landscape'
 *   - summary: [{ label, value }] — optional summary rows at top
 */
export async function exportToPDF(rows, options = {}) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const {
    filename = 'laporan',
    title = 'Laporan',
    subtitle,
    columns,
    orientation = 'portrait',
    summary,
  } = options;

  if (!rows || rows.length === 0) {
    throw new Error('Tidak ada data untuk diekspor.');
  }

  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, 20);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(subtitle, margin, 28);
    doc.setTextColor(0);
  }

  // Generated date
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Digenerate: ${new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}`,
    pageWidth - margin,
    20,
    { align: 'right' }
  );
  doc.setTextColor(0);

  let startY = subtitle ? 36 : 30;

  // Summary section
  if (summary && summary.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    summary.forEach((s, i) => {
      const x = margin + (i % 3) * ((pageWidth - margin * 2) / 3);
      const y = startY + Math.floor(i / 3) * 8;
      doc.text(`${s.label}: `, x, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(s.value), x + doc.getTextWidth(`${s.label}: `), y);
      doc.setFont('helvetica', 'bold');
    });
    startY += Math.ceil(summary.length / 3) * 8 + 4;
  }

  // Table
  const cols = columns || Object.keys(rows[0]).map(k => ({ key: k, header: k }));
  const tableColumns = cols.map(c => ({ header: c.header, dataKey: c.key }));
  const tableRows = rows.map(row =>
    Object.fromEntries(cols.map(c => [c.key, row[c.key] ?? '']))
  );

  autoTable(doc, {
    startY,
    columns: tableColumns,
    body: tableRows,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [91, 0, 95], // Waschen primary purple
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: cols.reduce((acc, c, i) => {
      if (c.width) acc[i] = { cellWidth: c.width };
      return acc;
    }, {}),
    didDrawPage: (data) => {
      // Footer with page number
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Halaman ${data.pageNumber} — Wäschen Expert Laundry Solutions`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
      doc.setTextColor(0);
    },
  });

  doc.save(`${filename}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Format currency for export
 */
export function fmtCurrency(val) {
  return `Rp ${Number(val || 0).toLocaleString('id-ID')}`;
}

/**
 * Format date for export
 */
export function fmtDate(val) {
  if (!val) return '-';
  try { return new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return String(val); }
}
