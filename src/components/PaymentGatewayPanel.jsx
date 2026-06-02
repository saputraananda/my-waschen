// ─────────────────────────────────────────────────────────────────────────────
// PaymentGatewayPanel — panel report payment gateway untuk admin/finance/kasir
// ─────────────────────────────────────────────────────────────────────────────
// Tampilkan ringkasan transaksi midtrans + breakdown per channel.
// Pakai endpoint /api/payments/report yang sudah respect outlet scoping.
//
// Props: { startDate, endDate, outletId }
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { getPaymentReport } from '../utils/paymentApi';
import { rp } from '../utils/helpers';
import { C } from '../utils/theme';

const CHANNEL_LABEL = {
  qris: 'QRIS',
  gopay: 'GoPay',
  shopeepay: 'ShopeePay',
  ovo: 'OVO',
  dana: 'DANA',
  bca_va: 'VA BCA',
  bni_va: 'VA BNI',
  bri_va: 'VA BRI',
  permata_va: 'VA Permata',
  mandiri_va: 'Mandiri Bill',
  cash: 'Tunai',
  transfer: 'Transfer Manual',
  deposit: 'Deposit',
};

const STATUS_BADGE = {
  paid:    { label: 'Lunas',  bg: '#DCFCE7', fg: '#15803D' },
  pending: { label: 'Pending', bg: '#FEF3C7', fg: '#92400E' },
  failed:  { label: 'Gagal',   bg: '#FEE2E2', fg: '#991B1B' },
};

export default function PaymentGatewayPanel({ startDate, endDate, outletId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPaymentReport({ startDate, endDate, outletId })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || 'Gagal memuat laporan gateway.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [startDate, endDate, outletId]);

  if (loading) {
    return (
      <div style={{ background: 'white', borderRadius: 12, padding: 16, fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>
        Memuat laporan payment gateway…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ background: '#FEF2F2', borderRadius: 12, padding: 12, fontFamily: 'Poppins', fontSize: 12, color: C.danger }}>
        {error}
      </div>
    );
  }
  if (!data) return null;

  const { summary, breakdown } = data;
  const totalAll = (summary.totalPaid || 0) + (summary.totalPending || 0) + (summary.totalFailed || 0);
  const midtransShare = totalAll > 0 ? (summary.midtransRevenue / (summary.midtransRevenue + summary.manualRevenue || 1)) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header summary */}
      <div style={{
        background: 'linear-gradient(135deg, #1E293B 0%, #0C4A6E 100%)',
        borderRadius: 14, padding: '14px 16px', color: 'white',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 }}>
          💳 PAYMENT GATEWAY SUMMARY
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          <SummaryTile label="Lunas" value={rp(summary.totalPaid)} sub={`${summary.totalTransactions} transaksi`} tone="green" />
          <SummaryTile label="Pending" value={rp(summary.totalPending)} sub="Belum lunas" tone="amber" />
          <SummaryTile label="Midtrans" value={rp(summary.midtransRevenue)} sub={`${midtransShare.toFixed(0)}%`} tone="blue" />
          <SummaryTile label="Manual/Cash" value={rp(summary.manualRevenue)} sub="Cash + transfer manual" tone="white" />
        </div>
      </div>

      {/* Breakdown per channel */}
      {breakdown && breakdown.length > 0 && (
        <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, letterSpacing: 0.5, marginBottom: 10 }}>
            📊 BREAKDOWN PER CHANNEL
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {breakdown.map((row, i) => {
              const badge = STATUS_BADGE[row.status] || { label: row.status, bg: C.n100, fg: C.n700 };
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  background: C.n50, borderRadius: 10,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: row.gateway === 'midtrans' ? '#DBEAFE' : '#F3F4F6',
                    border: `1px solid ${row.gateway === 'midtrans' ? '#93C5FD' : C.n200}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                  }}>
                    {row.gateway === 'midtrans' ? '⚡' : '💵'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n900 }}>
                      {CHANNEL_LABEL[row.channel] || row.channel}
                      {row.gateway && row.gateway !== 'manual' && (
                        <span style={{
                          marginLeft: 6, fontSize: 9, fontWeight: 700,
                          padding: '1px 5px', borderRadius: 4,
                          background: '#1E40AF', color: 'white',
                        }}>
                          {row.gateway.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 1 }}>
                      {row.count} transaksi
                    </div>
                  </div>
                  <span style={{
                    fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
                    padding: '2px 7px', borderRadius: 999,
                    background: badge.bg, color: badge.fg,
                  }}>
                    {badge.label}
                  </span>
                  <div style={{
                    fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.primary,
                    minWidth: 90, textAlign: 'right',
                  }}>
                    {rp(row.totalAmount)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, sub, tone }) {
  const tones = {
    green: { bg: 'rgba(16,185,129,0.20)', text: '#D1FAE5', sub: '#A7F3D0' },
    amber: { bg: 'rgba(245,158,11,0.20)', text: '#FEF3C7', sub: '#FDE68A' },
    blue:  { bg: 'rgba(59,130,246,0.20)', text: '#DBEAFE', sub: '#BFDBFE' },
    white: { bg: 'rgba(255,255,255,0.10)', text: 'white', sub: 'rgba(255,255,255,0.7)' },
  };
  const s = tones[tone] || tones.white;
  return (
    <div style={{
      background: s.bg, borderRadius: 10, padding: '8px 10px',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{ fontFamily: 'Poppins', fontSize: 9, color: s.sub, fontWeight: 700, letterSpacing: 0.3 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 800, color: s.text, marginTop: 2, lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: 'Poppins', fontSize: 9, color: s.sub, marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
