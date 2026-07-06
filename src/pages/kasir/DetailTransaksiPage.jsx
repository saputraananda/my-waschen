import { useState, useEffect } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp, photoTypeLabel, getTransactionItemLineTotal } from '../../utils/helpers';
import { TopBar, Btn, Badge, Avatar, Divider, ProgressTimeline, Modal, Input, Select, MoneyInput, DateTimeInput } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';

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

export default function DetailTransaksiPage({ navigate, goBack, screenParams }) {
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

  const [pelunasanModal, setPelunasanModal] = useState(false);
  const [pelMethod, setPelMethod] = useState('cash');
  const [pelAmountStr, setPelAmountStr] = useState('');
  const [pelCashStr, setPelCashStr] = useState('');
  const [pelLoading, setPelLoading] = useState(false);

  // Edit delivery type
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [dlvType, setDlvType] = useState('self');
  const [dlvSchedule, setDlvSchedule] = useState('');
  const [dlvNotes, setDlvNotes] = useState('');
  const [dlvLoading, setDlvLoading] = useState(false);

  // Collapsible sections
  const [itemsOpen, setItemsOpen] = useState(true);
  const [payOpen, setPayOpen] = useState(true);

  // Packing info editor
  const [packingModal, setPackingModal] = useState(null); // { id, name, packingNeeded, packingNotes }
  const [pkgNeeded, setPkgNeeded] = useState(1);
  const [pkgNotes, setPkgNotes] = useState('');
  const [pkgSaving, setPkgSaving] = useState(false);

  const openPackingModal = (item) => {
    setPackingModal(item);
    setPkgNeeded(Number(item.packingNeeded) || 1);
    setPkgNotes(item.packingNotes || '');
  };

  const savePackingInfo = async () => {
    if (!packingModal) return;
    setPkgSaving(true);
    try {
      await axios.patch(`/api/transactions/${tx.id}/items/${packingModal.id}/packing`, {
        packingNeeded: pkgNeeded,
        packingNotes: pkgNotes || null,
      });
      setTx(prev => ({
        ...prev,
        items: (prev.items || []).map(i =>
          i.id === packingModal.id ? { ...i, packingNeeded: pkgNeeded, packingNotes: pkgNotes } : i
        ),
      }));
      setPackingModal(null);
      alertSuccess('Info packing disimpan.');
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyimpan info packing.');
    } finally {
      setPkgSaving(false);
    }
  };

  // Copy ID
  const [copied, setCopied] = useState(false);
  const handleCopyId = () => {
    const txId = tx?.id || tx?.transactionNo || '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txId).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  // Documentation photos
  const [docPhotos, setDocPhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(null); // { current, total, status }

  const handleAddPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      const txId = tx?.id || tx?.transactionNo;
      if (!txId) {
        alertError('Transaksi belum siap. Coba refresh dulu.');
        return;
      }

      setPhotoUploading(true);
      setPhotoProgress({ current: 0, total: files.length, status: 'compress' });

      try {
        const { uploadImage } = await import('../../utils/imageUpload');
        const compressed = [];
        // Compress satu-satu dengan progress
        for (let i = 0; i < files.length; i++) {
          setPhotoProgress({ current: i + 1, total: files.length, status: 'compress' });
          const result = await uploadImage(files[i], 'documentation');
          compressed.push({ url: result.dataUrl, type: 'initial_condition' });
        }

        // Upload semua sekaligus ke server (1 round-trip)
        setPhotoProgress({ current: files.length, total: files.length, status: 'upload' });
        await axios.post(`/api/transactions/${txId}/condition`, {
          photos: compressed,
          notes: 'Lampiran dari kasir',
          isDamage: false,
          phase: 'receive',
        });

        // Refresh detail untuk dapat foto dari server (dengan id real, bukan local)
        await refreshDetail();
        setDocPhotos([]); // clear local preview
        alertSuccess(`${compressed.length} foto berhasil disimpan.`);
      } catch (err) {
        const msg = err?.response?.data?.message || err.message || 'Gagal mengupload foto.';
        alertError(msg);
      } finally {
        setPhotoUploading(false);
        setPhotoProgress(null);
      }
    };
    input.click();
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
      alertSuccess(
        type === 'cancel_nota'
          ? 'Pengajuan pembatalan dikirim. Menunggu persetujuan Admin.'
          : 'Pengajuan penghapusan dikirim. Menunggu persetujuan Admin.',
      );
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal mengajukan.');
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      alertWarning('Tanggal dan jam baru wajib diisi.');
      return;
    }
    const loOrder = logisticOrders.find((lo) => !['done', 'cancelled', 'failed'].includes(lo.status));
    if (!loOrder) {
      alertWarning('Tidak ada order logistik yang bisa di-reschedule.');
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
      alertSuccess('Jadwal berhasil diubah.');
      // Refresh logistics
      const res = await axios.get(`/api/logistics?transactionId=${tx.id}`);
      setLogisticOrders(res?.data?.data || []);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal mengubah jadwal.');
    } finally {
      setLoading(false);
    }
  };

  const handlePickedUp = async () => {
    // ── Guard: tagihan belum lunas tidak boleh diambil ──────────────────────
    const balanceDueNow = Math.max(0, Number(tx.total || 0) - Number(tx.paidAmount || 0));
    if (balanceDueNow > 0) {
      alertError(
        `Cucian belum bisa diambil. Tagihan masih kurang ${rp(balanceDueNow)}. Selesaikan pembayaran dulu.`,
        { title: '⚠️ Belum Lunas' }
      );
      return;
    }
    setActionLoading('pickup');
    try {
      await axios.put(`/api/transactions/${tx.id}/status`, { status: 'diambil' });
      setTx((prev) => ({ ...prev, status: 'diambil' }));
      // Replace history depth supaya kalau user back, langsung ke dashboard/transaksi list
      // (bukan ke halaman pelunasan / QR yang sudah selesai sebelumnya)
      try {
        window.history.replaceState(
          { screen: 'detail_transaksi', params: { id: tx.id }, depth: 0 },
          '',
          window.location.pathname,
        );
      } catch (e) {
        // Silent fail - history.replaceState tidak kritis
 console.warn('Failed to replace history state:', e?.message);
      }
      setTimeout(() => setReviewModal(true), 500);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal update status.');
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
      alertSuccess('Review berhasil disimpan!');
      setReviewModal(false);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyimpan review.');
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

  const openDeliveryModal = () => {
    const pt = tx?.pickupType || 'self';
    setDlvType(pt);
    setDlvSchedule('');
    setDlvNotes('');
    setDeliveryModal(true);
  };

  const submitDeliveryChange = async () => {
    setDlvLoading(true);
    try {
      const tid = tx.transactionUuid || tx.id;
      const body = { pickupType: dlvType, notes: dlvNotes || undefined };
      if (dlvSchedule) body.scheduleAt = dlvSchedule;
      const res = await axios.patch(`/api/transactions/${tid}/delivery-type`, body);
      alertSuccess('Jenis pengantaran berhasil diubah.');
      setDeliveryModal(false);
      setTx((prev) => ({
        ...prev,
        pickupType: dlvType,
        deliveryFee: res.data?.data?.deliveryFee ?? prev.deliveryFee,
        total: res.data?.data?.total ?? prev.total,
      }));
      await refreshDetail();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal mengubah pengantaran.');
    } finally {
      setDlvLoading(false);
    }
  };

  const submitPelunasan = async () => {
    const payAmt = Number(pelAmountStr);
    if (!Number.isFinite(payAmt) || payAmt <= 0) {
      alertWarning('Nominal tidak valid.');
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
      alertSuccess('Pembayaran berhasil dicatat.');
      setPelunasanModal(false);
      await refreshDetail();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal mencatat pembayaran.');
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
      <TopBar title="Detail Transaksi" onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Header card */}
        <div style={{ background: `linear-gradient(135deg, ${C.primary}08, ${C.white})`, borderRadius: 16, padding: '16px 16px', marginBottom: 14, boxShadow: SHADOW.md, border: `1px solid ${C.n100}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900 }}>{tx.customerName || 'Pelanggan'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="C.n600" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: 'C.n600' }}>{tx.customerPhone || '-'}</span>
              </div>
            </div>
            <Badge status={tx.status || 'baru'} />
          </div>

          {/* Total + Type — prominent */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, padding: '10px 14px', background: C.white, borderRadius: 12, border: `1.5px solid ${C.n100}` }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 800, color: C.n900 }}>
              {rp(tx.total || 0)}
            </div>
            <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: tx.isExpress ? 'C.warning' : 'C.n600', background: tx.isExpress ? 'C.warningBg' : C.n100, padding: '3px 10px', borderRadius: 999 }}>
              {tx.isExpress ? '⚡ Express' : '📦 Reguler'}
            </span>
          </div>

          {/* Transaction ID + Copy */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 10px', background: C.n50, borderRadius: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="C.n600" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
            <span style={{ fontFamily: 'Poppins', fontSize: 11, color: 'C.n600', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tx.id || tx.transactionNo}
            </span>
            <button onClick={handleCopyId} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: `1px solid ${C.n200}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: copied ? C.success : C.primary }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
              {copied ? 'Tersalin!' : 'Salin'}
            </button>
          </div>
        </div>

        {/* Rincian Transaksi — collapsible */}
        <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 14, boxShadow: SHADOW.sm }}>
          <button onClick={() => setItemsOpen(!itemsOpen)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: itemsOpen ? 12 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'C.infoBg', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🧺</div>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>Rincian Layanan</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'C.infoBg', color: 'C.info' }}>{tx.items?.length || 0}</span>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="C.n600" strokeWidth="2.5" strokeLinecap="round" style={{ transform: itemsOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          {itemsOpen && (
            <>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'C.n600', marginBottom: 8 }}>Ketuk layanan untuk melihat detail & linimasanya</div>
              {tx.items?.map((item, index) => {
                const itemStatus = tx.status === 'selesai' || tx.status === 'diambil' ? 'Selesai' : tx.status === 'proses' ? 'Dalam proses pengerjaan' : 'Menunggu pengerjaan';
                const itemStatusColor = tx.status === 'selesai' || tx.status === 'diambil' ? C.success : tx.status === 'proses' ? 'C.info' : 'C.n600';
                const pkgNeededVal = Number(item.packingNeeded) || 1;
                const pkgDoneVal = Number(item.packingDone) || 0;
                return (
                  <div key={item.id || `item-${index}`} style={{ background: C.n50, borderRadius: 10, marginBottom: 6, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                      <div style={{ width: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.primary }}>
                          {item.unit === 'm2' ? Number(item.qty).toFixed(2) : item.qty}
                        </span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 9, color: 'C.n600', textTransform: 'uppercase' }}>{item.unit === 'm2' ? 'm²' : item.unit}</span>
                      </div>
                      <div style={{ flex: 1, borderLeft: `2px solid ${C.n200}`, paddingLeft: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{item.name || item.serviceName}</span>
                          {item.express && <span style={{ background: 'C.warningBg', color: C.warning, fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999 }}>⚡</span>}
                          {item.unit === 'm2' && <span style={{ background: 'C.infoBg', color: 'C.info', fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999 }}>📐 Karpet</span>}
                        </div>
                        {/* Carpet dimensions */}
                        {item.unit === 'm2' && item.carpetPanjangCm && item.carpetLebarCm && (
                          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'C.info', marginTop: 2 }}>
                            📏 {item.carpetPanjangCm} cm × {item.carpetLebarCm} cm = {Number(item.qty).toFixed(2)} m²
                          </div>
                        )}
                        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: itemStatusColor, marginTop: 2 }}>{itemStatus}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <span style={{ fontFamily: 'Poppins', fontSize: 10, color: 'C.n600', background: 'C.infoBg', padding: '1px 7px', borderRadius: 999, fontWeight: 600 }}>
                            📦 {pkgDoneVal}/{pkgNeededVal} paket
                          </span>
                          {item.packingNotes && (
                            <span style={{ fontFamily: 'Poppins', fontSize: 10, color: 'C.warning' }}>· {item.packingNotes}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => openPackingModal(item)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6 }}
                        title="Edit packing"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
              <Divider my={8} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: C.n900 }}>Total</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900 }}>{rp(tx.total || 0)}</span>
              </div>
            </>
          )}
        </div>

        {/* Dokumentasi produksi (foto terima & packing) */}
        <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 14, boxShadow: SHADOW.sm }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'C.warningBg', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📷</div>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>Bukti Foto Produksi</span>
            </div>
            {tx.production && (
              <div style={{ display: 'flex', gap: 4 }}>
                {tx.production.hasReceivePhoto && <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 999, background: 'C.infoBg', color: 'C.info' }}>📥 Terima</span>}
                {tx.production.hasPackingPhoto && <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 999, background: 'C.successBg', color: 'C.success' }}>📦 Packing</span>}
              </div>
            )}
          </div>
          {(tx.conditionPhotos || []).filter((p) => p.url && p.url !== 'note_only').length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(tx.conditionPhotos || []).filter((p) => p.url && p.url !== 'note_only').map((p) => (
                <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <a href={p.url} target="_blank" rel="noreferrer">
                    <img src={p.url} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.n200}` }} />
                  </a>
                  <div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n800 }}>{photoTypeLabel(p.type)}</div>
                    {p.notes && <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'C.n600' }}>{p.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'C.n600', textAlign: 'center', padding: 14 }}>
              Belum ada foto dari tim produksi
            </div>
          )}
          {docPhotos.length > 0 && (
            <>
              <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: 'C.n600', margin: '12px 0 8px' }}>Lampiran kasir (belum disimpan ke server)</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {docPhotos.map((p) => (
                  <div key={p.id} style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.n200}` }}>
                    <img src={p.src} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            </>
          )}
          {photoUploading && photoProgress && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'C.infoBg', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 16, height: 16, border: `2px solid ${C.info}`, borderTopColor: C.info, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontFamily: 'Poppins', fontSize: 11, color: 'C.info', fontWeight: 600 }}>
                {photoProgress.status === 'compress'
                  ? `Mengompres foto ${photoProgress.current}/${photoProgress.total}…`
                  : `Mengirim ke server…`}
              </span>
            </div>
          )}
          <button
            onClick={handleAddPhoto}
            disabled={photoUploading}
            style={{
              marginTop: 10, fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
              color: photoUploading ? 'C.n600' : C.primary,
              background: photoUploading ? C.n100 : `${C.primary}10`,
              border: 'none', borderRadius: 8, padding: '6px 14px',
              cursor: photoUploading ? 'not-allowed' : 'pointer',
            }}
          >
            {photoUploading ? '⏳ Mengupload…' : '+ Tambah Foto'}
          </button>
        </div>

        {/* Status Pembayaran — collapsible */}
        <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 14, boxShadow: SHADOW.sm }}>
          <button onClick={() => setPayOpen(!payOpen)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: payOpen ? 12 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: paymentStatus === 'paid' ? 'C.successBg' : paymentStatus === 'partial' ? 'C.warningBg' : 'C.dangerBg', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>💰</div>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>Pembayaran</span>
              <span style={{
                fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                padding: '2px 8px', borderRadius: 999,
                background: paymentStatus === 'paid' ? 'C.successBg' : paymentStatus === 'partial' ? 'C.warningBg' : 'C.dangerBg',
                color: paymentStatus === 'paid' ? C.success : paymentStatus === 'partial' ? C.warning : C.danger,
              }}>
                {PAY_STATUS_LABEL[paymentStatus] || paymentStatus}
              </span>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="C.n600" strokeWidth="2.5" strokeLinecap="round" style={{ transform: payOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          {payOpen && (
            <>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n700, textAlign: 'center', marginBottom: 8 }}>Detail Tagihan</div>
              {tx.items?.map((item, index) => (
                <div key={`pay-item-${item.id || index}`} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n700 }}>{item.qty}x - {item.name || item.serviceName}</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{rp(getTransactionItemLineTotal(item))}</span>
                </div>
              ))}
              <Divider my={8} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: 'C.n600' }}>Sub-Total</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{rp(tx.subtotal || tx.total || 0)}</span>
              </div>
              {tx.deliveryFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, color: 'C.n600' }}>Biaya Kirim</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{rp(tx.deliveryFee)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>Grand Total</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{rp(tx.total || 0)}</span>
              </div>
              <Divider my={8} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: 'C.n600' }}>Terbayar</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{rp(tx.paidAmount || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: 'C.n600' }}>Sisa tagihan</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: needsSettlement ? C.danger : C.success }}>{rp(balanceDue)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: 'C.n600' }}>Metode utama</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n900 }}>{PAY_METHOD_LABEL[tx.payMethod] || tx.payMethod || '-'}</span>
              </div>
              {tx.payments?.length > 0 && (
                <>
                  <Divider my={8} />
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'C.n600', marginBottom: 6 }}>Riwayat pembayaran</div>
                  {tx.payments.map((p) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n900 }}>{PAY_METHOD_LABEL[p.method] || p.method}</div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'C.n600' }}>
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
                  <div style={{
                    background: 'C.dangerBg', border: '1px solid C.danger',
                    borderRadius: 8, padding: '8px 12px',
                    fontFamily: 'Poppins', fontSize: 11, color: 'C.danger',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span>⚠️</span>
                    <span>Sisa <strong>{rp(balanceDue)}</strong> belum dibayar — klik "Lunasi" di bawah untuk catat pembayaran.</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Detail Transaksi — timeline + info */}
        <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 14, boxShadow: SHADOW.sm }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'C.successBg', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📋</div>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>Informasi Order</span>
          </div>

          {/* Status message */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: C.n50, borderRadius: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{tx.status === 'selesai' ? '✅' : tx.status === 'proses' ? '🔄' : tx.status === 'dibatalkan' ? '❌' : tx.status === 'diambil' ? '📦' : '×'}</span>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>
                {tx.status === 'selesai' ? 'Selesai' : tx.status === 'proses' ? 'Dalam Proses' : tx.status === 'dibatalkan' ? 'Dibatalkan' : tx.status === 'diambil' ? 'Sudah Diambil' : 'Belum Selesai'}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'C.n600', marginTop: 2 }}>
                {tx.status === 'baru' ? 'Semua layanan belum ada yang dikerjakan' : tx.status === 'proses' ? 'Sedang dalam proses pengerjaan' : tx.status === 'selesai' ? 'Semua layanan sudah selesai dikerjakan' : ''}
              </div>
            </div>
          </div>

          {/* Kasir & Workshop */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'C.n600' }}>Kasir Penerima</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{tx.createdBy || tx.kasirName || '-'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'C.n600' }}>Workshop</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{tx.outletName || '-'}</div>
            </div>
          </div>

          {/* Timeline panah: Order Diterima → Estimasi Selesai */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 0', borderTop: `1px solid ${C.n100}`, marginTop: 4 }}>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'C.n600' }}>Order Diterima</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>
                {tx.createdAt ? new Date(tx.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : tx.date || '-'}
              </div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="C.n600" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'C.n600' }}>Estimasi Selesai</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>
                {tx.estimatedDoneAt ? new Date(tx.estimatedDoneAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : tx.dueDate || '-'}
              </div>
            </div>
          </div>

          {/* Pengantaran row + edit button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, color: 'C.n600' }}>Jenis Pengantaran</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>
                {tx.pickupType === 'delivery' ? '🚚 Diantar Kurir' : tx.pickupType === 'pickup' ? '🛵 Dijemput' : tx.pickupType === 'both' ? '🔄 Jemput + Antar' : '🏪 Ambil Sendiri'}
              </span>
              {tx.status !== 'dibatalkan' && tx.status !== 'diambil' && (
                <button
                  onClick={openDeliveryModal}
                  style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.primary, background: `${C.primary}12`, border: 'none', borderRadius: 8, padding: '3px 10px', cursor: 'pointer' }}
                >
                  Ubah
                </button>
              )}
            </div>
          </div>
          {tx.deliveryFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, color: 'C.n600' }}>Biaya Pengantaran</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n900 }}>{rp(tx.deliveryFee)}</span>
            </div>
          )}
          {(() => {
            // Strip metadata [Bayar:...] dari notes, tampilkan hanya catatan user
            const userNotes = (tx.notes || '').replace(/\[Bayar:[^\]]*\]/g, '').trim();
            if (!userNotes) return null;
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: 'C.n600' }}>Catatan</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n900, textAlign: 'right', maxWidth: '55%' }}>{userNotes}</span>
              </div>
            );
          })()}
        </div>

        {/* Progress */}
        {tx.progress && tx.progress.length > 0 && (
          <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 14, boxShadow: SHADOW.sm }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'C.infoBg', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🔄</div>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>Progress Produksi</span>
            </div>
            <ProgressTimeline progress={tx.progress} />
          </div>
        )}

        {/* Logistics Info */}
        {hasLogistics && (
          <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 14, boxShadow: SHADOW.sm }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'C.infoBg', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🚚</div>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>Logistik</span>
            </div>
            {logisticOrders.map((lo) => (
              <div key={lo.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.n50}` }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>
                    {lo.type === 'pickup' ? 'Jemput' : 'Antar'} — {lo.status}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'C.n600' }}>
                    {lo.scheduledAt ? new Date(lo.scheduledAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </div>
                  {lo.areaZone && <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'C.n600' }}>{lo.areaZone}</div>}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{rp(lo.deliveryFee)}</div>
              </div>
            ))}
            {activeLogistic && (
              <Btn variant="secondary" onClick={() => setRescheduleModal(true)} style={{ width: '100%', marginTop: 10 }}>Ubah Jadwal</Btn>
            )}
          </div>
        )}
      </div>

      {/* Bottom Actions — hierarki: pelunasan / pickup → cetak → pembatalan */}
      <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.n100}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, textAlign: 'center', marginBottom: 2 }}>
          Aksi Untuk Transaksi Ini
        </div>

        {(() => {
          const balanceDueNow = Math.max(0, Number(tx.total || 0) - Number(tx.paidAmount || 0));
          const isUnpaid = balanceDueNow > 0;
          const isCancelled = tx.status === 'dibatalkan';
          const isTaken = tx.status === 'diambil';
          const isReady = tx.status === 'selesai';

          return (
            <>
              {/* PRIMARY ACTION — paling penting di atas */}
              {/* 1. Belum lunas → Lunasi (merah, highlight) */}
              {!isCancelled && !isTaken && isUnpaid && (
                <>
                  <Btn
                    variant="primary"
                    style={{
                      width: '100%', height: 52, fontWeight: 800, fontSize: 14,
                      background: `linear-gradient(135deg, ${C.danger}, ${C.danger}CC)`,
                    }}
                    onClick={() => navigate('pelunasan', { id: tx.id || tx.transactionNo })}
                  >
                    💰 Lunasi / Bayar Sebagian — {rp(balanceDueNow)}
                  </Btn>
                  {isReady && (
                    <div style={{
                      fontFamily: 'Poppins', fontSize: 10, color: 'C.danger',
                      textAlign: 'center', marginTop: -2, marginBottom: 2,
                    }}>
                      Cucian belum bisa diambil sebelum lunas
                    </div>
                  )}
                </>
              )}

              {/* 2. Sudah selesai & sudah lunas → Konfirmasi Diambil */}
              {isReady && !isUnpaid && (
                <Btn
                  variant="success"
                  style={{ width: '100%', height: 52, fontWeight: 800, fontSize: 14 }}
                  loading={actionLoading === 'pickup'}
                  onClick={handlePickedUp}
                >
                  ✅ Konfirmasi Sudah Diambil
                </Btn>
              )}

              {/* SECONDARY — Cetak nota selalu tersedia */}
              <Btn
                variant="secondary"
                onClick={() => navigate('cetak_nota', { id: tx.id || tx.transactionNo })}
                style={{ width: '100%' }}
              >
                🖨️ Cetak Nota & Label
              </Btn>

              {/* TERTIARY — pembatalan/hapus, divider visual */}
              {!isCancelled && !isTaken && (
                <>
                  <div style={{ height: 1, background: C.n100, margin: '4px 0 2px' }} />
                  <div style={{
                    fontFamily: 'Poppins', fontSize: 10, color: 'C.n600',
                    textAlign: 'center', marginBottom: 2,
                  }}>
                    Aksi sensitif (perlu approval admin)
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setApprovalModal('cancel_nota')}
                      style={{
                        flex: 1, padding: '10px',
                        border: `1.5px solid C.danger`, background: 'white',
                        color: 'C.danger', borderRadius: 10,
                        fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ⚠️ Ajukan Pembatalan
                    </button>
                    <button
                      onClick={() => setApprovalModal('delete_transaction')}
                      style={{
                        flex: 1, padding: '10px',
                        border: `1.5px solid ${C.n200}`, background: 'white',
                        color: 'C.n600', borderRadius: 10,
                        fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      🗑️ Ajukan Hapus
                    </button>
                  </div>
                </>
              )}
            </>
          );
        })()}
      </div>

      {/* Approval Modal */}
      <Modal visible={!!approvalModal} onClose={() => { setApprovalModal(null); setApprovalReason(''); }} title={approvalModal === 'cancel_nota' ? 'Ajukan Pembatalan' : 'Ajukan Penghapusan'}>
        <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'C.n600', marginBottom: 12 }}>
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
        <DateTimeInput
          label="Jadwal Baru"
          value={
            rescheduleDate && rescheduleTime
              ? `${rescheduleDate}T${rescheduleTime}:00`
              : null
          }
          onChange={(iso) => {
            if (!iso) { setRescheduleDate(''); setRescheduleTime(''); return; }
            const [d, t] = iso.split('T');
            setRescheduleDate(d);
            setRescheduleTime(t.slice(0, 5));
          }}
          minDate={new Date()}
        />
        <Input label="Alasan (opsional)" value={rescheduleReason} onChange={setRescheduleReason} placeholder="Alasan reschedule..." />
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <Btn variant="secondary" onClick={() => setRescheduleModal(false)} style={{ flex: 1 }}>Batal</Btn>
          <Btn variant="primary" onClick={handleReschedule} loading={loading} style={{ flex: 1 }}>Simpan Jadwal</Btn>
        </div>
      </Modal>

      {/* Pelunasan */}
      <Modal visible={pelunasanModal} onClose={() => setPelunasanModal(false)} title="Catat pelunasan">
        <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'C.n600', marginBottom: 12 }}>
          Sisa tagihan: <strong>{rp(balanceDue)}</strong>. Nominal di bawah tidak boleh melebihi sisa (kelebihan tunai dihitung kembalian).
        </div>
        <Select
          label="Metode"
          value={pelMethod}
          onChange={setPelMethod}
          options={[
            { value: 'cash', label: 'Tunai' },
            { value: 'transfer', label: 'Transfer Bank' },
            { value: 'qris', label: 'QRIS (EDC manual)' },
            { value: 'deposit', label: 'Deposit member' },
          ]}
        />
        <MoneyInput label="Nominal ke tagihan (Rp)" value={pelAmountStr} onChange={setPelAmountStr} placeholder={Number(Math.round(balanceDue)).toLocaleString('id-ID')} />
        {pelMethod === 'cash' && (
          <MoneyInput
            label="Uang diterima (opsional, untuk kembalian)"
            value={pelCashStr}
            onChange={setPelCashStr}
            placeholder="Kalau lebih besar dari nominal, sisanya kembalian"
          />
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Btn variant="secondary" onClick={() => setPelunasanModal(false)} style={{ flex: 1 }}>Batal</Btn>
          <Btn variant="primary" onClick={submitPelunasan} loading={pelLoading} style={{ flex: 1 }}>Simpan</Btn>
        </div>
      </Modal>

      {/* Edit Delivery Type Modal */}
      {deliveryModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setDeliveryModal(false)}
        >
          <div
            style={{ width: '100%', background: C.white, borderRadius: '20px 20px 0 0', padding: '20px 20px 32px', boxShadow: SHADOW.lg }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: C.n200, margin: '0 auto 16px' }} />
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900, marginBottom: 4 }}>Ubah Jenis Pengantaran</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'C.n600', marginBottom: 16 }}>Pilih bagaimana customer mendapatkan laundry mereka.</div>

            {/* Options */}
            {[
              { key: 'self',     label: '🏪 Ambil Sendiri',  desc: 'Customer datang langsung ke outlet',   fee: 'Gratis' },
              { key: 'pickup',   label: '🛵 Dijemput Kurir', desc: 'Kurir menjemput laundry dari customer', fee: 'Rp 10.000' },
              { key: 'delivery', label: '🚚 Diantar Kurir',  desc: 'Kurir mengantar laundry ke customer',   fee: 'Rp 10.000' },
              { key: 'both',     label: '🔄 Jemput + Antar', desc: 'Jemput kotoran, antar cucian bersih',  fee: 'Rp 20.000' },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setDlvType(opt.key)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 14px', borderRadius: 12, marginBottom: 8, border: `2px solid ${dlvType === opt.key ? C.primary : C.n200}`, background: dlvType === opt.key ? `${C.primary}08` : C.white, cursor: 'pointer', textAlign: 'left' }}
              >
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: dlvType === opt.key ? C.primary : C.n900 }}>{opt.label}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'C.n600', marginTop: 2 }}>{opt.desc}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: dlvType === opt.key ? C.primary : 'C.n600' }}>{opt.fee}</span>
                  <div style={{ width: 18, height: 18, borderRadius: 9, border: `2px solid ${dlvType === opt.key ? C.primary : C.n300}`, background: dlvType === opt.key ? C.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {dlvType === opt.key && <div style={{ width: 6, height: 6, borderRadius: 3, background: 'white' }} />}
                  </div>
                </div>
              </button>
            ))}

            {/* Schedule (jika bukan self) */}
            {dlvType !== 'self' && (
              <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 14 }}>
                <DateTimeInput
                  label={`Jadwal ${dlvType === 'pickup' ? 'Penjemputan' : dlvType === 'delivery' ? 'Pengiriman' : 'Jemput + Kirim'} (opsional)`}
                  value={dlvSchedule}
                  onChange={(v) => setDlvSchedule(v || '')}
                  minDate={new Date()}
                />
              </div>
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 6 }}>Catatan perubahan (opsional)</div>
              <input
                value={dlvNotes}
                onChange={(e) => setDlvNotes(e.target.value)}
                placeholder="Mis: customer minta diantar sore hari"
                style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setDeliveryModal(false)}
                style={{ flex: 1, height: 46, borderRadius: 12, border: `1.5px solid ${C.n200}`, background: C.white, fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n700, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                onClick={submitDeliveryChange}
                disabled={dlvLoading}
                style={{ flex: 2, height: 46, borderRadius: 12, border: 'none', background: dlvLoading ? C.n300 : C.primary, fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: 'white', cursor: dlvLoading ? 'default' : 'pointer' }}
              >
                {dlvLoading ? 'Menyimpan…' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      <Modal visible={reviewModal} onClose={() => setReviewModal(false)} title="Customer Review">
        <div style={{ fontFamily: 'Poppins', fontSize: 13, color: 'C.n600', marginBottom: 16, textAlign: 'center' }}>
          Tanyakan kepada {tx?.customerName || 'pelanggan'} bagaimana pengalaman laundry-nya hari ini.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button 
              key={star} 
              onClick={() => setReviewRating(star)} 
              style={{ background: 'none', border: 'none', fontSize: 36, color: star <= reviewRating ? 'C.warning' : C.n200, cursor: 'pointer' }}
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

      {/* Modal Edit Packing */}
      <Modal isOpen={!!packingModal} onClose={() => setPackingModal(null)} title={`📦 Info Packing — ${packingModal?.name || ''}`}>
        <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'C.n600', marginBottom: 16 }}>
          Atur jumlah paket yang dibutuhkan dan catatan khusus untuk layanan ini. Informasi ini akan digunakan tim produksi saat tahap packing.
        </div>

        {/* Counter jumlah paket */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Butuh berapa paket?</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setPkgNeeded(v => Math.max(1, v - 1))}
              style={{ width: 40, height: 40, borderRadius: 20, border: `1.5px solid ${C.n300}`, background: C.n100, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 20, fontWeight: 600, color: C.n700 }}
            >−</button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 32, fontWeight: 900, color: C.primary }}>{pkgNeeded}</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, color: 'C.n600' }}> paket</span>
            </div>
            <button
              onClick={() => setPkgNeeded(v => v + 1)}
              style={{ width: 40, height: 40, borderRadius: 20, border: 'none', background: C.primary, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 20, fontWeight: 600, color: 'white' }}
            >+</button>
          </div>
        </div>

        <Input
          label="Catatan Packing (opsional)"
          value={pkgNotes}
          onChange={setPkgNotes}
          placeholder="Contoh: pisahkan baju putih, masukkan plastik terpisah..."
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Btn variant="secondary" onClick={() => setPackingModal(null)} style={{ flex: 1 }}>Batal</Btn>
          <Btn variant="primary" onClick={savePackingInfo} loading={pkgSaving} style={{ flex: 1 }}>Simpan</Btn>
        </div>
      </Modal>
    </div>
  );
};