// ─────────────────────────────────────────────────────────────────────────────
// PaymentChannelSelector — modal pilih channel pembayaran Midtrans
// ─────────────────────────────────────────────────────────────────────────────
// Render BottomSheet/Modal dengan list channel grouped: QRIS, E-wallet, VA Bank.
// Kasih tau parent kalau user pilih salah satu lewat onSelect(channel).
// ─────────────────────────────────────────────────────────────────────────────
import { C } from '../utils/theme';
import { rp } from '../utils/helpers';

const CHANNELS = [
  {
    group: 'QRIS',
    icon: '📱',
    description: 'Bayar dengan scan QR — semua e-wallet & m-banking',
    items: [
      { value: 'qris', label: 'QRIS', sub: 'GoPay, OVO, DANA, ShopeePay, BCA, dll', emoji: '📱' },
    ],
  },
  {
    group: 'E-Wallet',
    icon: '💳',
    description: 'Buka aplikasi via deeplink',
    items: [
      { value: 'gopay',     label: 'GoPay',     sub: 'Buka aplikasi GoJek', emoji: '🟢' },
      { value: 'shopeepay', label: 'ShopeePay', sub: 'Buka aplikasi Shopee', emoji: '🟠' },
    ],
  },
  {
    group: 'Virtual Account Bank',
    icon: '🏦',
    description: 'Bayar via mobile banking / ATM',
    items: [
      { value: 'bca_va',     label: 'BCA',     sub: 'Virtual Account BCA',     emoji: '🔵' },
      { value: 'bni_va',     label: 'BNI',     sub: 'Virtual Account BNI',     emoji: '🟧' },
      { value: 'bri_va',     label: 'BRI',     sub: 'Virtual Account BRI',     emoji: '🟦' },
      { value: 'permata_va', label: 'Permata', sub: 'Virtual Account Permata', emoji: '🟢' },
      { value: 'mandiri_va', label: 'Mandiri', sub: 'Mandiri Bill Payment',    emoji: '🟦' },
    ],
  },
];

export default function PaymentChannelSelector({ visible, onClose, onSelect, amount, title = 'Pilih Metode Pembayaran' }) {
  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
          zIndex: 200, animation: 'fadeIn 0.18s ease',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'white', borderRadius: '20px 20px 0 0',
        zIndex: 201, maxHeight: '90vh', overflowY: 'auto',
        animation: 'slideUp 0.24s cubic-bezier(0.32, 0.72, 0, 1)',
        boxShadow: '0 -8px 32px rgba(15,23,42,0.18)',
      }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.n200, margin: '10px auto' }} />

        {/* Header */}
        <div style={{ padding: '8px 18px 14px', borderBottom: `1px solid ${C.n100}` }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: C.n900 }}>{title}</div>
          {amount != null && (
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 4 }}>
              Total bayar: <strong style={{ color: C.primary }}>{rp(amount)}</strong>
            </div>
          )}
        </div>

        {/* Channel groups */}
        <div style={{ padding: '12px 18px 24px' }}>
          {CHANNELS.map((group) => (
            <div key={group.group} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>{group.icon}</span>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n800, letterSpacing: 0.4 }}>
                    {group.group.toUpperCase()}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 1 }}>
                    {group.description}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.items.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => { onSelect(item.value); onClose(); }}
                    style={{
                      width: '100%', textAlign: 'left',
                      background: 'white', borderRadius: 12,
                      padding: '10px 12px',
                      border: `1.5px solid ${C.n100}`,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = C.primary;
                      e.currentTarget.style.background = `${C.primary}06`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = C.n100;
                      e.currentTarget.style.background = 'white';
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: C.n50, border: `1px solid ${C.n100}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                    }}>
                      {item.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>
                        {item.label}
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 1 }}>
                        {item.sub}
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={onClose}
            style={{
              width: '100%', height: 44, borderRadius: 12,
              border: `1.5px solid ${C.n200}`,
              background: 'white',
              fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n700,
              cursor: 'pointer',
            }}
          >
            Batal
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  );
}
