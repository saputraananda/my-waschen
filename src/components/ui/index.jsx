import { useState } from 'react';
import { C, T } from '../../utils/theme';
import { STATUS_COLORS, STAGES, rp } from '../../utils/helpers';

// ── useToast ─────────────────────────────────────────────
export const useToast = () => {
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500);
  };
  return [toast, showToast];
};

// ── TopBar ────────────────────────────────────────────────
export const TopBar = ({ title, onBack, rightAction, rightIcon, subtitle }) => (
  <div style={{ height: 56, background: C.white, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, borderBottom: `1px solid ${C.n100}`, flexShrink: 0, position: 'relative', zIndex: 10 }}>
    {onBack && (
      <button onClick={onBack} style={{ width: 40, height: 40, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n900 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
      </button>
    )}
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900, lineHeight: 1.2 }}>{title}</div>
      {subtitle && <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 1 }}>{subtitle}</div>}
    </div>
    {rightAction && (
      <button onClick={rightAction} style={{ width: 40, height: 40, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n600 }}>
        {rightIcon}
      </button>
    )}
  </div>
);

// ── NAV_ICONS ─────────────────────────────────────────────
export const NAV_ICONS = {
  home: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  tx: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  customer: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
  profile: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  queue: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>,
  approval: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>,
  monitor: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
  history: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.5" /></svg>,
};

// ── BottomNav ─────────────────────────────────────────────
export const BottomNav = ({ role, active, navigate }) => {
  const tabs =
    role === 'kasir'
      ? [
          { id: 'dashboard', label: 'Beranda', icon: NAV_ICONS.home },
          { id: 'transaksi', label: 'Transaksi', icon: NAV_ICONS.tx },
          { id: '_fab', label: '', icon: null },
          { id: 'customer', label: 'Customer', icon: NAV_ICONS.customer },
          { id: 'settings', label: 'Profil', icon: NAV_ICONS.profile },
        ]
      : role === 'produksi'
      ? [
          { id: 'dashboard', label: 'Beranda', icon: NAV_ICONS.home },
          { id: 'antrian', label: 'Antrian', icon: NAV_ICONS.queue },
          { id: '_fab', label: '', icon: null },
          { id: 'history_produksi', label: 'Riwayat', icon: NAV_ICONS.history },
          { id: 'settings', label: 'Profil', icon: NAV_ICONS.profile },
        ]
      : [
          { id: 'dashboard', label: 'Beranda', icon: NAV_ICONS.home },
          { id: 'approval', label: 'Approval', icon: NAV_ICONS.approval },
          { id: '_fab', label: '', icon: null },
          { id: 'monitoring', label: 'Monitor', icon: NAV_ICONS.monitor },
          { id: 'settings', label: 'Profil', icon: NAV_ICONS.profile },
        ];

  const fabAction =
    role === 'kasir'
      ? () => navigate('nota_step1')
      : role === 'produksi'
      ? () => navigate('antrian')
      : () => navigate('approval');

  return (
    <div style={{ height: 72, background: C.white, borderTop: `1px solid ${C.n100}`, display: 'flex', alignItems: 'center', paddingBottom: 4, flexShrink: 0, position: 'relative', zIndex: 20 }}>
      {tabs.map((tab) => {
        if (tab.id === '_fab')
          return (
            <div key="_fab" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <button
                onClick={fabAction}
                style={{ width: 52, height: 52, borderRadius: 26, background: `linear-gradient(135deg, ${C.primarySoft}, ${C.primary})`, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${C.primary}55`, color: C.white, marginBottom: 8 }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </button>
            </div>
          );
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.id)}
            style={{ flex: 1, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: isActive ? C.primary : C.n600 }}
          >
            <div style={{ position: 'relative' }}>
              {tab.icon}
              {isActive && <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: 2, background: C.primary }} />}
            </div>
            <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// ── Btn ───────────────────────────────────────────────────
export const Btn = ({ variant = 'primary', children, onClick, disabled, loading, fullWidth, icon, size = 'md', style: extraStyle = {} }) => {
  const [pressed, setPressed] = useState(false);
  const h = size === 'sm' ? 36 : size === 'lg' ? 52 : 48;
  const fs = size === 'sm' ? 13 : size === 'lg' ? 16 : 14;
  const base = { height: h, borderRadius: 12, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'Poppins', fontSize: fs, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: fullWidth ? '100%' : 'auto', padding: '0 20px', transition: 'all 0.2s ease', opacity: disabled ? 0.5 : 1, transform: pressed ? 'scale(0.98)' : 'scale(1)', ...extraStyle };
  const styles = {
    primary: { ...base, background: pressed ? C.primaryDark : `linear-gradient(135deg, ${C.primarySoft}, ${C.primary})`, color: C.white, boxShadow: disabled ? 'none' : `0 2px 8px ${C.primary}44` },
    secondary: { ...base, background: C.white, color: C.primary, border: `1.5px solid ${C.primary}` },
    danger: { ...base, background: C.danger, color: C.white },
    ghost: { ...base, background: 'transparent', color: C.primary, height: 'auto', padding: '6px 12px' },
    success: { ...base, background: C.success, color: C.white },
  };
  return (
    <button
      style={styles[variant] || styles.primary}
      onClick={!disabled && !loading ? onClick : undefined}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      disabled={disabled}
    >
      {loading ? <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : null}
      {!loading && icon}
      {!loading && children}
    </button>
  );
};

// ── Input ─────────────────────────────────────────────────
export const Input = ({ label, value, onChange, type = 'text', error, placeholder, rightIcon, autoFocus, inputMode }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n600, marginBottom: 6 }}>{label}</div>}
      <div style={{ position: 'relative' }}>
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} inputMode={inputMode} autoFocus={autoFocus}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ width: '100%', height: 48, borderRadius: 10, padding: rightIcon ? '0 44px 0 14px' : '0 14px', border: `${focused ? 2 : 1.5}px solid ${error ? C.danger : focused ? C.primary : C.n300}`, fontFamily: 'Poppins', fontSize: 14, color: C.n900, background: C.white, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
        />
        {rightIcon && <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: C.n600 }}>{rightIcon}</div>}
      </div>
      {error && <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.danger, marginTop: 4 }}>{error}</div>}
    </div>
  );
};

// ── Textarea ──────────────────────────────────────────────
export const Textarea = ({ label, value, onChange, placeholder, rows = 3 }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n600, marginBottom: 6 }}>{label}</div>}
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', borderRadius: 10, padding: '12px 14px', border: `${focused ? 2 : 1.5}px solid ${focused ? C.primary : C.n300}`, fontFamily: 'Poppins', fontSize: 14, color: C.n900, background: C.white, outline: 'none', resize: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
      />
    </div>
  );
};

// ── Select ────────────────────────────────────────────────
export const Select = ({ label, value, onChange, options, error }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n600, marginBottom: 6 }}>{label}</div>}
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', height: 48, borderRadius: 10, padding: '0 14px', border: `${focused ? 2 : 1.5}px solid ${error ? C.danger : focused ? C.primary : C.n300}`, fontFamily: 'Poppins', fontSize: 14, color: value ? C.n900 : C.n600, background: C.white, outline: 'none', boxSizing: 'border-box', appearance: 'none', cursor: 'pointer' }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.danger, marginTop: 4 }}>{error}</div>}
    </div>
  );
};

// ── Badge ─────────────────────────────────────────────────
export const Badge = ({ status, label, small }) => {
  const s = STATUS_COLORS[status] || { bg: C.n100, text: C.n600 };
  return (
    <span style={{ background: s.bg, color: s.text, fontFamily: 'Poppins', fontSize: small ? 10 : 11, fontWeight: 600, padding: small ? '2px 8px' : '3px 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      {status === 'proses' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.warning }} />}
      {label || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// ── Avatar ────────────────────────────────────────────────
export const Avatar = ({ initials, size = 40 }) => (
  <div style={{ width: size, height: size, borderRadius: size / 2, background: `linear-gradient(135deg, ${C.primaryLight}, ${C.secondary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <span style={{ fontFamily: 'Poppins', fontSize: size * 0.35, fontWeight: 700, color: C.primary }}>{initials}</span>
  </div>
);

// ── Toast ─────────────────────────────────────────────────
export const Toast = ({ message, type = 'success', visible }) => (
  <div style={{ position: 'absolute', bottom: 90, left: 16, right: 16, zIndex: 9999, background: type === 'success' ? C.success : type === 'error' ? C.danger : C.n900, color: C.white, borderRadius: 12, padding: '12px 16px', fontFamily: 'Poppins', fontSize: 13, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', transform: visible ? 'translateY(0)' : 'translateY(80px)', opacity: visible ? 1 : 0, transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'flex', alignItems: 'center', gap: 10 }}>
    {type === 'success' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>}
    {message}
  </div>
);

// ── BottomSheet ───────────────────────────────────────────
export const BottomSheet = ({ visible, onClose, title, children }) => (
  <>
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity 0.25s' }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.white, borderRadius: '20px 20px 0 0', zIndex: 101, padding: '0 0 32px', transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)', maxHeight: '85%', overflowY: 'auto' }}>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: C.n300, margin: '12px auto 4px' }} />
      {title && <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900, padding: '12px 20px 8px' }}>{title}</div>}
      {children}
    </div>
  </>
);

// ── Modal ─────────────────────────────────────────────────
export const Modal = ({ visible, onClose, title, children }) => (
  <>
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity 0.2s' }} />
    <div style={{ position: 'absolute', top: '50%', left: 20, right: 20, background: C.white, borderRadius: 20, zIndex: 201, padding: 24, transform: visible ? 'translate(0, -50%) scale(1)' : 'translate(0, -50%) scale(0.9)', opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
      {title && <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900, marginBottom: 16 }}>{title}</div>}
      {children}
    </div>
  </>
);

// ── StatCard ──────────────────────────────────────────────
export const StatCard = ({ label, value, sub, icon, color = C.primary, onClick }) => (
  <div onClick={onClick} style={{ background: C.white, borderRadius: 16, padding: '14px 16px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', minWidth: 130, cursor: onClick ? 'pointer' : 'default', flexShrink: 0 }}>
    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, color }}>{icon}</div>
    <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 700, color: C.n900 }}>{value}</div>
    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>{label}</div>
    {sub && <div style={{ fontFamily: 'Poppins', fontSize: 10, color, marginTop: 3, fontWeight: 500 }}>{sub}</div>}
  </div>
);

// ── Chip ──────────────────────────────────────────────────
export const Chip = ({ label, active, onClick, color = C.primary }) => (
  <button
    onClick={onClick}
    style={{ padding: '6px 14px', borderRadius: 999, border: `1.5px solid ${active ? color : C.n300}`, background: active ? C.primaryLight : C.white, color: active ? color : C.n600, fontFamily: 'Poppins', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
  >
    {label}
  </button>
);

// ── Divider ───────────────────────────────────────────────
export const Divider = ({ mx = 0, my = 12 }) => <div style={{ height: 1, background: C.n100, margin: `${my}px ${mx}px` }} />;

// ── SearchBar ─────────────────────────────────────────────
export const SearchBar = ({ value, onChange, placeholder = 'Cari...' }) => (
  <div style={{ position: 'relative', marginBottom: 12 }}>
    <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.n600 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
    </div>
    <input
      value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', height: 44, borderRadius: 10, padding: '0 40px 0 38px', border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 14, color: C.n900, background: C.white, outline: 'none', boxSizing: 'border-box' }}
    />
    {value && (
      <button onClick={() => onChange('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: C.n600, display: 'flex', padding: 4 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    )}
  </div>
);

// ── EmptyState ────────────────────────────────────────────
export const EmptyState = ({ title, subtitle, action, actionLabel }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12, textAlign: 'center' }}>
    <div style={{ width: 72, height: 72, borderRadius: 36, background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.primarySoft} strokeWidth="1.5" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
    </div>
    <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: C.n900 }}>{title}</div>
    {subtitle && <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>{subtitle}</div>}
    {action && <Btn variant="secondary" onClick={action} size="sm">{actionLabel}</Btn>}
  </div>
);

// ── FAB ───────────────────────────────────────────────────
export const FAB = ({ onClick, icon }) => (
  <button onClick={onClick} style={{ position: 'absolute', bottom: 88, right: 20, width: 52, height: 52, borderRadius: 26, background: `linear-gradient(135deg, ${C.primarySoft}, ${C.primary})`, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 20px ${C.primary}55`, color: C.white, zIndex: 50 }}>
    {icon || <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
  </button>
);

// ── SectionHeader ─────────────────────────────────────────
export const SectionHeader = ({ title, action, actionLabel }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
    <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{title}</div>
    {action && <button onClick={action} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.primary }}>{actionLabel || 'Lihat semua →'}</button>}
  </div>
);

// ── ProgressTimeline ──────────────────────────────────────
export const ProgressTimeline = ({ progress }) => {
  const doneStages = (progress || []).map((p) => p.stage);
  return (
    <div style={{ padding: '0 4px' }}>
      {STAGES.map((stage, i) => {
        const done = doneStages.includes(stage);
        const info = progress?.find((p) => p.stage === stage);
        return (
          <div key={stage} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20 }}>
              <div style={{ width: 20, height: 20, borderRadius: 10, background: done ? C.primary : C.n100, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: done ? 'none' : `2px solid ${C.n300}` }}>
                {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>}
              </div>
              {i < STAGES.length - 1 && <div style={{ width: 2, height: 24, background: done ? C.primaryLight : C.n100, marginTop: 2, marginBottom: 2 }} />}
            </div>
            <div style={{ flex: 1, paddingBottom: i < STAGES.length - 1 ? 12 : 0 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: done ? 600 : 400, color: done ? C.n900 : C.n600 }}>{stage}</div>
              {info && <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>{info.pic} · {info.time.split(' ')[1]}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
