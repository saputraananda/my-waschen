import { useState, useRef, useEffect, Component, forwardRef } from 'react';
import ReactDOM from 'react-dom';
import { C, T } from '../../utils/theme';
import { STATUS_COLORS, STAGES, rp } from '../../utils/helpers';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

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
  <div role="banner" style={{ height: 56, background: C.white, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, borderBottom: `1px solid ${C.n100}`, flexShrink: 0, position: 'relative', zIndex: 10 }}>
    {onBack && (
      <button onClick={onBack} aria-label="Kembali" style={{ width: 40, height: 40, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n900 }}>
        <svg style={{ pointerEvents: 'none' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
      </button>
    )}
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900, lineHeight: 1.2 }}>{title}</div>
      {subtitle && <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 1 }}>{subtitle}</div>}
    </div>
    {rightAction && (
      <button onClick={rightAction} aria-label="Aksi" style={{ width: 40, height: 40, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n600 }}>
        <div style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {rightIcon}
        </div>
      </button>
    )}
  </div>
);

// ── NAV_ICONS ─────────────────────────────────────────────
const NAV_ICONS = {
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
      : role === 'finance'
      ? [
          { id: 'dashboard', label: 'Beranda', icon: NAV_ICONS.home },
          { id: 'verifikasi_payment', label: 'Verifikasi', icon: NAV_ICONS.approval },
          { id: '_fab', label: '', icon: null },
          { id: 'laporan_keuangan', label: 'Laporan', icon: NAV_ICONS.monitor },
          { id: 'settings', label: 'Profil', icon: NAV_ICONS.profile },
        ]
      : [
          { id: 'dashboard', label: 'Beranda', icon: NAV_ICONS.home },
          { id: 'approval', label: 'Approval', icon: NAV_ICONS.approval },
          { id: '_fab', label: '', icon: null },
          { id: 'admin_laporan', label: 'Laporan', icon: NAV_ICONS.monitor },
          { id: 'settings', label: 'Profil', icon: NAV_ICONS.profile },
        ];

  const fabAction =
    role === 'kasir'
      ? () => navigate('nota_step1')
      : role === 'produksi'
      ? () => navigate('produksi_qr_scan')
      : role === 'finance'
      ? () => navigate('verifikasi_payment')
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
                {role === 'produksi' ? (
                  <svg style={{ pointerEvents: 'none' }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                ) : (
                  <svg style={{ pointerEvents: 'none' }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                )}
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
            <div style={{ position: 'relative', pointerEvents: 'none' }}>
              {tab.icon}
              {isActive && <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: 2, background: C.primary }} />}
            </div>
            <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: isActive ? 600 : 400, pointerEvents: 'none' }}>{tab.label}</span>
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
      {loading ? <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', pointerEvents: 'none' }} /> : null}
      {!loading && icon && <span style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {!loading && <span style={{ pointerEvents: 'none' }}>{children}</span>}
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

// ── DateInput (shared calendar picker) ───────────────────
const _dateInputStyleId = 'waschen-datepicker-styles';
const _dateInputStyles = `
/* Kalender container — compact & contained */
.wdp{
  border:1px solid #E2E8F0;
  border-radius:12px;
  font-family:Poppins,sans-serif;
  box-shadow:0 8px 24px rgba(15,23,42,0.12);
  overflow:hidden;
  max-width:252px !important;
  width:252px !important;
}
.wdp .react-datepicker__triangle{display:none}
.wdp .react-datepicker__month-container{background:#F8FAFC;width:252px}

/* Header */
.wdp-hdr{display:flex;align-items:center;justify-content:space-between;gap:6px;background:linear-gradient(135deg,${C.primary},${C.primaryDark||C.primary});color:#fff;padding:8px 10px}
.wdp-ml{font-size:11px;font-weight:700;text-transform:capitalize}
.wdp-nav{width:24px;height:24px;border:none;border-radius:999px;background:rgba(255,255,255,0.2);color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1}
.wdp-nav:hover{background:rgba(255,255,255,0.3)}

/* Day names row */
.wdp .react-datepicker__day-names{margin-top:4px;margin-bottom:0;padding:0 4px}
.wdp .react-datepicker__day-name{color:#64748B;font-size:9px;font-weight:600;width:1.7rem;line-height:1.7rem;text-align:center}

/* Day cells — compact */
.wdp .react-datepicker__month{padding:2px 4px 6px}
.wdp .react-datepicker__week{display:flex}
.wdp .react-datepicker__day{
  color:#0F172A;border-radius:6px;
  width:1.7rem;min-height:1.7rem;
  line-height:1.7rem;margin:0.08rem;
  font-size:10px;
  transition:all 0.15s ease;
  display:inline-flex;align-items:center;justify-content:center;
  text-align:center;
}
.wdp .react-datepicker__day:hover{background:#DBEAFE;color:#1D4ED8}
.wdp .react-datepicker__day--today{background:#E2E8F0;color:#334155;font-weight:700}
.wdp .react-datepicker__day.wdp-wknd:not(.react-datepicker__day--selected):not(.react-datepicker__day--keyboard-selected){color:#5B21B6;background:#EDE9FE}
.wdp .react-datepicker__day--outside-month{opacity:0.3}
.wdp .react-datepicker__day--disabled{opacity:0.25!important;cursor:not-allowed!important;text-decoration:line-through;background:transparent!important}
.wdp .react-datepicker__day--selected,.wdp .react-datepicker__day--keyboard-selected{background:${C.primary};color:#fff;font-weight:700}

/* Day content — simple, no badge */
.wdp-dw{display:flex;flex-direction:column;align-items:center;justify-content:center}
.wdp-dn{font-size:10px;font-weight:500;line-height:1}
.wdp-tb{display:none}

/* Popper z-index — must be above everything */
.react-datepicker-popper{z-index:9999 !important}
.react-datepicker-wrapper{width:100%}
`;


function _ensureDateStyles() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById(_dateInputStyleId)) {
    const s = document.createElement('style');
    s.id = _dateInputStyleId;
    s.textContent = _dateInputStyles;
    document.head.appendChild(s);
  }
}

function _todayKey() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function _dateKey(d) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function _isToday(d) { return _dateKey(d) === _todayKey(); }
function _isWeekend(d) {
  const dow = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(d);
  return dow === 'Sat' || dow === 'Sun';
}

const DateInputCustom = forwardRef(({ value, onClick, placeholder, focused }, ref) => (
  <div onClick={onClick} ref={ref} style={{
    width: '100%', height: 48, borderRadius: 10,
    padding: '0 14px',
    border: `${focused ? 2 : 1.5}px solid ${focused ? C.primary : C.n300}`,
    fontFamily: 'Poppins', fontSize: 14, color: value ? C.n900 : C.n500,
    background: C.white, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  }}>
    <span>{value || placeholder || 'Pilih tanggal'}</span>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.n500} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  </div>
));

export const DateInput = ({ label, value, onChange, placeholder, minDate, maxDate, filterDate, error, returnDate = false }) => {
  _ensureDateStyles();
  const [focused, setFocused] = useState(false);

  const selected = value ? (value instanceof Date ? value : new Date(value + 'T00:00:00')) : null;

  const handleChange = (date) => {
    if (!date) { onChange(returnDate ? null : ''); return; }
    if (returnDate) { onChange(date); return; }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
  };

  const dayClassName = (date) => {
    const parts = [];
    if (_isWeekend(date)) parts.push('wdp-wknd');
    return parts.length ? parts.join(' ') : undefined;
  };

  const renderDayContents = (day, date) => (
    <span className="wdp-dw">
      <span className="wdp-dn">{day}</span>
      {_isToday(date) && <span className="wdp-tb">Hari ini</span>}
    </span>
  );

  const renderHeader = ({ date, decreaseMonth, increaseMonth }) => (
    <div className="wdp-hdr">
      <button type="button" className="wdp-nav" onClick={decreaseMonth} aria-label="Bulan sebelumnya">&#8249;</button>
      <div className="wdp-ml">{date.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</div>
      <button type="button" className="wdp-nav" onClick={increaseMonth} aria-label="Bulan berikutnya">&#8250;</button>
    </div>
  );

  return (
    <div style={{ marginBottom: 16 }}>
      {label && <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n600, marginBottom: 6 }}>{label}</div>}
      <DatePicker
        selected={selected}
        onChange={handleChange}
        dateFormat="dd/MM/yyyy"
        placeholderText={placeholder || 'Pilih tanggal'}
        calendarClassName="wdp"
        renderCustomHeader={renderHeader}
        minDate={minDate}
        maxDate={maxDate}
        filterDate={filterDate}
        dayClassName={dayClassName}
        renderDayContents={renderDayContents}
        onCalendarOpen={() => setFocused(true)}
        onCalendarClose={() => setFocused(false)}
        customInput={<DateInputCustom focused={focused} placeholder={placeholder} />}
        popperPlacement="bottom-start"
        popperProps={{
          strategy: 'fixed',
        }}
        withPortal={false}
      />
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
// Custom styled dropdown — portal-based, works inside Modal/overflow containers
export const Select = ({ label, value, onChange, options, error, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const dropRef = useRef(null);
  // Track pending selection to survive the close-on-outside-click race
  const pendingRef = useRef(null);

  const calcPos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropH = Math.min(options.length * 48, 220);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < dropH + 8 && rect.top > dropH + 8;
    setDropPos({
      top: openAbove ? rect.top - dropH - 4 : rect.bottom + 2,
      left: rect.left,
      width: rect.width,
    });
  };

  const handleTriggerClick = () => {
    if (open) {
      setOpen(false);
    } else {
      calcPos();
      setOpen(true);
    }
  };

  const handleSelect = (val) => {
    pendingRef.current = val;
    onChange(val);
    setOpen(false);
  };

  // Close on outside click — but only if not clicking trigger or dropdown
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (dropRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    // Use capture so we get it before anything else
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [open]);

  // Close + reposition on scroll
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [open]);

  const selectedOption = options.find((o) => String(o.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : (placeholder || 'Pilih...');

  const dropdown = open
    ? ReactDOM.createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            background: C.white,
            border: `1.5px solid ${C.primary}`,
            borderRadius: 10,
            maxHeight: 220,
            overflowY: 'auto',
            zIndex: 99999,
            boxShadow: '0 8px 32px rgba(15,23,42,0.18)',
          }}
        >
          {options.map((o, i) => {
            const isActive = String(o.value) === String(value);
            const isLast = i === options.length - 1;
            return (
              <div
                key={String(o.value)}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(o.value)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '12px 14px',
                  background: isActive ? C.primaryLight : 'transparent',
                  borderBottom: !isLast ? `1px solid ${C.n100}` : 'none',
                  borderRadius: isLast ? '0 0 9px 9px' : 0,
                  fontFamily: 'Poppins', fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? C.primary : C.n900,
                  cursor: 'pointer',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = C.n50; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.label}
                </span>
                {isActive && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="3" strokeLinecap="round" style={{ flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>,
        document.body
      )
    : null;

  return (
    <div style={{ marginBottom: 16, position: 'relative' }}>
      {label && (
        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n600, marginBottom: 6 }}>
          {label}
        </div>
      )}

      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        style={{
          width: '100%', height: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 14px',
          background: C.white,
          border: `${open ? 2 : 1.5}px solid ${error ? C.danger : open ? C.primary : C.n300}`,
          borderRadius: 10,
          fontFamily: 'Poppins', fontSize: 14,
          color: selectedOption ? C.n900 : C.n500,
          cursor: 'pointer', outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {displayLabel}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke={open ? C.primary : C.n500}
          strokeWidth="2.5" strokeLinecap="round"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', pointerEvents: 'none' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {dropdown}

      {error && (
        <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.danger, marginTop: 4 }}>
          {error}
        </div>
      )}
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
export const Avatar = ({ initials, size = 40, photo, onClick }) => (
  <div
    onClick={onClick}
    style={{ width: size, height: size, borderRadius: size / 2, background: `linear-gradient(135deg, ${C.primaryLight}, ${C.secondary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', position: 'relative' }}
  >
    {photo
      ? <img src={photo} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: size / 2 }} />
      : <span style={{ fontFamily: 'Poppins', fontSize: size * 0.35, fontWeight: 700, color: C.primary }}>{initials}</span>
    }
  </div>
);

// ── Toast ─────────────────────────────────────────────────
export const Toast = ({ message, type = 'success', visible }) => (
  <div style={{ position: 'absolute', bottom: 90, left: 16, right: 16, zIndex: 9999, pointerEvents: visible ? 'auto' : 'none', background: type === 'success' ? C.success : type === 'error' ? C.danger : C.n900, color: C.white, borderRadius: 12, padding: '12px 16px', fontFamily: 'Poppins', fontSize: 13, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', transform: visible ? 'translateY(0)' : 'translateY(80px)', opacity: visible ? 1 : 0, transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'flex', alignItems: 'center', gap: 10 }}>
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
    <div style={{ position: 'absolute', top: '50%', left: 20, right: 20, background: C.white, borderRadius: 20, zIndex: 201, padding: 24, transform: visible ? 'translate(0, -50%) scale(1)' : 'translate(0, -50%) scale(0.9)', opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)', overflow: 'visible', maxHeight: '85vh', overflowY: 'auto' }}>
      {title && <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900, marginBottom: 16 }}>{title}</div>}
      {children}
    </div>
  </>
);

// ── StatCard ──────────────────────────────────────────────
export const StatCard = ({ label, value, sub, icon, color = C.primary, onClick }) => (
  <div onClick={onClick} style={{ background: C.white, borderRadius: 14, padding: '9px 11px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', cursor: onClick ? 'pointer' : 'default', width: '100%', boxSizing: 'border-box' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>{icon}</div>
      <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, lineHeight: 1.3 }}>{label}</div>
    </div>
    <div style={{ fontFamily: 'Poppins', fontSize: 17, fontWeight: 700, color: C.n900, lineHeight: 1 }}>{value}</div>
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
export const EmptyState = ({ title, subtitle, action, actionLabel, icon, secondaryAction, secondaryLabel }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12, textAlign: 'center' }}>
    <div style={{ width: 72, height: 72, borderRadius: 36, background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: icon ? 32 : 28 }}>
      {icon || <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.primarySoft} strokeWidth="1.5" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>}
    </div>
    <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: C.n900 }}>{title}</div>
    {subtitle && <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600, maxWidth: 280, lineHeight: 1.6 }}>{subtitle}</div>}
    <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
      {action && <Btn variant="secondary" onClick={action} size="sm">{actionLabel || 'Tambah'}</Btn>}
      {secondaryAction && <Btn variant="ghost" onClick={secondaryAction} size="sm">{secondaryLabel || 'Lihat Semua'}</Btn>}
    </div>
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
              {info && <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>{info.pic || '-'} · {info.time ? info.time.split(' ')[1] || info.time : '-'}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── ConfirmDialog ────────────────────────────────────────
export const ConfirmDialog = ({ open, title, message, confirmLabel = 'Ya', cancelLabel = 'Batal', onConfirm, onCancel, danger = false }) => {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
      <div style={{ background: C.white, borderRadius: 20, padding: '28px 22px 20px', maxWidth: 320, width: '88%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n900, marginBottom: 8 }}>{title || 'Konfirmasi'}</div>
        <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600, lineHeight: 1.6, marginBottom: 24 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px 0', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n700, background: C.n100, border: 'none', borderRadius: 10, cursor: 'pointer' }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '11px 0', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.white, background: danger ? C.danger : C.primary, border: 'none', borderRadius: 10, cursor: 'pointer' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── ErrorBoundary ────────────────────────────────────────
// Per-page boundary — kalau crash, hanya page itu yang affected, bukan seluruh app.
// Support custom fallback dan reset tanpa reload.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
    this.setState({ errorInfo: info });
    // Optional: send to error tracking service
    if (typeof this.props.onError === 'function') {
      try { this.props.onError(error, info); } catch {}
    }
  }
  reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };
  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback({ error: this.state.error, reset: this.reset });
      }
      const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 16, textAlign: 'center', background: C.n50, minHeight: this.props.minHeight || '60vh' }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 28 }}>⚠️</span>
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n900 }}>Terjadi Kesalahan</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, maxWidth: 320, lineHeight: 1.6 }}>
            Halaman ini mengalami error. Coba muat ulang bagian ini, atau kembali ke halaman sebelumnya.
          </div>
          {isDev && this.state.error && (
            <pre style={{ fontFamily: 'monospace', fontSize: 10, color: '#991B1B', background: '#FEF2F2', padding: 12, borderRadius: 8, maxWidth: '90%', overflow: 'auto', textAlign: 'left' }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              onClick={this.reset}
              style={{ padding: '10px 22px', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.primary, background: 'white', border: `1.5px solid ${C.primary}`, borderRadius: 10, cursor: 'pointer' }}
            >
              Coba Lagi
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '10px 22px', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: 'white', background: C.primary, border: 'none', borderRadius: 10, cursor: 'pointer' }}
            >
              Muat Ulang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Re-exports for convenience ────────────────────────────
export { SkeletonBar, SkeletonCard, SkeletonList, SkeletonStat, SkeletonStatGrid, SkeletonTable } from './Skeleton';
export { QRCodeView, generateQRDataURL } from './QRCode';
export { CustomerSearchInput } from './CustomerSearchInput';
export { RevenueAreaChart, TxBarChart, PaymentPieChart, OutletBarChart, ComparisonLineChart, HourlyHeatBar, CHART_COLORS } from './Charts';

// ── OfflineIndicator ──────────────────────────────────────
// Banner kecil di bottom kalau offline
export const OfflineIndicator = ({ online }) => {
  if (online) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: '#1F2937', color: 'white',
      padding: '10px 18px', borderRadius: 999, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 8,
      fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: '#EF4444', animation: 'pulse 1.5s infinite' }} />
      Anda offline — beberapa fitur tidak tersedia
    </div>
  );
};
