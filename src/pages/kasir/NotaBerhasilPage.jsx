import { useEffect, useState } from 'react';
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

// ─── CSS Keyframes ─────────────────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes heroIn { to { opacity: 1; } }
  @keyframes revealFill {
    to { transform: translate(-50%, -50%) scale(14); }
  }
  @keyframes glowIn { to { opacity: 1; } }
  @keyframes procOut { to { opacity: 0; transform: scale(0.75); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes ringPulse {
    0% { transform: scale(0.6); opacity: 0.7; }
    100% { transform: scale(1.9); opacity: 0; }
  }
  @keyframes popIn { to { transform: scale(1); } }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  @keyframes confettiPop {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3) rotate(0deg); }
    15% { opacity: 1; }
    100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(1) rotate(var(--rot)); }
  }
  @keyframes cardIn { to { opacity: 1; transform: translateY(0); } }
`;

export default function NotaBerhasilPage({ navigate, screenParams }) {
  const { isMobile } = useResponsive();

  const passedNota = screenParams || {};
  const [apiNota, setApiNota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const nota = apiNota || (passedNota.id || passedNota.transactionId ? passedNota : null);

  // ── Block browser back: redirect to dashboard ─────────────────────────────────
  useEffect(() => {
    window.history.replaceState({ screen: 'nota_berhasil', params: screenParams, depth: 0 }, '', window.location.pathname);
    const handlePopState = () => {
      // Instead of just pushing state to stay on page, redirect to dashboard
      navigate('dashboard', null, { replace: true });
    };
    window.history.pushState({ screen: 'nota_berhasil', params: screenParams, depth: 0 }, '', window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [screenParams, navigate]);

  // ── Fetch from API ────────────────────────────────────────────────────────────
  useEffect(() => {
    const identifier = passedNota.transactionId || passedNota.transactionNo || passedNota.id;
    if (!identifier) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        if (!passedNota.id && !passedNota.transactionId) {
          setFetchError('Tidak dapat memuat data dari server. Menggunakan data lokal.');
        }
      }
    }, 8000);

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
  }, [passedNota.transactionId, passedNota.transactionNo, passedNota.id]);

  // Haptic feedback on mount
  useEffect(() => { hapticSuccess(); }, []);

  // ── Computed ─────────────────────────────────────────────────────────────────
  const paymentStatus = nota ? getPaymentStatus(Number(nota.paidAmount) || 0, Number(nota.total) || 0) : null;
  const statusConfig = paymentStatus ? PAYMENT_STATUS_CONFIG[paymentStatus] : null;
  const balance = nota ? Math.max(0, Number(nota.total || 0) - Number(nota.paidAmount || 0)) : 0;
  const notaId = nota?.id || nota?.transactionNo || nota?.transactionId;

  const handleCetakNota = () => {
    if (!notaId) {
      alertError('ID nota tidak ditemukan.');
      return;
    }
    navigate('cetak_nota', { id: notaId });
  };

  // ─── Design Tokens ──────────────────────────────────────────────────────────
  const primary = '#6E2E68';
  const primaryDark = '#4C2E82';
  const success = '#16A34A';
  const successBg = '#EFFDF4';

  // ─── Styles ──────────────────────────────────────────────────────────────────
  const pageStyle = {
    fontFamily: "'Inter', sans-serif",
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #F6F1FA 0%, #FAF7FB 45%, #F3EEF8 100%)',
    WebkitFontSmoothing: 'antialiased',
  };

  const ambientStyle = {
    position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none',
  };

  const blobBase = { position: 'absolute', borderRadius: '50%', filter: 'blur(2px)' };

  const sparkBase = { position: 'absolute', color: 'rgba(110, 46, 104, 0.28)', fontSize: 14 };

  const contentStyle = {
    maxWidth: 520, margin: '0 auto', paddingBottom: 40,
    position: 'relative', zIndex: 1,
  };

  const heroStyle = {
    position: 'relative', overflow: 'hidden',
    background: 'linear-gradient(160deg, #F6F1FA 0%, #FAF7FB 45%, #F3EEF8 100%)',
    padding: '34px 20px 70px', textAlign: 'center', borderRadius: '0 0 28px 28px',
    opacity: 0, animation: 'heroIn 0.35s ease-out forwards',
  };

  const revealFillStyle = {
    position: 'absolute', top: 82, left: '50%', width: 60, height: 60, zIndex: 1,
    background: 'linear-gradient(120deg, #170B29 0%, #3B1B52 38%, #6E2E68 72%, #9C3F7E 100%)',
    borderRadius: '50%', transform: 'translate(-50%, -50%) scale(0)',
    animation: 'revealFill 0.65s cubic-bezier(0.22, 0.9, 0.4, 1) 0.9s forwards',
  };

  const stageStyle = {
    position: 'relative', width: 96, height: 96, margin: '0 auto 18px', zIndex: 2,
  };

  const spinnerStyle = {
    width: 58, height: 58, borderRadius: '50%',
    border: '3.5px solid rgba(110, 46, 104, 0.15)', borderTopColor: primary,
    animation: 'spin 0.7s linear infinite',
  };

  const processingStyle = {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    animation: 'procOut 0.18s ease-in 0.78s forwards',
  };

  const processingLabelStyle = {
    position: 'absolute', left: 0, right: 0, top: 112, textAlign: 'center',
    fontSize: 11.5, fontWeight: 600, color: C.n600,
    opacity: 0, animation: 'fadeUp 0.3s ease-out 0.1s forwards, procOut 0.18s ease-in 0.78s forwards',
  };

  const burstStyle = { position: 'absolute', inset: 0 };

  const ringBase = {
    position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.55)',
    opacity: 0, animation: 'ringPulse 1.1s ease-out forwards',
  };

  const checkCircleStyle = {
    position: 'relative', width: 96, height: 96, borderRadius: '50%',
    background: 'linear-gradient(150deg, #22C55E, #0E8F45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.25)',
    transform: 'scale(0)', animation: 'popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.95s forwards',
  };

  const checkPathStyle = {
    fill: 'none', stroke: '#fff', strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round',
    strokeDasharray: 40, strokeDashoffset: 40, animation: 'draw 0.4s ease-out 1.35s forwards',
  };

  const confettiBase = {
    position: 'absolute', top: '44%', left: '50%', width: 6, height: 10,
    borderRadius: 2, opacity: 0, animation: 'confettiPop 0.9s ease-out forwards',
  };

  const heroTitleStyle = {
    position: 'relative', zIndex: 2,
    fontFamily: "'Poppins', sans-serif", fontSize: 19, fontWeight: 800, color: '#fff', marginTop: 2,
    opacity: 0, animation: 'fadeUp 0.45s ease-out 1.55s forwards',
  };

  const heroSubStyle = {
    position: 'relative', zIndex: 2, fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', marginTop: 5,
    opacity: 0, animation: 'fadeUp 0.45s ease-out 1.65s forwards',
  };

  const cardStyle = {
    background: '#fff', borderRadius: 18, margin: '-46px 16px 0', padding: '18px 18px 5px',
    boxShadow: '0 10px 30px rgba(76, 46, 130, 0.14)', position: 'relative', zIndex: 2,
    opacity: 0, transform: 'translateY(16px)', animation: 'cardIn 0.5s ease-out 1.55s forwards',
  };

  const rRowStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 0', fontSize: 12.5,
  };

  const rKeyStyle = { color: C.n500 };
  const rValStyle = { fontFamily: "'Poppins', sans-serif", fontWeight: 700, color: C.n900 };
  const rValAccentStyle = { ...rValStyle, color: primary };
  const dividerStyle = { height: 1, background: C.n200, margin: '8px 0' };

  const lunasStyle = {
    display: 'flex', alignItems: 'center', gap: 10,
    background: successBg, borderRadius: 12, padding: '10px 12px', margin: '10px 0',
  };

  const lunasIconStyle = {
    width: 26, height: 26, borderRadius: '50%', background: success,
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };

  const totalRowStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 4px',
  };

  const totalKeyStyle = { fontFamily: "'Poppins', sans-serif", fontSize: 13, fontWeight: 700, color: C.n900 };
  const totalValStyle = { fontFamily: "'Poppins', sans-serif", fontSize: 18, fontWeight: 800, color: C.n900 };

  const sectionLblStyle = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', color: C.n500,
    margin: '14px 0 8px', display: 'flex', alignItems: 'center', gap: 5,
  };

  const itemRowStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: C.n50, border: `1px solid ${C.n200}`, borderRadius: 10,
    padding: '9px 12px', marginBottom: 6,
  };

  const itemNameStyle = { fontFamily: "'Poppins', sans-serif", fontSize: 12, fontWeight: 700, color: C.n900 };
  const itemQtyStyle = { fontFamily: "'Poppins', sans-serif", fontSize: 10.5, color: C.n500, marginTop: 1 };

  const itemStatusStyle = {
    fontFamily: "'Poppins', sans-serif", fontSize: 10, fontWeight: 700,
    padding: '3px 9px', borderRadius: 99, background: '#fff', border: `1px solid ${C.n200}`, color: C.n600,
  };

  const readyNoteStyle = {
    textAlign: 'center', fontFamily: "'Poppins', sans-serif",
    fontSize: 10.5, color: C.n500, padding: '8px 0 14px',
  };

  const actionsStyle = {
    padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 14,
    opacity: 0, animation: 'fadeUp 0.45s ease-out 1.95s forwards',
  };

  const actionSectionStyle = { display: 'flex', flexDirection: 'column', gap: 9 };
  const actionRowStyle = { display: 'flex', gap: 9 };
  const actionColStyle = { flex: 1, display: 'flex', flexDirection: 'column', gap: 9 };

  const btnBase = (isPrimary, isOutline, isGhost) => ({
    height: 46, borderRadius: 13, fontFamily: "'Poppins', sans-serif", fontSize: 13, fontWeight: 700,
    cursor: 'pointer', border: isOutline ? '1.5px solid #6E2E68' : 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 12px',
    ...(isPrimary && {
      background: 'linear-gradient(120deg, #6E2E68, #4C2E82)', color: '#fff',
      boxShadow: '0 6px 16px rgba(76, 46, 130, 0.3)',
    }),
    ...(isOutline && {
      background: '#fff', color: primary,
    }),
    ...(isGhost && {
      background: C.n100, color: C.n700,
    }),
  });

  const btnPrintStyle = btnBase(true);
  const btnWaStyle = {
    ...btnBase(true),
    background: 'linear-gradient(120deg, #22C55E, #0E8F45)',
    boxShadow: '0 6px 16px rgba(22, 163, 74, 0.25)',
  };
  const btnOutlineStyle = btnBase(false, true);
  const btnGhostStyle = btnBase(false, false, true);

  const heroGlowBefore = {
    content: '', position: 'absolute', zIndex: 1, top: -60, right: -30,
    width: 240, height: 240, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255, 255, 255, 0.16), transparent 70%)',
    opacity: 0, animation: 'glowIn 0.4s ease-out 1.05s forwards',
  };

  const heroGlowAfter = {
    content: '', position: 'absolute', zIndex: 1, bottom: -60, left: '10%',
    width: 200, height: 200, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(236, 72, 153, 0.22), transparent 70%)',
    opacity: 0, animation: 'glowIn 0.4s ease-out 1.05s forwards',
  };

  const errorBannerStyle = {
    width: '100%', maxWidth: 400, background: '#FEE2E2',
    borderRadius: 12, padding: 16, margin: '0 16px 24px',
    border: '1px solid #FECACA',
  };

  // ─── Confetti particles ───────────────────────────────────────────────────────
  const confettiParticles = [
    { bg: '#FBBF24', tx: '-52px', ty: '-40px', rot: '180deg', delay: '1.15s' },
    { bg: '#F472B6', tx: '48px', ty: '-46px', rot: '-140deg', delay: '1.2s' },
    { bg: '#60A5FA', tx: '-60px', ty: '10px', rot: '90deg', delay: '1.18s' },
    { bg: '#34D399', tx: '56px', ty: '4px', rot: '-90deg', delay: '1.23s' },
    { bg: '#FBBF24', tx: '-18px', ty: '-62px', rot: '60deg', delay: '1.26s' },
    { bg: '#A78BFA', tx: '22px', ty: '-64px', rot: '-60deg', delay: '1.3s' },
  ];

  const ringDelays = ['1.1s', '1.25s'];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={pageStyle}>
        {/* Ambient background */}
        <div style={ambientStyle}>
          <div style={{ ...blobBase, top: '-8%', left: '-12%', width: 420, height: 420, background: 'radial-gradient(circle, rgba(110, 46, 104, 0.10), transparent 70%)' }} />
          <div style={{ ...blobBase, bottom: '-12%', right: '-10%', width: 480, height: 480, background: 'radial-gradient(circle, rgba(156, 63, 126, 0.12), transparent 70%)' }} />
          <div style={{ ...blobBase, top: '38%', left: '-8%', width: 260, height: 260, background: 'radial-gradient(circle, rgba(59, 27, 82, 0.08), transparent 70%)' }} />
          <div style={{ ...blobBase, top: '18%', right: '-6%', width: 220, height: 220, background: 'radial-gradient(circle, rgba(236, 72, 153, 0.10), transparent 70%)' }} />
          <span style={{ ...sparkBase, top: '12%', left: '8%' }}>✦</span>
          <span style={{ ...sparkBase, top: '64%', right: '9%', fontSize: 11 }}>✦</span>
          <span style={{ ...sparkBase, bottom: '14%', left: '11%', fontSize: 12 }}>✦</span>
          <span style={{ ...sparkBase, top: '46%', right: '14%', fontSize: 10 }}>✦</span>
        </div>

        <div style={contentStyle}>
          {/* Hero */}
          <div style={heroStyle}>
            <div style={revealFillStyle} />

            {/* Hero glow orbs */}
            <div style={{ ...heroGlowBefore, position: 'absolute', zIndex: 1, top: -60, right: -30, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255, 255, 255, 0.16), transparent 70%)', opacity: 0, animation: 'glowIn 0.4s ease-out 1.05s forwards' }} />
            <div style={{ ...heroGlowAfter, position: 'absolute', zIndex: 1, bottom: -60, left: '10%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(236, 72, 153, 0.22), transparent 70%)', opacity: 0, animation: 'glowIn 0.4s ease-out 1.05s forwards' }} />

            {/* Stage: spinner + success burst */}
            <div style={stageStyle}>
              {/* Processing spinner */}
              <div style={processingStyle}>
                <div style={spinnerStyle} />
              </div>

              {/* Burst with check */}
              <div style={burstStyle}>
                {ringDelays.map((delay, i) => (
                  <div key={i} style={{ ...ringBase, animationDelay: delay }} />
                ))}
                <div style={checkCircleStyle}>
                  <svg viewBox="0 0 24 24" width={44} height={44}>
                    <path d="M5 13l4 4L19 7" style={checkPathStyle} />
                  </svg>
                  {/* Confetti */}
                  {confettiParticles.map((p, i) => (
                    <div key={i} style={{
                      ...confettiBase, background: p.bg,
                      '--tx': p.tx, '--ty': p.ty, '--rot': p.rot,
                      animationDelay: p.delay,
                    }} />
                  ))}
                </div>
              </div>
            </div>

            <div style={processingLabelStyle}>
              {loading ? 'Memuat data nota...' : 'Memproses pembayaran…'}
            </div>
            <div style={heroTitleStyle}>Nota Berhasil Dibuat!</div>
            <div style={heroSubStyle}>
              {loading
                ? nota
                  ? 'Menyimpan...'
                  : 'Mengambil data dari server...'
                : 'Nota laundry telah berhasil disimpan'}
            </div>
          </div>

          {/* Error Banner */}
          {fetchError && !nota && (
            <div style={errorBannerStyle}>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: '#DC2626', textAlign: 'center' }}>
                ⚠️ {fetchError}
              </div>
              <div style={{ marginTop: 12 }}>
                <button style={{ ...btnBase(false, false, true), width: '100%', height: 40, fontSize: 12 }} onClick={() => navigate('transaksi')}>
                  Lihat Daftar Transaksi
                </button>
              </div>
            </div>
          )}

          {/* Receipt Card */}
          <div style={cardStyle}>
            {/* No. Nota */}
            <div style={rRowStyle}>
              <span style={rKeyStyle}>No. Nota</span>
              <span style={rValAccentStyle}>{notaId || '—'}</span>
            </div>

            {/* Customer */}
            {nota?.customerName && (
              <div style={rRowStyle}>
                <span style={rKeyStyle}>Customer</span>
                <span style={rValStyle}>{nota.customerName}</span>
              </div>
            )}

            {/* Items count */}
            <div style={rRowStyle}>
              <span style={rKeyStyle}>Item</span>
              <span style={rValStyle}>{nota?.items?.length || 0} layanan</span>
            </div>

            {/* Estimasi Selesai */}
            {(nota?.dueDate || nota?.estimatedDoneAt) && (
              <div style={rRowStyle}>
                <span style={rKeyStyle}>Estimasi Selesai</span>
                <span style={rValAccentStyle}>
                  {new Date(nota.dueDate || nota.estimatedDoneAt).toLocaleDateString('id-ID', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </span>
              </div>
            )}

            {/* Express Badge */}
            {nota?.isExpress && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: '#FEF3C7', marginBottom: 8 }}>
                <span style={{ fontSize: 12 }}>⚡</span>
                <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600, color: '#D97706' }}>EXPRESS</span>
              </div>
            )}

            <div style={dividerStyle} />

            {/* Payment Status Badge */}
            {statusConfig && (
              <div style={lunasStyle}>
                <div style={lunasIconStyle}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11.5, fontWeight: 800, color: statusConfig.color, letterSpacing: '0.3px' }}>
                    {statusConfig.label}
                  </div>
                  <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 10.5, color: statusConfig.color, opacity: 0.8 }}>
                    {statusConfig.desc}
                  </div>
                </div>
              </div>
            )}

            {/* Payment Details */}
            <div style={rRowStyle}>
              <span style={rKeyStyle}>Total Tagihan</span>
              <span style={{ ...rValStyle, fontFamily: "'Poppins', sans-serif" }}>{rp(nota?.total || 0)}</span>
            </div>
            {(nota?.paidAmount || 0) > 0 && (
              <div style={rRowStyle}>
                <span style={rKeyStyle}>Sudah Dibayar</span>
                <span style={{ ...rValStyle, color: success }}>{rp(nota.paidAmount)}</span>
              </div>
            )}
            {balance > 0 && (
              <div style={rRowStyle}>
                <span style={rKeyStyle}>Sisa Pembayaran</span>
                <span style={{ ...rValStyle, color: C.danger }}>{rp(balance)}</span>
              </div>
            )}

            <div style={dividerStyle} />

            <div style={totalRowStyle}>
              <span style={totalKeyStyle}>Total</span>
              <span style={totalValStyle}>{rp(nota?.total || 0)}</span>
            </div>

            {/* Per-Item Production Status */}
            {nota?.items && nota.items.length > 0 && (
              <div>
                <div style={sectionLblStyle}>📦 STATUS PRODUKSI PER ITEM</div>
                {nota.items.map((item, idx) => {
                  const s = getProdStatus(item.productionStatus);
                  return (
                    <div key={idx} style={itemRowStyle}>
                      <div>
                        <div style={itemNameStyle}>{item.name || item.serviceName || 'Layanan'}</div>
                        <div style={itemQtyStyle}>{item.qty || 1} {item.unit || 'pcs'}</div>
                      </div>
                      <span style={itemStatusStyle}>{s.label}</span>
                    </div>
                  );
                })}
                {nota.itemsReadyCount !== undefined && (
                  <div style={readyNoteStyle}>
                    {nota.itemsReadyCount}/{nota.itemsTotalCount} item siap diambil
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={actionsStyle}>
            <div style={actionSectionStyle}>
              {/* Print */}
              {nota && (
                <button style={btnPrintStyle} onClick={handleCetakNota}>
                  🖨️ Cetak Nota & Label
                </button>
              )}
              <div style={actionRowStyle}>
                {/* WhatsApp */}
                {(nota?.customerPhone || passedNota?.phone || passedNota?.customerPhone) && (
                  <button style={{ ...btnWaStyle, flex: 1 }} onClick={() => sendWhatsApp(nota || passedNota)}>
                    💬 Kirim via WA
                  </button>
                )}
                <button style={{ ...btnOutlineStyle, flex: 1 }} onClick={() => navigate('nota_step1')}>
                  Buat Nota Baru
                </button>
              </div>
            </div>

            <div style={actionRowStyle}>
              <button style={{ ...btnGhostStyle, flex: 1, background: '#F3EEF8', color: primary }} onClick={() => navigate('transaksi')}>
                Lihat Transaksi
              </button>
              <button style={{ ...btnGhostStyle, flex: 1 }} onClick={() => navigate('dashboard')}>
                🏠 Ke Beranda
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
