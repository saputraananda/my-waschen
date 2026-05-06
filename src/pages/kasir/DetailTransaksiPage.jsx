import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp, STAGES } from '../../utils/helpers';
import { TopBar, Btn, Badge, Avatar, Divider, ProgressTimeline, Modal, Input } from '../../components/ui';

export default function DetailTransaksiPage({ navigate, screenParams }) {
  const [tx, setTx] = useState(screenParams);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' });

  const showToast = (message, type = 'error') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), 3000);
  };

  useEffect(() => {
    const id = screenParams?.id || screenParams?.transactionNo;
    if (!id) return;
    // Fetch fresh data if we have an ID
    const fetchDetail = async () => {
      setFetching(true);
      try {
        const res = await axios.get(`/api/transactions/${id}`);
        if (res?.data?.data) {
          setTx(res.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch transaction detail:', error);
      } finally {
        setFetching(false);
      }
    };
    fetchDetail();
  }, [screenParams?.id, screenParams?.transactionNo]);

  if (!tx) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Btn onClick={() => navigate('transaksi')}>Kembali</Btn></div>;

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    setLoading(true);
    try {
      await axios.patch(`/api/transactions/${tx.id}/cancel`, { reason: cancelReason.trim() });
      setCancelModal(false);
      navigate('transaksi');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal membatalkan transaksi.';
      showToast(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePickedUp = async () => {
    setActionLoading('pickup');
    try {
      await axios.put(`/api/transactions/${tx.id}/status`, { status: 'diambil' });
      setTx((prev) => ({ ...prev, status: 'diambil' }));
    } catch (err) {
      showToast(err?.response?.data?.message || 'Gagal update status.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden', position: 'relative' }}>
      <TopBar title="Detail Transaksi" onBack={() => navigate('transaksi')} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Header card */}
        <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.primary }}>{tx.id}</span>
            <Badge status={tx.status} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar initials={tx.customerName.split(' ').map((w) => w[0]).join('').slice(0, 2)} size={42} />
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{tx.customerName}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>{tx.customerPhone}</div>
            </div>
          </div>
        </div>

        {/* Items */}
        <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>ITEM LAUNDRY</div>
          {tx.items?.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{item.name}</span>
                  {item.express && <span style={{ background: '#FEF3C7', color: C.warning, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>⚡</span>}
                </div>
                <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{item.qty} {item.unit}</span>
              </div>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{rp((item.price + (item.express ? item.expressExtra || 5000 : 0)) * item.qty)}</span>
            </div>
          ))}
          <Divider my={8} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.n900 }}>Total</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.primary }}>{rp(tx.total)}</span>
          </div>
        </div>

        {/* Info */}
        <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>INFO TRANSAKSI</div>
          {[
            ['Tanggal Masuk', tx.date],
            ['Estimasi Selesai', tx.dueDate || '-'],
            ['Pembayaran', tx.payMethod],
            ['Dibuat oleh', tx.createdBy || '-'],
            tx.pickup && ['Layanan Jemput', '✅ Ya'],
            tx.delivery && ['Layanan Antar', '✅ Ya'],
            tx.notes && ['Catatan', tx.notes],
          ].filter(Boolean).map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>{label}</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n900, textAlign: 'right', maxWidth: '55%' }}>{val}</span>
            </div>
          ))}
        </div>

        {/* Progress */}
        {tx.progress && tx.progress.length > 0 && (
          <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>PROGRESS PRODUKSI</div>
            <ProgressTimeline progress={tx.progress} />
          </div>
        )}
      </div>

      {/* Actions */}
      {toast.visible && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: toast.type === 'success' ? '#DCFCE7' : '#FEE2E2', color: toast.type === 'success' ? '#166534' : '#991B1B', padding: '12px 20px', borderRadius: 12, fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {toast.type === 'success' ? '✓' : '⚠'} {toast.message}
        </div>
      )}

      {tx.status !== 'dibatalkan' && tx.status !== 'diambil' && (
        <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.n100}`, display: 'flex', gap: 10 }}>
          <Btn variant="danger" onClick={() => setCancelModal(true)} style={{ flex: 1 }}>Batalkan</Btn>
          {tx.status === 'selesai' && (
            <Btn variant="success" style={{ flex: 2 }} loading={actionLoading === 'pickup'} onClick={handlePickedUp}>✅ Sudah Diambil</Btn>
          )}
        </div>
      )}

      <Modal visible={cancelModal} onClose={() => setCancelModal(false)} title="Batalkan Transaksi">
        <Input label="Alasan pembatalan" value={cancelReason} onChange={setCancelReason} placeholder="Tuliskan alasan..." />
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={() => setCancelModal(false)} style={{ flex: 1 }}>Batal</Btn>
          <Btn variant="danger" onClick={handleCancel} loading={loading} style={{ flex: 1 }}>Konfirmasi</Btn>
        </div>
      </Modal>
    </div>
  );
}
