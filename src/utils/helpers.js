export const rp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');

export const STAGES = ['Diterima', 'Cuci', 'Pengeringan', 'Setrika', 'Packing', 'Selesai'];

export const STATUS_COLORS = {
  baru: { bg: '#EFF6FF', text: '#2563EB' },
  proses: { bg: '#FFF7ED', text: '#F59E0B' },
  selesai: { bg: '#ECFDF5', text: '#10B981' },
  diambil: { bg: '#F6F1F7', text: '#475569' },
  dibatalkan: { bg: '#FEF2F2', text: '#EF4444' },
  Gold: { bg: '#FEF9C3', text: '#92400E' },
  Silver: { bg: '#F6F1F7', text: '#475569' },
  Regular: { bg: '#F3E6F5', text: '#5B005F' },
  pending: { bg: '#FFF7ED', text: '#F59E0B' },
  approved: { bg: '#ECFDF5', text: '#10B981' },
  rejected: { bg: '#FEF2F2', text: '#EF4444' },
};
