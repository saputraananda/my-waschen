// ─────────────────────────────────────────────────────────────────────────────
// PaymentMethodGrouped — komponen pilihan metode pembayaran terkelompok
// ─────────────────────────────────────────────────────────────────────────────
// Group metode jadi 4 tab biar tidak overwhelming:
//   1. Tunai & Manual (cash, transfer, deposit, EDC)
//   2. QRIS (Midtrans QRIS — universal scan)
//   3. E-Wallet (GoPay, ShopeePay)
//   4. Virtual Account (BCA, BNI, BRI, Permata, Mandiri)
//
// Props:
//   value: string — selected method id
//   onChange: (methodId) => void
//   excludeIds: optional array — sembunyikan metode tertentu
//   showDeposit: optional boolean — tampilkan opsi deposit (butuh customer member)
//   depositBalance: optional number — display info saldo
//   amount: optional number — untuk validasi (mis. cash tender)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo, useRef } from 'react';
import { C } from '../utils/theme';
import { rp } from '../utils/helpers';

const EMPTY_EXCLUDE_IDS = [];

// ─── Definisi grup ─────────────────────────────────────────────────────────
const GROUPS = [
  {
    id: 'manual',
    label: 'Tunai & Manual',
    icon: '💵',
    color: '#10B981',
    methods: [
      { id: 'cash',     label: 'Tunai',          icon: '💵', desc: 'Bayar cash + auto kembalian' },
      { id: 'transfer', label: 'Transfer Bank',  icon: '🔁', desc: 'Customer transfer, kasir verifikasi' },
      { id: 'edc',      label: 'EDC Mesin',      icon: '💳', desc: 'Gesek di mesin EDC fisik' },
      { id: 'deposit',  label: 'Saldo Deposit',  icon: '💎', desc: 'Pakai saldo member', requireMember: true },
    ],
  },
  {
    id: 'qris',
    label: 'QRIS',
    icon: '📱',
    color: '#3B82F6',
    methods: [
      { id: 'qris', label: 'QRIS Midtrans', icon: '📱', desc: 'Scan QR universal — semua e-wallet & m-banking' },
    ],
  },
  {
    id: 'ewallet',
    label: 'E-Wallet',
    icon: '👛',
    color: '#A855F7',
    methods: [
      { id: 'gopay',     label: 'GoPay',     icon: '💚', desc: 'Buka aplikasi Gojek' },
      { id: 'shopeepay', label: 'ShopeePay', icon: '🛒', desc: 'Buka aplikasi Shopee' },
    ],
  },
  {
    id: 'va',
    label: 'Virtual Account',
    icon: '🏦',
    color: '#0F172A',
    methods: [
      { id: 'bca_va',     label: 'BCA',     icon: '🏛️', desc: 'Transfer via mobile/internet banking' },
      { id: 'bni_va',     label: 'BNI',     icon: '🏛️' },
      { id: 'bri_va',     label: 'BRI',     icon: '🏛️' },
      { id: 'permata_va', label: 'Permata', icon: '🏛️' },
      { id: 'mandiri_va', label: 'Mandiri', icon: '🏛️' },
    ],
  },
];

const MIDTRANS_METHODS = new Set(['qris', 'gopay', 'shopeepay', 'bca_va', 'bni_va', 'bri_va', 'permata_va', 'mandiri_va']);

export function isMidtransMethod(methodId) {
  return MIDTRANS_METHODS.has(methodId);
}

export default function PaymentMethodGrouped({
  value,
  onChange,
  excludeIds = EMPTY_EXCLUDE_IDS,
  showDeposit = true,
  depositBalance = 0,
  amount = 0,
  hint,
}) {
  const [activeGroup, setActiveGroup] = useState(() => {
    const match = GROUPS.find((g) => g.methods.some((m) => m.id === value));
    return match?.id || 'manual';
  });
  const prevValueRef = useRef(value);

  const visibleGroups = useMemo(() => GROUPS.map((g) => ({
    ...g,
    methods: g.methods.filter((m) => {
      if (excludeIds.includes(m.id)) return false;
      if (m.requireMember && !showDeposit) return false;
      return true;
    }),
  })).filter((g) => g.methods.length > 0), [excludeIds, showDeposit]);

  const selectedGroup = visibleGroups.find((g) => g.id === activeGroup) || visibleGroups[0];

  // Sync tab hanya saat value berubah dari luar (bukan saat user klik tab)
  useEffect(() => {
    if (value === prevValueRef.current) return;
    prevValueRef.current = value;
    if (!value) return;
    const group = visibleGroups.find((g) => g.methods.some((m) => m.id === value));
    if (group) setActiveGroup(group.id);
  }, [value, visibleGroups]);

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Group tabs — horizontal scroll on mobile */}
      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8,
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        {visibleGroups.map((g) => {
          const active = activeGroup === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setActiveGroup(g.id)}
              style={{
                flexShrink: 0, padding: '8px 14px', borderRadius: 999,
                border: `1.5px solid ${active ? g.color : C.n200}`,
                background: active ? `${g.color}10` : 'white',
                color: active ? g.color : C.n700,
                fontFamily: 'Poppins', fontSize: 12, fontWeight: active ? 700 : 600,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 14 }}>{g.icon}</span>
              {g.label}
              <span style={{
                fontSize: 9, fontWeight: 700,
                background: active ? `${g.color}20` : C.n100,
                color: active ? g.color : C.n500,
                padding: '1px 6px', borderRadius: 999,
              }}>{g.methods.length}</span>
            </button>
          );
        })}
      </div>

      {/* Method cards in selected group */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {selectedGroup?.methods.map((m) => {
          const active = value === m.id;
          // Disable deposit kalau saldo tidak cukup
          const isDeposit = m.id === 'deposit';
          const insufficientDeposit = isDeposit && depositBalance < amount;
          const disabled = insufficientDeposit;

          return (
            <button
              key={m.id}
              onClick={() => !disabled && onChange(m.id)}
              disabled={disabled}
              style={{
                padding: '12px 14px', borderRadius: 12,
                border: `1.5px solid ${active ? selectedGroup.color : disabled ? C.n100 : C.n200}`,
                background: active ? `${selectedGroup.color}12` : disabled ? C.n50 : 'white',
                cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'flex-start', gap: 10,
                opacity: disabled ? 0.55 : 1,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>{m.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'Poppins', fontSize: 12, fontWeight: 700,
                  color: active ? selectedGroup.color : C.n900,
                }}>
                  {m.label}
                </div>
                {m.desc && (
                  <div style={{
                    fontFamily: 'Poppins', fontSize: 9, color: C.n500,
                    marginTop: 2, lineHeight: 1.3,
                  }}>
                    {m.desc}
                  </div>
                )}
                {isDeposit && (
                  <div style={{
                    fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
                    color: insufficientDeposit ? '#DC2626' : '#15803D',
                    marginTop: 4,
                  }}>
                    {insufficientDeposit ? `❌ ${rp(depositBalance)}` : `✓ ${rp(depositBalance)}`}
                  </div>
                )}
              </div>
              {active && (
                <span style={{
                  fontSize: 16, color: selectedGroup.color, flexShrink: 0,
                }}>✓</span>
              )}
            </button>
          );
        })}
      </div>

      {hint && (
        <div style={{
          fontFamily: 'Poppins', fontSize: 10, color: C.n500,
          marginTop: 8, lineHeight: 1.4,
        }}>
          {hint}
        </div>
      )}
    </div>
  );
}
