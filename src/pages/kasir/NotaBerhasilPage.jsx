import { useEffect } from 'react';

import { C, SHADOW } from '../../utils/theme';

import { rp } from '../../utils/helpers';

import { Btn } from '../../components/ui';

import { useResponsive, useWindowSize } from '../../utils/hooks';
import { hapticSuccess } from '../../utils/haptic';

// ─── Payment Status Auto-Detection ──────────────────────────────────────────────
function getPaymentStatus(paidAmount, total) {
  if (!paidAmount || paidAmount <= 0) return 'bayar_nanti';
  if (paidAmount >= total) return 'lunas';
  return 'dp';
}

const PAYMENT_STATUS_CONFIG = {
  lunas: {
    label: 'LUNAS',
    color: '#059669',
    bg: '#d1fae5',
    icon: '✅',
    desc: 'Pembayaran sudah lunas',
  },
  dp: {
    label: 'UANG MUKA',
    color: '#d97706',
    bg: '#fef3c7',
    icon: '💰',
    desc: 'Ada uang muka / DP',
  },
  bayar_nanti: {
    label: 'BAYAR NANTI',
    color: '#6b7280',
    bg: '#f3f4f6',
    icon: '⏳',
    desc: 'Belum ada pembayaran',
  },
};



// Template WA — bisa diubah sesuai kebutuhan outlet
const buildWhatsAppMessage = (nota) => {
  const lines = [];
  lines.push(`Halo ${nota.customerName},`);
  lines.push('');
  lines.push('Terima kasih sudah mempercayakan cucian Anda di *Waschen Laundry* 🧺');
  lines.push('');
  lines.push(`*Nota:* ${nota.id}`);

  // Payment Status
  const paidAmount = Number(nota.paidAmount) || 0;
  const total = Number(nota.total) || 0;
  const balance = Math.max(0, total - paidAmount);

  if (paidAmount <= 0) {
    lines.push('📋 *Status:* _Belum dibayar_');
  } else if (paidAmount >= total) {
    lines.push('✅ *Status:* _Lunas_');
  } else {
    lines.push('💰 *Status:* _Uang Muka (DP)_');
  }

  if (nota.items?.length) {
    lines.push('*Item:*');
    nota.items.forEach((it, i) => {
      lines.push(`${i + 1}. ${it.name || it.serviceName} — ${it.qty} ${it.unit}`);
    });
  }
  lines.push('');
  lines.push(`*Total:* ${rp(total)}`);
  if (paidAmount > 0) {
    lines.push(`Sudah dibayar: ${rp(paidAmount)}`);
  }
  if (balance > 0) {
    lines.push(`Sisa pembayaran: ${rp(balance)}`);
  }
  if (nota.dueDate) {
    const dt = nota.dueDate instanceof Date ? nota.dueDate : new Date(nota.dueDate);
    if (!isNaN(dt.getTime())) {
      lines.push(`Estimasi selesai: ${dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`);
    }
  }
  lines.push('');
  lines.push('Sampai jumpa kembali 🙌');
  return lines.join('\n');
};

const sendWhatsApp = (nota) => {
  const phone = (nota.customerPhone || '').replace(/\D/g, '');
  if (!phone) {
    alert('Nomor HP customer tidak tersedia.');
    return;
  }
  // Normalisasi: 08xxx → 628xxx
  const normalized = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
  const text = encodeURIComponent(buildWhatsAppMessage(nota));
  const url = `https://wa.me/${normalized}?text=${text}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};



export default function NotaBerhasilPage({ navigate, screenParams }) {
  const { isMobile } = useResponsive();
  const nota = screenParams;

  // Compute payment status from nota data
  const paymentStatus = nota ? getPaymentStatus(Number(nota.paidAmount) || 0, Number(nota.total) || 0) : null;
  const statusConfig = paymentStatus ? PAYMENT_STATUS_CONFIG[paymentStatus] : null;
  const balance = nota ? Math.max(0, Number(nota.total || 0) - Number(nota.paidAmount || 0)) : 0;

  // Haptic feedback on mount — checkout success

  useEffect(() => { hapticSuccess(); }, []);

  // Block browser back navigation — transaksi sudah berhasil, jangan bisa kembali
  useEffect(() => {
    // Replace current state to clear history depth (so goBack goes to dashboard)
    window.history.replaceState(
      { screen: 'nota_berhasil', params: screenParams, depth: 0 },
      '',
      window.location.pathname
    );

    // Push a blocker entry so that pressing back stays on this page
    const handlePopState = (e) => {
      // Re-push state to prevent leaving this page via back button
      window.history.pushState(
        { screen: 'nota_berhasil', params: screenParams, depth: 0 },
        '',
        window.location.pathname
      );
    };

    // Push one extra state so we can intercept back
    window.history.pushState(
      { screen: 'nota_berhasil', params: screenParams, depth: 0 },
      '',
      window.location.pathname
    );

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);



  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.n50, padding: isMobile ? 16 : 24 }}>

      <div style={{ width: isMobile ? 72 : 88, height: isMobile ? 72 : 88, borderRadius: isMobile ? 36 : 44, background: `linear-gradient(135deg, ${C.success}, ${C.success}CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: `0 8px 24px ${C.success}44` }}>

        <svg width={isMobile ? 36 : 44} height={isMobile ? 36 : 44} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>

      </div>

      <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 18 : 22, fontWeight: 600, color: C.n900, marginBottom: 6, textAlign: 'center' }}>Nota Berhasil Dibuat!</div>

      <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 14, color: C.n600, marginBottom: 24, textAlign: 'center' }}>Nota laundry telah berhasil disimpan</div>



      {nota && (

        <div style={{ width: '100%', maxWidth: 400, background: C.white, borderRadius: 16, padding: isMobile ? '12px 14px' : '16px 20px', boxShadow: SHADOW.md, marginBottom: 24 }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>

            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: 'C.n600' }}>No. Nota</span>

            <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.primary }}>{nota.id}</span>

          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>

            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: 'C.n600' }}>Customer</span>

            <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{nota.customerName}</span>

          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>

            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: 'C.n600' }}>Item</span>

            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{nota.items?.length} layanan</span>

          </div>

          <div style={{ height: 1, background: C.n100, margin: '8px 0' }} />

          {/* Payment Status Badge */}
          {statusConfig && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 10,
              background: statusConfig.bg,
              marginBottom: 12,
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
        </div>
      )}



      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: isMobile ? 80 : 0 }}>

        {nota && (

          <Btn variant="primary" fullWidth size="lg" onClick={() => navigate('cetak_nota', { id: nota.id })}>

            🖨️ Cetak Nota & Label

          </Btn>

        )}

        {nota?.customerPhone && (
          <button
            onClick={() => sendWhatsApp(nota)}
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


