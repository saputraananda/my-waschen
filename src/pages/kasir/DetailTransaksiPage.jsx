import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Badge, Avatar, Divider, ProgressTimeline, Modal, Input, Select } from '../../components/ui';

const PAY_METHOD_LABEL = {
  cash: 'Tunai',
  transfer: 'Transfer',
  deposit: 'Deposit',
  qris: 'QRIS',
  ovo: 'OVO',
  gopay: 'GoPay',
  dana: 'DANA',
  shopeepay: 'ShopeePay',
  mixed: 'Campuran',
};

const PAY_STATUS_LABEL = {
  unpaid: 'Belum lunas',
  partial: 'Sebagian',
  paid: 'Lunas',
  refunded: 'Refund',
  void: 'Void',
};

export default function DetailTransaksiPage({ navigate, screenParams }) {
  const [tx, setTx] = useState(screenParams);
  const [approvalModal, setApprovalModal] = useState(null); // 'cancel_nota' | 'delete_transaction' | null
  const [approvalReason, setApprovalReason] = useState('');
  const [rescheduleModal, setRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [logisticOrders, setLogisticOrders] = useState([]);
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewNote, setReviewNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' });

  const [pelunasanModal, setPelunasanModal] = useState(false);
  const [pelMethod, setPelMethod] = useState('cash');
  const [pelAmountStr, setPelAmountStr] = useState('');
  const [pelCashStr, setPelCashStr] = useState('');
  const [pelLoading, setPelLoading] = useState(false);

  const showToast = (message, type = 'error') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), 3000);
  };

  useEffect(() => {
    const id = screenParams?.id || screenParams?.transactionNo;
    if (!id) return;
    const fetchDetail = async () => {
      setFetching(true);
      try {
        const res = await axios.get(`/api/transactions/${id}`);
        if (res?.data?.data) setTx(res.data.data);
      } catch (error) {
        console.error('Failed to fetch transaction detail:', error);
      } finally {
        setFetching(false);
      }
    };
    fetchDetail();
  }, [screenParams?.id, screenParams?.transactionNo]);

  const refreshDetail = async () => {
    const raw = screenParams?.id || screenParams?.transactionNo;
    if (!raw) return;
    try {
      const res = await axios.get(`/api/transactions/${raw}`);
      if (res?.data?.data) setTx(res.data.data);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch logistic orders for this transaction
  useEffect(() => {
    if (!tx?.id && !tx?.transactionNo) return;
    const fetchLogistics = async () => {
      try {
        const rawId = tx?.transactionNo || tx?.id;
        const res = await axios.get(`/api/logistics?transactionId=${rawId}`);
        setLogisticOrders(res?.data?.data || []);
      } catch (e) { /* no logistics data */ }
    };
    fetchLogistics();
  }, [tx?.id, tx?.transactionNo]);

  if (!tx) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Btn onClick={() => navigate('transaksi')}>Kembali</Btn></div>;

  const handleRequestApproval = async (type) => {
    if (!approvalReason.trim()) return;
    setLoading(true);
    try {
      await axios.post(`/api/transactions/${tx.id}/request-approval`, {
        type,
        reason: approvalReason.trim(),
      });
      setApprovalModal(null);
      setApprovalReason('');
      showToast(
        type === 'cancel_nota'
          ? 'Pengajuan pembatalan dikirim. Menunggu persetujuan Admin.'
          : 'Pengajuan penghapusan dikirim. Menunggu persetujuan Admin.',
        'success'
      );
    } catch (err) {
      showToast(err?.response?.data?.message || 'Gagal mengajukan.');
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      showToast('Tanggal dan jam baru wajib diisi.');
      return;
    }
    const loOrder = logisticOrders.find((lo) => !['done', 'cancelled', 'failed'].includes(lo.status));
    if (!loOrder) {
      showToast('Tidak ada order logistik yang bisa di-reschedule.');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`/api/logistics/${loOrder.id}/reschedule`, {
        new_scheduled_at: `${rescheduleDate}T${rescheduleTime}:00`,
        reason: rescheduleReason || null,
      });
      setRescheduleModal(false);
      setRescheduleDate('');
      setRescheduleTime('');
      setRescheduleReason('');
      showToast('Jadwal berhasil diubah.', 'success');
      // Refresh logistics
      const res = await axios.get(`/api/logistics?transactionId=${tx.id}`);
      setLogisticOrders(res?.data?.data || []);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Gagal mengubah jadwal.');
    } finally {
      setLoading(false);
    }
  };

  const handlePickedUp = async () => {
    setActionLoading('pickup');
    try {
      await axios.put(`/api/transactions/${tx.id}/status`, { status: 'diambil' });
      setTx((prev) => ({ ...prev, status: 'diambil' }));
      setTimeout(() => setReviewModal(true), 500);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Gagal update status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitReview = async () => {
    setLoading(true);
    try {
      await axios.post(`/api/transactions/${tx.id}/review`, {
        rating: reviewRating,
        comment: reviewNote
      });
      showToast('Review berhasil disimpan!', 'success');
      setReviewModal(false);
    } catch (err) {
      showToast('Gagal menyimpan review.');
    } finally {
      setLoading(false);
    }
  };

  const hasLogistics = logisticOrders.length > 0;
  const activeLogistic = logisticOrders.find((lo) => !['done', 'cancelled', 'failed'].includes(lo.status));

  const balanceDue = tx.balanceDue != null
    ? Number(tx.balanceDue)
    : Math.max(0, Number(tx.total || 0) - Number(tx.paidAmount || 0));
  const paymentStatus = tx.paymentStatus || 'paid';
  const needsSettlement = balanceDue > 0.009 && tx.status !== 'dibatalkan';

  const openPelunasan = () => {
    setPelAmountStr(String(Math.round(balanceDue)));
    setPelCashStr('');
    setPelMethod('cash');
    setPelunasanModal(true);
  };

  const submitPelunasan = async () => {
    const payAmt = Number(pelAmountStr);
    if (!Number.isFinite(payAmt) || payAmt <= 0) {
      showToast('Nominal tidak valid.');
      return;
    }
    const tid = tx.transactionUuid || tx.id;
    setPelLoading(true);
    try {
      const body = {
        method: pelMethod,
        payAmount: payAmt,
      };
      if (pelMethod === 'cash' && pelCashStr && Number(pelCashStr) > 0) {
        body.cashReceived = Number(pelCashStr);
      }
      await axios.post(`/api/transactions/${tid}/payments`, body);
      showToast('Pembayaran berhasil dicatat.', 'success');
      setPelunasanModal(false);
      await refreshDetail();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Gagal mencatat pembayaran.');
    } finally {
      setPelLoading(false);
    }
  };
  
  // PERBAIKAN: Safely format avatar initials agar tidak crash
  const customerInitials = (tx?.customerName || 'Unknown')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden', position: 'relative' }}>
      <TopBar title="Detail Transaksi" onBack={() => navigate('transaksi')} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Header card */}
        <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.primary }}>{tx.id || tx.transactionNo}</span>
            <Badge status={tx.status || 'baru'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar initials={customerInitials} size={42} />
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{tx.customerName || 'Pelanggan'}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>{tx.customerPhone || '-'}</div>
            </div>
          </div>
        </div>

        {/* Items */}
        <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>ITEM LAUNDRY</div>
          {tx.items?.map((item, index) => (
            <div key={item.id || `item-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{item.name || item.serviceName}</span>
                  {item.express && <span style={{ background: '#FEF3C7', color: C.warning, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>⚡</span>}
                </div>
                <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{item.qty} {item.unit}</span>
              </div>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>
                {rp((item.price + (item.express ? item.expressExtra || 5000 : 0)) * (item.qty || 1))}
              </span>
            </div>
          ))}
          <Divider my={8} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.n900 }}>Total</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.primary }}>{rp(tx.total || 0)}</span>
          </div>
        </div>

        {/* Pembayaran & pelunasan */}
        <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600 }}>PEMBAYARAN</div>
            <span style={{
              fontFamily: 'Poppins', fontSize: 10, fontWeight: 700,
              padding: '3px 8px', borderRadius: 999,
              background: paymentStatus === 'paid' ? '#DCFCE7' : paymentStatus === 'partial' ? '#FEF3C7' : '#FEE2E2',
              color: paymentStatus === 'paid' ? '#166534' : paymentStatus === 'partial' ? '#92400E' : '#991B1B',
            }}>
              {PAY_STATUS_LABEL[paymentStatus] || paymentStatus}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Terbayar</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{rp(tx.paidAmount || 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Sisa tagihan</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: needsSettlement ? C.danger : C.success }}>{rp(balanceDue)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Metode utama</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n900 }}>
              {PAY_METHOD_LABEL[tx.payMethod] || tx.payMethod || '-'}
            </span>
          </div>
          {tx.payments?.length > 0 && (
            <>
              <Divider my={8} />
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 6 }}>Riwayat pembayaran</div>
              {tx.payments.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n900 }}>{PAY_METHOD_LABEL[p.method] || p.method}</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>
                      {p.recordedAt ? new Date(p.recordedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : ''}
                    </div>
                  </div>
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600 }}>{rp(p.amount)}</span>
                </div>
              ))}
            </>
          )}
          {needsSettlement && (
            <>
              <Divider my={8} />
              <Btn variant="primary" onClick={openPelunasan} style={{ width: '100%' }}>Catat pelunasan</Btn>
            </>
          )}
        </div>

        {/* Info */}
        <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>INFO TRANSAKSI</div>
          {[
            ['Tanggal Masuk', tx.date || tx.createdAt],
            ['Estimasi Selesai', tx.dueDate || '-'],
            ['Status bayar', PAY_STATUS_LABEL[paymentStatus] || paymentStatus],
            ['Pembayaran (metode utama)', PAY_METHOD_LABEL[tx.payMethod] || tx.payMethod || '-'],
            ['Dibuat oleh', tx.createdBy || tx.kasirName || '-'],
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

        {/* Logistics Info */}
        {hasLogistics && (
          <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>LOGISTIK</div>
            {logisticOrders.map((lo) => (
              <div key={lo.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.n50}` }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>
                    {lo.type === 'pickup' ? 'Jemput' : 'Antar'} — {lo.status}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>
                    {lo.scheduledAt ? new Date(lo.scheduledAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </div>
                  {lo.areaZone && <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>{lo.areaZone}</div>}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.primary }}>{rp(lo.deliveryFee)}</div>
              </div>
            ))}
            {activeLogistic && (
              <Btn variant="secondary" onClick={() => setRescheduleModal(true)} style={{ width: '100%', marginTop: 10 }}>Ubah Jadwal</Btn>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast.visible && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: toast.type === 'success' ? '#DCFCE7' : '#FEE2E2', color: toast.type === 'success' ? '#166534' : '#991B1B', padding: '12px 20px', borderRadius: 12, fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {toast.type === 'success' ? '✓' : '⚠'} {toast.message}
        </div>
      )}

      {/* Bottom Actions */}
      <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.n100}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Btn variant="primary" onClick={() => navigate('cetak_nota', { id: tx.id || tx.transactionNo })} style={{ width: '100%' }}>Cetak Nota & Label</Btn>
        {tx.status !== 'dibatalkan' && tx.status !== 'diambil' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="danger" onClick={() => setApprovalModal('cancel_nota')} style={{ flex: 1 }}>Ajukan Pembatalan</Btn>
            <Btn variant="secondary" onClick={() => setApprovalModal('delete_transaction')} style={{ flex: 1, color: '#991B1B', borderColor: '#FCA5A5' }}>Ajukan Hapus</Btn>
          </div>
        )}
        {tx.status === 'selesai' && (
          <Btn variant="success" style={{ width: '100%' }} loading={actionLoading === 'pickup'} onClick={handlePickedUp}>Sudah Diambil</Btn>
        )}
      </div>

      {/* Approval Modal */}
      <Modal visible={!!approvalModal} onClose={() => { setApprovalModal(null); setApprovalReason(''); }} title={approvalModal === 'cancel_nota' ? 'Ajukan Pembatalan' : 'Ajukan Penghapusan'}>
        <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginBottom: 12 }}>
          {approvalModal === 'cancel_nota'
            ? 'Pengajuan pembatalan akan dikirim ke Admin untuk disetujui.'
            : 'Pengajuan penghapusan (soft-delete) akan dikirim ke Admin. Data tetap ada di database untuk audit keuangan.'}
        </div>
        <Input label="Alasan" value={approvalReason} onChange={setApprovalReason} placeholder="Tuliskan alasan..." />
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <Btn variant="secondary" onClick={() => { setApprovalModal(null); setApprovalReason(''); }} style={{ flex: 1 }}>Batal</Btn>
          <Btn variant="danger" onClick={() => handleRequestApproval(approvalModal)} loading={loading} style={{ flex: 1 }}>Kirim Pengajuan</Btn>
        </div>
      </Modal>

      {/* Reschedule Modal */}
      <Modal visible={rescheduleModal} onClose={() => setRescheduleModal(false)} title="Ubah Jadwal Logistik">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <Input label="Tanggal Baru" value={rescheduleDate} onChange={setRescheduleDate} type="date" />
          </div>
          <div style={{ flex: 1 }}>
            <Input label="Jam" value={rescheduleTime} onChange={setRescheduleTime} type="time" />
          </div>
        </div>
        <Input label="Alasan (opsional)" value={rescheduleReason} onChange={setRescheduleReason} placeholder="Alasan reschedule..." />
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <Btn variant="secondary" onClick={() => setRescheduleModal(false)} style={{ flex: 1 }}>Batal</Btn>
          <Btn variant="primary" onClick={handleReschedule} loading={loading} style={{ flex: 1 }}>Simpan Jadwal</Btn>
        </div>
      </Modal>

      {/* Pelunasan */}
      <Modal visible={pelunasanModal} onClose={() => setPelunasanModal(false)} title="Catat pelunasan">
        <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginBottom: 12 }}>
          Sisa tagihan: <strong>{rp(balanceDue)}</strong>. Nominal di bawah tidak boleh melebihi sisa (kelebihan tunai dihitung kembalian).
        </div>
        <Select
          label="Metode"
          value={pelMethod}
          onChange={setPelMethod}
          options={[
            { value: 'cash', label: 'Tunai' },
            { value: 'transfer', label: 'Transfer Bank' },
            { value: 'qris', label: 'QRIS' },
            { value: 'deposit', label: 'Deposit member' },
            { value: 'ovo', label: 'OVO' },
            { value: 'gopay', label: 'GoPay' },
            { value: 'dana', label: 'DANA' },
            { value: 'shopeepay', label: 'ShopeePay' },
          ]}
        />
        <Input label="Nominal ke tagihan (Rp)" value={pelAmountStr} onChange={setPelAmountStr} type="number" placeholder={String(Math.round(balanceDue))} />
        {pelMethod === 'cash' && (
          <Input
            label="Uang diterima (opsional, untuk kembalian)"
            value={pelCashStr}
            onChange={setPelCashStr}
            type="number"
            placeholder="Jika lebih besar dari nominal, sisanya kembalian"
          />
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Btn variant="secondary" onClick={() => setPelunasanModal(false)} style={{ flex: 1 }}>Batal</Btn>
          <Btn variant="primary" onClick={submitPelunasan} loading={pelLoading} style={{ flex: 1 }}>Simpan</Btn>
        </div>
      </Modal>

      {/* Review Modal */}
      <Modal visible={reviewModal} onClose={() => setReviewModal(false)} title="Customer Review">
        <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600, marginBottom: 16, textAlign: 'center' }}>
          Tanyakan kepada {tx?.customerName || 'pelanggan'} bagaimana pengalaman laundry-nya hari ini.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button 
              key={star} 
              onClick={() => setReviewRating(star)} 
              style={{ background: 'none', border: 'none', fontSize: 36, color: star <= reviewRating ? '#FBBF24' : C.n200, cursor: 'pointer' }}
            >
              ★
            </button>
          ))}
        </div>
        <Input label="Komentar / Feedback" value={reviewNote} onChange={setReviewNote} placeholder="Komentar pelanggan..." />
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Btn variant="secondary" onClick={() => setReviewModal(false)} style={{ flex: 1 }}>Nanti Saja</Btn>
          <Btn variant="primary" onClick={handleSubmitReview} loading={loading} style={{ flex: 1 }}>Simpan Review</Btn>
        </div>
      </Modal>
    </div>
  );
};