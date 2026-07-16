import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp, openWaMe } from '../../utils/helpers';
import { Btn } from '../../components/ui';
import { useResponsive } from '../../utils/hooks';
import { hapticSuccess } from '../../utils/haptic';
import { alertError } from '../../utils/alert';

// ─── Payment Status Auto-Detection ──────────────────────────────────────────────
function getPaymentStatus(paidAmount, total) {
  if (!paidAmount || paidAmount <= 0) return 'bayar_nanti';
  if (paidAmount >= total) return 'lunas';
  return 'dp';
}

const PAYMENT_STATUS_CONFIG = {
  lunas: { label: 'LUNAS', color: '#059669', bg: '#d1fae5', icon: '✅', desc: 'Pembayaran sudah lunas' },
  dp: { label: 'UANG MUKA', color: '#d97706', bg: '#fef3c7', icon: '💰', desc: 'Ada uang muka / DP' },
  bayar_nanti: { label: 'BAYAR NANTI', color: '#6b7280', bg: '#f3f4f6', icon: '⏳', desc: 'Belum ada pembayaran' },
};

// ─── WhatsApp Message Builder ────────────────────────────────────────────────────
const buildWhatsAppMessage = (nota) => {
  const lines = [];
  lines.push(`Halo ${nota.customerName || 'Pelanggan'},`);
  lines.push('');
  lines.push('Terima kasih sudah mempercayakan cucian Anda di *Waschen Laundry* 🧺');
  lines.push('');
  lines.push(`*Nota:* ${nota.id || nota.transactionNo}`);
  const paidAmount = Number(nota.paidAmount) || 0;
  const total = Number(nota.total) || 0;
  const balance = Math.max(0, total - paidAmount);
  if (paidAmount <= 0) lines.push('📋 *Status:* _Belum dibayar_');
  else if (paidAmount >= total) lines.push('✅ *Status:* _Lunas_');
  else lines.push('💰 *Status:* _Uang Muka (DP)_');
  if (nota.items?.length) {
    lines.push('*Item:*');
    nota.items.forEach((it, i) => {
      lines.push(`${i + 1}. ${it.name || it.serviceName || 'Layanan'} — ${it.qty || 1} ${it.unit || 'pcs'}`);
    });
  }
  lines.push('');
  lines.push(`*Total:* ${rp(total)}`);
  if (paidAmount > 0) lines.push(`Sudah dibayar: ${rp(paidAmount)}`);
  if (balance > 0) lines.push(`Sisa pembayaran: ${rp(balance)}`);
  if (nota.dueDate || nota.estimatedDoneAt) {
    const dt = new Date(nota.dueDate || nota.estimatedDoneAt);
    if (!isNaN(dt.getTime())) {
      lines.push(`Estimasi selesai: ${dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`);
    }
  }
  lines.push('');
  lines.push('Sampai jumpa kembali 🙌');
  return lines.join('\n');
};

const sendWhatsApp = (nota) => {
  const phone = nota?.customerPhone || nota?.phone || '';
  const message = buildWhatsAppMessage(nota);
  openWaMe(phone, message);
};

// ─── Transform API response to nota shape ──────────────────────────────────────
function transformNota(txData) {
  return {
    id: txData.transactionNo || txData.id,
    transactionNo: txData.transactionNo || txData.id,
    transactionId: txData.id,
    customerName: txData.customerName,
    customerPhone: txData.customerPhone,
    customerId: txData.customerId,
    items: txData.items || [],
    units: txData.units || [],
    total: Number(txData.total) || 0,
    subtotal: Number(txData.subtotal) || 0,
    paidAmount: Number(txData.paidAmount) || 0,
    changeAmount: Number(txData.changeAmount) || 0,
    deliveryFee: Number(txData.deliveryFee) || 0,
    payMethod: txData.payMethod || txData.primary_payment_method,
    paymentStatus: txData.paymentStatus || 'unpaid',
    pickupType: txData.pickupType || 'self',
    notes: txData.notes || '',
    dueDate: txData.dueDate || txData.estimatedDoneAt,
    estimatedDoneAt: txData.estimatedDoneAt,
    date: txData.date || txData.createdAt,
    status: txData.status || 'baru',
    isExpress: txData.isExpress,
    production: txData.production,
    progress: txData.progress || [],
    itemsReadyCount: txData.itemsReadyCount,
    itemsTotalCount: txData.itemsTotalCount,
    allItemsReady: txData.allItemsReady,
    memberDiscount: txData.memberDiscount || 0,
    promoDiscount: txData.promoDiscount || 0,
    manualDiscount: txData.manualDiscount || 0,
    birthdayDiscount: txData.birthdayDiscount || 0,
    transactionUuid: txData.transactionUuid,
    createdBy: txData.createdBy,
    outletName: txData.outletName,
  };
}

// ─── Production Status Config ──────────────────────────────────────────────────
const PROD_STATUS = {
  received: { label: 'Diterima', color: '#6b7280', bg: '#f3f4f6' },
  waiting: { label: 'Menunggu', color: '#6b7280', bg: '#f3f4f6' },
  washing: { label: 'Dicuci', color: '#0EA5E9', bg: '#E0F2FE' },
  drying: { label: 'Dikeringkan', color: '#0EA5E9', bg: '#E0F2FE' },
  ironing: { label: 'Distrika', color: '#8B5CF6', bg: '#EDE9FE' },
  qc: { label: 'QC', color: '#F59E0B', bg: '#FEF3C7' },
  packing: { label: 'Dipacking', color: '#8B5CF6', bg: '#EDE9FE' },
  ready: { label: 'SIAP', color: '#059669', bg: '#d1fae5' },
  done: { label: 'SELESAI', color: '#059669', bg: '#d1fae5' },
};

const getProdStatus = (key) => PROD_STATUS[key] || PROD_STATUS.received;

export default function NotaBerhasilPage({ navigate, screenParams }) {
  const { isMobile } = useResponsive();

  // 1. Use passed data from navigation params immediately (from checkout response)
  // This prevents blank screen on fast connections / when API fetch is slow
  const passedNota = screenParams || {};

  // 2. API-fetched data (authoritative, more complete)
  const [apiNota, setApiNota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // 3. Merge: prefer API data, fall back to passed data
  const nota = apiNota || (passedNota.id || passedNota.transactionId ? passedNota : null);

  // ── Block browser back ──────────────────────────────────────────────────────
  useEffect(() => {
    window.history.replaceState({ screen: 'nota_berhasil', params: screenParams, depth: 0 }, '', window.location.pathname);
    const handlePopState = () => {
      window.history.pushState({ screen: 'nota_berhasil', params: screenParams, depth: 0 }, '', window.location.pathname);
    };
    window.history.pushState({ screen: 'nota_berhasil', params: screenParams, depth: 0 }, '', window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [screenParams]);

  // ── Fetch from API (parallel to passed data — non-blocking) ─────────────────
  useEffect(() => {
    const identifier = passedNota.transactionId || passedNota.transactionNo || passedNota.id;
    if (!identifier) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        // Timeout: use passed data instead of spinning forever
        setLoading(false);
        if (!passedNota.id && !passedNota.transactionId) {
          setFetchError('Tidak dapat memuat data dari server. Menggunakan data lokal.');
        }
      }
    }, 8000); // 8 second timeout

    axios.get(`/api/transactions/${identifier}`)
      .then((res) => {
        if (!cancelled) {
          clearTimeout(timeoutId);
          setApiNota(transformNota(res?.data?.data));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          clearTimeout(timeoutId);
          setFetchError(err?.response?.data?.message || 'Gagal memuat data nota dari server.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [
    passedNota.transactionId,
    passedNota.transactionNo,
    passedNota.id,
  ]);

  // Haptic feedback on mount
  useEffect(() => { hapticSuccess(); }, []);

  // ── Computed ─────────────────────────────────────────────────────────────────
  const paymentStatus = nota ? getPaymentStatus(Number(nota.paidAmount) || 0, Number(nota.total) || 0) : null;
  const statusConfig = paymentStatus ? PAYMENT_STATUS_CONFIG[paymentStatus] : null;
  const balance = nota ? Math.max(0, Number(nota.total || 0) - Number(nota.paidAmount || 0)) : 0;
  const notaId = nota?.id || nota?.transactionNo || nota?.transactionId;

  // ── Handle goto Cetak Nota ──────────────────────────────────────────────────
  const handleCetakNota = () => {
    if (!notaId) {
      alertError('ID nota tidak ditemukan.');
      return;
    }
    navigate('cetak_nota', { id: notaId });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: C.n50, padding: isMobile ? 16 : 24,
    }}>
      {/* Success Icon */}
      <div style={{
        width: isMobile ? 72 : 88, height: isMobile ? 72 : 88,
        borderRadius: isMobile ? 36 : 44,
        background: `linear-gradient(135deg, ${C.success}, ${C.success}CC)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20, boxShadow: `0 8px 24px ${C.success}44`,
      }}>
        <svg width={isMobile ? 36 : 44} height={isMobile ? 36 : 44} viewBox="0 0 24 24"
          fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 18 : 22, fontWeight: 600, color: C.n900, marginBottom: 6, textAlign: 'center' }}>
        Nota Berhasil Dibuat!
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 14, color: C.n600, marginBottom: 24, textAlign: 'center' }}>
        {loading ? 'Memuat data nota...' : nota ? 'Nota laundry telah berhasil disimpan' : 'Memuat nota...'}
      </div>

      {/* Loading Spinner */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 20,
            border: `3px solid ${C.n200}`, borderTopColor: C.primary,
            animation: 'spin 1s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>
            {apiNota ? 'Menyimpan...' : 'Mengambil data dari server...'}
          </span>
        </div>
      )}

      {/* Error Banner (only if we have NO data at all) */}
      {fetchError && !nota && (
        <div style={{
          width: '100%', maxWidth: 400, background: '#FEE2E2',
          borderRadius: 12, padding: 16, marginBottom: 24,
          border: '1px solid #FECACA',
        }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, color: '#DC2626', textAlign: 'center' }}>
            ⚠️ {fetchError}
          </div>
          <Btn variant="secondary" fullWidth onClick={() => navigate('transaksi')} style={{ marginTop: 12 }}>
            Lihat Daftar Transaksi
          </Btn>
        </div>
      )}

      {/* ── Nota Summary Card ──────────────────────────────────────────────── */}
      {nota && !loading && (
        <div style={{
          width: '100%', maxWidth: 400,
          background: C.white, borderRadius: 16,
          padding: isMobile ? '12px 14px' : '16px 20px',
          boxShadow: SHADOW.md, marginBottom: 24,
        }}>
          {/* No. Nota */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>No. Nota</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.primary }}>
              {notaId}
            </span>
          </div>

          {/* Customer */}
          {nota.customerName && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Customer</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{nota.customerName}</span>
            </div>
          )}

          {/* Items count */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Item</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>
              {nota.items?.length || 0} layanan
            </span>
          </div>

          {/* Estimasi Selesai */}
          {(nota.dueDate || nota.estimatedDoneAt) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Estimasi Selesai</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.primary }}>
                {new Date(nota.dueDate || nota.estimatedDoneAt).toLocaleDateString('id-ID', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </span>
            </div>
          )}

          {/* Express Badge */}
          {nota.isExpress && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 6, background: '#FEF3C7', marginBottom: 8,
            }}>
              <span style={{ fontSize: 12 }}>⚡</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#D97706' }}>EXPRESS</span>
            </div>
          )}

          <div style={{ height: 1, background: C.n100, margin: '8px 0' }} />

          {/* Payment Status Badge */}
          {statusConfig && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: statusConfig.bg, marginBottom: 12,
            }}>
              <div style={{ fontSize: 20 }}>{statusConfig.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: statusConfig.color }}>
                  {statusConfig.label}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: statusConfig.color, opacity: 0.8 }}>
                  {statusConfig.desc}
                </div>
              </div>
            </div>
          )}

          {/* Payment Details */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Total Tagihan</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{rp(nota.total)}</span>
            </div>
            {nota.paidAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Sudah Dibayar</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.success }}>{rp(nota.paidAmount)}</span>
              </div>
            )}
            {balance > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Sisa Pembayaran</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.danger }}>{rp(balance)}</span>
              </div>
            )}
          </div>

          <div style={{ height: 1, background: C.n100, margin: '8px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>Total</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 600, color: C.n900 }}>{rp(nota.total)}</span>
          </div>

          {/* Per-Item Production Status */}
          {nota.items && nota.items.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 8, textTransform: 'uppercase' }}>
                📦 Status Produksi Per Item
              </div>
              {nota.items.map((item, idx) => {
                const s = getProdStatus(item.productionStatus);
                return (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 10px', borderRadius: 8, background: s.bg, marginBottom: 6,
                    border: `1px solid ${s.color}22`,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n900 }}>
                        {item.name || item.serviceName || 'Layanan'}
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>
                        {item.qty || 1} {item.unit || 'pcs'}
                      </div>
                    </div>
                    <div style={{
                      fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: s.color,
                      padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.7)',
                    }}>
                      {s.label}
                    </div>
                  </div>
                );
              })}
              {nota.itemsReadyCount !== undefined && (
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, textAlign: 'center', marginTop: 8 }}>
                  {nota.itemsReadyCount}/{nota.itemsTotalCount} item siap diambil
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Action Buttons ─────────────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: isMobile ? 80 : 0 }}>

        {/* Print Nota — always show if we have nota data */}
        {nota && (
          <Btn variant="primary" fullWidth size="lg" onClick={handleCetakNota}>
            🖨️ Cetak Nota & Label
          </Btn>
        )}

        {/* WhatsApp — show if we have a phone number */}
        {(nota?.customerPhone || passedNota?.phone || passedNota?.customerPhone) && (
          <button
            onClick={() => sendWhatsApp(nota || passedNota)}
            style={{
              width: '100%', height: 48, borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #25D366, #128C7E)',
              cursor: 'pointer', fontFamily: 'Poppins', fontSize: 14, fontWeight: 600,
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 12px rgba(37,211,102,0.35)',
            }}
          >
            <span style={{ fontSize: 18 }}>💬</span>
            Kirim Nota via WhatsApp
          </button>
        )}

        <Btn variant="secondary" fullWidth onClick={() => navigate('nota_step1')}>
          Buat Nota Baru
        </Btn>

        <Btn variant="ghost" fullWidth onClick={() => navigate('transaksi')}>
          Lihat Transaksi
        </Btn>

        <Btn variant="ghost" fullWidth onClick={() => navigate('dashboard')}>
          🏠 Ke Beranda
        </Btn>
      </div>
    </div>
  );
}
