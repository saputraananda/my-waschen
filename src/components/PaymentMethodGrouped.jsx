// ─────────────────────────────────────────────────────────────────────────────
// PaymentMethodGrouped — komponen pilihan metode pembayaran terkelompok
// ─────────────────────────────────────────────────────────────────────────────
// Group metode:
//   1. Tunai & Manual (cash, transfer, deposit, EDC)
//   2. QRIS (QRIS Static)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo, useRef } from 'react';
import { C } from '../utils/theme';
import { rp } from '../utils/helpers';
import { brand } from '../utils/colors';
import { IconMoney, IconClock, IconCheck, IconClose } from './ui/StatusIcons';

// SVG Icons for payment methods
const PaymentMethodIcon = ({ type, size = 22 }) => {
  const baseStyle = { flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };

  switch (type) {
    case 'cash':
      return (
        <span style={baseStyle}>
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect x="1" y="4" width="22" height="16" rx="2" stroke="#059669" strokeWidth="2"/>
            <circle cx="12" cy="12" r="3" stroke="#059669" strokeWidth="2"/>
            <path d="M1 10h2M21 10h2M1 14h2M21 14h2" stroke="#059669" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </span>
      );
    case 'transfer':
      return (
        <span style={baseStyle}>
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M17 1l4 4-4 4" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 23l-4-4 4-4" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      );
    case 'edc':
      return (
        <span style={baseStyle}>
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect x="2" y="5" width="20" height="14" rx="2" stroke="#7C3AED" strokeWidth="2"/>
            <path d="M2 10h20" stroke="#7C3AED" strokeWidth="2"/>
            <path d="M6 15h4" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </span>
      );
    case 'deposit':
      return (
        <span style={baseStyle}>
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#F59E0B" stroke="#F59E0B" strokeWidth="1.5"/>
          </svg>
        </span>
      );
    case 'qris':
      return (
        <span style={baseStyle}>
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1" fill="#5B005F"/>
            <rect x="14" y="3" width="7" height="7" rx="1" fill="#5B005F"/>
            <rect x="3" y="14" width="7" height="7" rx="1" fill="#5B005F"/>
            <rect x="17" y="17" width="4" height="4" fill="#5B005F"/>
          </svg>
        </span>
      );
    case 'manual':
    default:
      return (
        <span style={baseStyle}>
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect x="1" y="4" width="22" height="16" rx="2" stroke="#5B005F" strokeWidth="2"/>
            <path d="M1 10h22" stroke="#5B005F" strokeWidth="2"/>
          </svg>
        </span>
      );
  }
};

const EMPTY_EXCLUDE_IDS = [];

// ─── Definisi grup ──────────────────────────────────────────────────────────
const GROUPS = [
  {
    id: 'non-tunai',
    label: 'Non-Tunai',
    icon: 'transfer',
    color: brand.primary,
    methods: [
      { id: 'qris',     label: 'QRIS Static',     icon: 'qris',     desc: 'Scan QRIS — semua e-wallet & m-banking' },
      { id: 'edc',      label: 'EDC Mesin',       icon: 'edc',      desc: 'Gesek kartu di mesin EDC' },
      { id: 'transfer', label: 'Transfer Bank',    icon: 'transfer', desc: 'Customer transfer, kasir verifikasi' },
      { id: 'deposit',  label: 'Saldo Deposit',   icon: 'deposit',  desc: 'Pakai saldo member / top up', requireMember: true },
    ],
  },
];

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
    return match?.id || 'non-tunai';
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
      {/* Group tabs — only show if more than 1 group */}
      {visibleGroups.length > 1 && (
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
                fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <PaymentMethodIcon type={g.icon} size={14} />
              {g.label}
              <span style={{
                fontSize: 9, fontWeight: 700,
                background: active ? `${g.color}20` : C.n100,
                color: active ? g.color : '#3a3a3a',
                padding: '1px 6px', borderRadius: 999,
              }}>{g.methods.length}</span>
            </button>
          );
        })}
      </div>
      )}

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
              <PaymentMethodIcon type={m.icon} size={22} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                  color: active ? selectedGroup.color : C.n900,
                }}>
                  {m.label}
                </div>
                {m.desc && (
                  <div style={{
                    fontFamily: 'Poppins', fontSize: 9, color: '#3a3a3a',
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}>
                    {insufficientDeposit ? <><IconClose size={10} color="#DC2626" /> {rp(depositBalance)}</> : <><IconCheck size={10} color="#15803D" /> {rp(depositBalance)}</>}
                  </div>
                )}
              </div>
              {active && (
                <IconCheck size={16} color={selectedGroup.color} />
              )}
            </button>
          );
        })}
      </div>

      {hint && (
        <div style={{
          fontFamily: 'Poppins', fontSize: 10, color: '#3a3a3a',
          marginTop: 8, lineHeight: 1.4,
        }}>
          {hint}
        </div>
      )}
    </div>
  );
}
