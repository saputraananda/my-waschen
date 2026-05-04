export const MOCK_DATA = {
  outlets: [
    { id: 1, name: 'Waschen Kemang', address: 'Jl. Kemang Raya No. 12, Jakarta Selatan' },
    { id: 2, name: 'Waschen BSD City', address: 'Jl. BSD Raya No. 8, Tangerang Selatan' },
  ],

  users: [
    { id: 1, name: 'Dian Pratiwi', role: 'kasir', outlet: 1, avatar: 'DP', email: 'dian@waschen.id', pin: '1234' },
    { id: 2, name: 'Budi Santoso', role: 'produksi', outlet: 1, avatar: 'BS', email: 'budi@waschen.id', pin: '5678' },
    { id: 3, name: 'Rina Kusuma', role: 'admin', outlet: 1, avatar: 'RK', email: 'rina@waschen.id', pin: '9012' },
    { id: 4, name: 'Fajar Nugroho', role: 'finance', outlet: 1, avatar: 'FN', email: 'fajar@waschen.id', pin: '3456' },
  ],

  customers: [
    { id: 1, name: 'Sari Dewi Anggraini', phone: '081234567890', email: 'sari@email.com', address: 'Jl. Melati No. 5, Kemang', member: true, memberType: 'Gold', memberExpiry: '2025-12-01', deposit: 1500000, points: 4200, totalTransactions: 38, joinDate: '2023-06-15' },
    { id: 2, name: 'Hendra Wijaya', phone: '082345678901', email: 'hendra@email.com', address: 'Jl. Anggrek No. 12, BSD', member: true, memberType: 'Silver', memberExpiry: '2025-08-20', deposit: 500000, points: 1800, totalTransactions: 15, joinDate: '2024-01-10' },
    { id: 3, name: 'Maya Putri', phone: '083456789012', email: 'maya@email.com', address: 'Jl. Kenanga No. 3, Fatmawati', member: false, memberType: null, memberExpiry: null, deposit: 0, points: 0, totalTransactions: 4, joinDate: '2024-09-22' },
    { id: 4, name: 'Reza Firmansyah', phone: '085567890123', email: 'reza@email.com', address: 'Jl. Dahlia No. 7, Pondok Indah', member: true, memberType: 'Regular', memberExpiry: '2025-06-10', deposit: 250000, points: 750, totalTransactions: 9, joinDate: '2024-03-05' },
    { id: 5, name: 'Lena Oktaviani', phone: '087678901234', email: 'lena@email.com', address: 'Jl. Tulip No. 21, Cilandak', member: false, memberType: null, memberExpiry: null, deposit: 0, points: 0, totalTransactions: 2, joinDate: '2025-01-18' },
  ],

  services: [
    { id: 1, name: 'Cuci Reguler', category: 'Cuci', price: 8000, unit: 'kg', minQty: 3, express: true },
    { id: 2, name: 'Cuci Express', category: 'Cuci', price: 12000, unit: 'kg', minQty: 3, express: false },
    { id: 3, name: 'Cuci + Setrika', category: 'Cuci', price: 12000, unit: 'kg', minQty: 3, express: true },
    { id: 4, name: 'Setrika Saja', category: 'Setrika', price: 7000, unit: 'kg', minQty: 2, express: true },
    { id: 5, name: 'Cuci Sepatu', category: 'Sepatu', price: 45000, unit: 'pasang', minQty: 1, express: true },
    { id: 6, name: 'Cuci Tas', category: 'Tas', price: 75000, unit: 'pcs', minQty: 1, express: false },
    { id: 7, name: 'Cuci Karpet', category: 'Karpet', price: 15000, unit: 'm²', minQty: 1, express: false },
    { id: 8, name: 'Cuci Boneka', category: 'Boneka', price: 35000, unit: 'pcs', minQty: 1, express: true },
  ],

  transactions: [
    {
      id: 'WCH-250426-001', customerId: 1, customerName: 'Sari Dewi Anggraini',
      status: 'selesai', date: '2025-04-26 09:15',
      items: [
        { serviceId: 3, serviceName: 'Cuci + Setrika', qty: 5, unit: 'kg', price: 12000, express: false },
        { serviceId: 5, serviceName: 'Cuci Sepatu', qty: 2, unit: 'pasang', price: 45000, express: false },
      ],
      subtotal: 150000, discount: 30000, total: 120000,
      payment: 'saldo_deposit', delivery: 'ambil_outlet',
      estimateDone: '2025-04-27', outlet: 1, createdBy: 'Dian Pratiwi',
      progress: [
        { stage: 'Diterima', time: '2025-04-26 09:15', pic: 'Dian Pratiwi' },
        { stage: 'Cuci', time: '2025-04-26 10:00', pic: 'Budi Santoso' },
        { stage: 'Setrika', time: '2025-04-26 14:00', pic: 'Budi Santoso' },
        { stage: 'Packing', time: '2025-04-26 16:30', pic: 'Budi Santoso' },
        { stage: 'Selesai', time: '2025-04-26 17:00', pic: 'Budi Santoso' },
      ],
    },
    {
      id: 'WCH-250426-002', customerId: 2, customerName: 'Hendra Wijaya',
      status: 'proses', date: '2025-04-26 10:30',
      items: [
        { serviceId: 1, serviceName: 'Cuci Reguler', qty: 4, unit: 'kg', price: 8000, express: true },
      ],
      subtotal: 64000, discount: 0, total: 64000,
      payment: 'qris', delivery: 'pickup',
      estimateDone: '2025-04-26', outlet: 1, createdBy: 'Dian Pratiwi',
      progress: [
        { stage: 'Diterima', time: '2025-04-26 10:30', pic: 'Dian Pratiwi' },
        { stage: 'Cuci', time: '2025-04-26 11:00', pic: 'Budi Santoso' },
      ],
    },
    {
      id: 'WCH-250426-003', customerId: 3, customerName: 'Maya Putri',
      status: 'baru', date: '2025-04-26 11:45',
      items: [
        { serviceId: 4, serviceName: 'Setrika Saja', qty: 3, unit: 'kg', price: 7000, express: false },
        { serviceId: 8, serviceName: 'Cuci Boneka', qty: 1, unit: 'pcs', price: 35000, express: false },
      ],
      subtotal: 56000, discount: 0, total: 56000,
      payment: 'cash', delivery: 'delivery',
      deliveryDate: '2025-04-27 14:00',
      estimateDone: '2025-04-27', outlet: 1, createdBy: 'Dian Pratiwi',
      progress: [
        { stage: 'Diterima', time: '2025-04-26 11:45', pic: 'Dian Pratiwi' },
      ],
    },
    {
      id: 'WCH-250425-004', customerId: 4, customerName: 'Reza Firmansyah',
      status: 'diambil', date: '2025-04-25 14:00',
      items: [
        { serviceId: 3, serviceName: 'Cuci + Setrika', qty: 6, unit: 'kg', price: 12000, express: false },
      ],
      subtotal: 72000, discount: 0, total: 72000,
      payment: 'transfer', delivery: 'ambil_outlet',
      estimateDone: '2025-04-26', outlet: 1, createdBy: 'Dian Pratiwi',
      progress: [],
    },
    {
      id: 'WCH-250425-005', customerId: 5, customerName: 'Lena Oktaviani',
      status: 'baru', date: '2025-04-26 13:00',
      items: [
        { serviceId: 5, serviceName: 'Cuci Sepatu', qty: 1, unit: 'pasang', price: 45000, express: true },
      ],
      subtotal: 90000, discount: 0, total: 90000,
      payment: 'cash', delivery: 'ambil_outlet',
      estimateDone: '2025-04-27', outlet: 1, createdBy: 'Dian Pratiwi',
      progress: [
        { stage: 'Diterima', time: '2025-04-26 13:00', pic: 'Dian Pratiwi' },
      ],
    },
    {
      id: 'WCH-250424-006', customerId: 1, customerName: 'Sari Dewi Anggraini',
      status: 'dibatalkan', date: '2025-04-24 09:00',
      items: [
        { serviceId: 7, serviceName: 'Cuci Karpet', qty: 4, unit: 'm²', price: 15000, express: false },
      ],
      subtotal: 60000, discount: 12000, total: 48000,
      payment: 'cash', delivery: 'ambil_outlet',
      estimateDone: '2025-04-26', outlet: 1, createdBy: 'Dian Pratiwi',
      cancelReason: 'Customer tidak jadi mencuci',
      progress: [],
    },
  ],

  notifications: [
    { id: 1, type: 'info', title: 'Nota Selesai', message: 'WCH-250426-001 sudah siap diambil', time: '5 menit lalu', read: false },
    { id: 2, type: 'approval', title: 'Pengajuan Pembatalan', message: 'Nota WCH-250424-006 menunggu approval', time: '2 jam lalu', read: false },
    { id: 3, type: 'system', title: 'Deposit Top Up', message: 'Sari Dewi menambah deposit Rp 1.000.000', time: '3 jam lalu', read: true },
    { id: 4, type: 'info', title: 'Member Baru', message: 'Maya Putri mendaftar sebagai member', time: '1 hari lalu', read: true },
  ],

  approvals: [
    { id: 1, type: 'pembatalan', notaId: 'WCH-250424-006', customerName: 'Sari Dewi Anggraini', reason: 'Customer tidak jadi mencuci karpetnya', requestedBy: 'Dian Pratiwi', requestedAt: '2025-04-24 11:30', status: 'pending' },
    { id: 2, type: 'reschedule', notaId: 'WCH-250426-003', customerName: 'Maya Putri', reason: 'Delivery minta dipindah besok sore', requestedBy: 'Dian Pratiwi', requestedAt: '2025-04-26 12:00', status: 'pending' },
  ],
};
