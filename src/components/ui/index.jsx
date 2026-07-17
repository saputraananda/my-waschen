import { useState, useRef, useEffect, Component, forwardRef } from 'react';
import ReactDOM from 'react-dom';
import { C, T, SHADOW } from '../../utils/theme';
import { STATUS_COLORS, STAGES, rp } from '../../utils/helpers';
import { SHADOWS, GRADIENTS, RADIUS } from '../../utils/designSystem';
import { motion, AnimatePresence } from 'framer-motion';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  ArrowLeft, Home, FileText, Users, User, List, CheckSquare,
  Monitor, RotateCcw, Plus, ChevronRight, ChevronLeft, ChevronDown,
  Search, Filter, X, Clock, AlertCircle, CheckCircle2, XCircle,
  Bell, Settings, LogOut, ShoppingCart, Package, TrendingUp,
  RefreshCw, Edit, Trash2, Eye, Download, Upload, Calendar,
  MoreVertical, Info, MapPin, Phone, Mail, Truck, Map,
  Boxes, Warehouse,
} from 'lucide-react';

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
        <ArrowLeft size={20} strokeWidth={2.5} />
      </button>
    )}
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900, lineHeight: 1.2 }}>{title}</div>
      {subtitle && <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#3a3a3a', marginTop: 1 }}>{subtitle}</div>}
    </div>
    {rightAction && (
      <button onClick={rightAction} aria-label="Aksi" style={{ width: 40, height: 40, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a3a3a' }}>
        <div style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {rightIcon}
        </div>
      </button>
    )}
  </div>
);

// ── NAV_ICONS ─────────────────────────────────────────────
const NAV_ICONS = {
  home: <Home size={22} />,
  tx: <FileText size={22} />,
  customer: <Users size={22} />,
  profile: <User size={22} />,
  queue: <List size={22} />,
  approval: <CheckSquare size={22} />,
  monitor: <Monitor size={22} />,
  history: <RotateCcw size={22} />,
  delivery_tasks: <Truck size={22} />,
  delivery_history: <Map size={22} />,
  inventory: <Warehouse size={22} />,
};

// ── BottomNav ─────────────────────────────────────────────
export const BottomNav = ({ role, active, navigate, overdueCount: propOverdueCount = 0, stokAlertCount: propStokAlertCount = 0 }) => {
  const [overdueCount, setOverdueCount] = useState(propOverdueCount);
  const [stokAlertCount, setStokAlertCount] = useState(propStokAlertCount);

  // Listen to production dashboard broadcast
  useEffect(() => {
    const handler = (e) => setOverdueCount(e.detail.count);
    window.addEventListener('produksi:overdue-count', handler);
    return () => window.removeEventListener('produksi:overdue-count', handler);
  }, []);

  // Listen to stok alert broadcast
  useEffect(() => {
    const handler = (e) => setStokAlertCount(e.detail.count);
    window.addEventListener('stok:alert-count', handler);
    return () => window.removeEventListener('stok:alert-count', handler);
  }, []);
  // 'frontline' adalah sinonim 'kasir' — perlakukan sama
  const isKasir = role === 'kasir' || role === 'frontline';
  const tabs =
    isKasir
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
          { id: 'stok_produksi', label: 'Stok', icon: NAV_ICONS.inventory },
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
      : role === 'delivery'
      ? [
          { id: 'dashboard', label: 'Beranda', icon: NAV_ICONS.home },
          { id: 'delivery_tasks', label: 'Tugas', icon: NAV_ICONS.tx },
          { id: '_fab', label: '', icon: null },
          { id: 'delivery_history', label: 'Riwayat', icon: NAV_ICONS.history },
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
    isKasir
      ? () => navigate('nota_step1')
      : role === 'produksi'
      ? () => navigate('produksi_qr_scan')
      : role === 'finance'
      ? () => navigate('verifikasi_payment')
      : role === 'delivery'
      ? () => navigate('delivery_tasks')
      : () => navigate('approval');

  return (
    <div
      className="bottom-nav"
      style={{
        height: 76,
        background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.65))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.4)',
        boxShadow: '0 -4px 30px rgba(110, 46, 120, 0.08), 0 -1px 0px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        alignItems: 'center',
        paddingBottom: 8,
        flexShrink: 0,
        position: 'relative',
        zIndex: 20,
      }}
    >
      {/* Glass effect overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '50%',
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3), transparent)',
        pointerEvents: 'none',
      }} />

      {tabs.map((tab) => {
        if (tab.id === '_fab')
          return (
            <div key="_fab" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={fabAction}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  background: 'linear-gradient(145deg, #8B5CF6, #5B005F)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6px 20px rgba(110, 46, 120, 0.45), 0 2px 8px rgba(110, 46, 120, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  marginBottom: 4,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Inner glow */}
                <div style={{
                  position: 'absolute',
                  top: '15%',
                  left: '15%',
                  width: '35%',
                  height: '35%',
                  background: 'rgba(255, 255, 255, 0.3)',
                  borderRadius: '50%',
                  filter: 'blur(4px)',
                }} />
                {role === 'produksi' ? (
                  <svg style={{ pointerEvents: 'none', position: 'relative', zIndex: 1 }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                ) : (
                  <svg style={{ pointerEvents: 'none', position: 'relative', zIndex: 1 }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                )}
              </motion.button>
            </div>
          );
        const isActive = active === tab.id;
        return (
          <motion.button
            key={tab.id}
            onClick={() => navigate(tab.id)}
            whileTap={{ scale: 0.92 }}
            style={{
              flex: 1,
              height: '100%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              color: isActive ? C.primary : '#9ca3af',
              position: 'relative',
            }}
          >
            <div style={{ position: 'relative', pointerEvents: 'none' }}>
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  style={{
                    position: 'absolute',
                    top: -6,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 20,
                    height: 4,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${C.primary}, #8B5CF6)`,
                    boxShadow: `0 2px 8px ${C.primary}40`,
                  }}
                />
              )}
              {tab.icon}
              {tab.id === 'antrian' && overdueCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: 4,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    borderRadius: 8,
                    background: '#ef4444',
                    color: '#ffffff',
                    fontFamily: 'Poppins',
                    fontSize: 8,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {overdueCount}
                </motion.span>
              )}
              {tab.id === 'stok_produksi' && stokAlertCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: 4,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    borderRadius: 8,
                    background: '#f59e0b',
                    color: '#ffffff',
                    fontFamily: 'Poppins',
                    fontSize: 8,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {stokAlertCount}
                </motion.span>
              )}
              {/* Active dot below icon */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  bottom: -6,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  background: C.primary,
                }} />
              )}
            </div>
            <span style={{
              fontFamily: 'Poppins',
              fontSize: 10,
              fontWeight: isActive ? 600 : 400,
              pointerEvents: 'none',
              color: isActive ? C.primary : '#9ca3af',
            }}>{tab.label}</span>
          </motion.button>
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
  const base = { height: h, borderRadius: 12, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'Poppins', fontSize: fs, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: fullWidth ? '100%' : 'auto', padding: '0 20px', transition: 'all 0.2s ease', opacity: disabled ? 0.5 : 1, transform: pressed ? 'scale(0.97)' : 'scale(1)', ...extraStyle };
  const styles = {
    primary:   { ...base, background: pressed ? C.primaryDark : `linear-gradient(135deg, ${C.primaryHover}, ${C.primary})`, color: C.white, boxShadow: disabled ? 'none' : `0 4px 12px rgba(110,46,120,0.35)` },
    secondary: { ...base, background: C.white, color: C.primary, border: `1.5px solid ${C.primary}` },
    danger:    { ...base, background: C.danger, color: C.white, boxShadow: `0 4px 12px rgba(225,29,72,0.30)` },
    ghost:     { ...base, background: 'transparent', color: C.primary, height: 'auto', padding: '6px 12px' },
    success:   { ...base, background: C.success, color: C.white, boxShadow: `0 4px 12px rgba(5,150,105,0.30)` },
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
export const Input = ({ label, value, onChange, type = 'text', error, placeholder, rightIcon, autoFocus, inputMode, id, name, style }) => {
  const [focused, setFocused] = useState(false);
  // Auto-derive name dari label kalau ga di-pass
  const fieldName = name || (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : undefined);
  const fieldId = id || fieldName;
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label htmlFor={fieldId} style={{ display: 'block', fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: '#3a3a3a', marginBottom: 6 }}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          id={fieldId} name={fieldName}
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} inputMode={inputMode} autoFocus={autoFocus}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            height: style?.height || 46,
            borderRadius: style?.borderRadius || 10,
            padding: rightIcon ? '0 44px 0 14px' : '0 14px',
            border: `${focused ? 2 : 1.5}px solid ${error ? C.danger : focused ? '#5B005F' : C.n300}`,
            fontFamily: 'Poppins',
            fontSize: 14,
            color: C.n900,
            background: C.white,
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            boxShadow: focused ? '0 0 0 3px rgba(110,46,120,0.15)' : 'none',
            ...style,
          }}
        />
        {rightIcon && <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#3a3a3a' }}>{rightIcon}</div>}
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
.wdp-hdr{display:flex;align-items:center;justify-content:space-between;gap:6px;background:linear-gradient(135deg,#8B5CF6,#5B005F);color:#fff;padding:8px 10px}
.wdp-ml{font-size:11px;font-weight:700;text-transform:capitalize}
.wdp-nav{width:24px;height:24px;border:none;border-radius:999px;background:rgba(255,255,255,0.2);color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1}
.wdp-nav:hover{background:rgba(255,255,255,0.3)}

/* Day names row */
.wdp .react-datepicker__day-names{margin-top:4px;margin-bottom:0;padding:0 4px}
.wdp .react-datepicker__day-name{color:#8699C5;font-size:9px;font-weight:600;width:1.7rem;line-height:1.7rem;text-align:center}

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
.wdp .react-datepicker__day--selected,.wdp .react-datepicker__day--keyboard-selected{background:#5B005F;color:#fff;font-weight:700}

/* Day content — simple, no badge */
.wdp-dw{display:flex;flex-direction:column;align-items:center;justify-content:center}
.wdp-dn{font-size:10px;font-weight:500;line-height:1}
.wdp-tb{display:none}

/* ── Z-INDEX LADDER (low → high) ─────────────────────────────
   5    : Pull-to-refresh indicator
   10   : TopBar
   20   : BottomNav
   50   : FAB
   100  : BottomSheet backdrop
   101  : BottomSheet content
   200  : Standard Modal backdrop
   201  : Standard Modal content
   400  : Premium Modal backdrop (Adjustment, Category)
   401  : Premium Modal content
   500  : GlassModal backdrop (glassmorphism)
   501  : GlassModal content
   600  : High Priority Modal backdrop (ShiftPrompt)
   601  : High Priority Modal content
   900  : Topup/Customer Select backdrop
   901  : Topup/Customer Select content
   9000 : Select Dropdown (portal — above GlassModal)
   9500 : ConfirmDialog backdrop
   9501 : ConfirmDialog content
   9800 : Toast / DatePicker popper
   9900 : PhotoLightbox
   99999: GlobalLoading (absolute top — above ALL)
────────────────────────────────────────────────────────────── */

/* BottomSheet z-index — must be above BottomNav (20) */
.BottomSheet-backdrop{z-index:100 !important}
.BottomSheet-content{z-index:101 !important}

/* Standard Modal z-index — above BottomSheet */
.Modal-backdrop{z-index:200 !important}
.Modal-content{z-index:201 !important}

/* DatePicker popper z-index — must be above most modals */
.react-datepicker-popper{z-index:9800 !important}
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

const CALENDAR_ICON = ({ color = '#3a3a3a', size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const DateInputCustom = forwardRef(({ value, onClick, placeholder, focused, iconOnlyEmpty, compact }, ref) => {
  const h = compact ? 44 : 48;
  const empty = !value;

  if (iconOnlyEmpty && empty) {
    return (
      <div
        onClick={onClick}
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label="Pilih tanggal"
        style={{
          width: '100%', height: h, borderRadius: 10,
          border: `${focused ? 2 : 1.5}px solid ${focused ? '#5B005F' : C.n300}`,
          background: focused ? `${C.primary}08` : C.white,
          outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.2s, background 0.2s',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: focused ? C.primary : '#3a3a3a',
        }}
      >
        <CALENDAR_ICON color={focused ? C.primary : '#3a3a3a'} />
      </div>
    );
  }

  return (
    <div onClick={onClick} ref={ref} style={{
      width: '100%', height: h, borderRadius: 10,
      padding: '0 12px',
      border: `${focused ? 2 : 1.5}px solid ${focused ? '#5B005F' : C.n300}`,
      fontFamily: 'Poppins', fontSize: compact ? 13 : 14,
      color: value ? C.n900 : '#3a3a3a',
      background: C.white, outline: 'none', boxSizing: 'border-box',
      transition: 'border-color 0.2s', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    }}>
      <span style={{ fontWeight: value ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value || (iconOnlyEmpty ? '' : (placeholder || 'Pilih tanggal'))}
      </span>
      <CALENDAR_ICON color={focused ? C.primary : '#3a3a3a'} size={16} />
    </div>
  );
});

export const DateInput = ({ label, value, onChange, placeholder, minDate, maxDate, filterDate, error, returnDate = false, compact = false, iconOnlyEmpty = false }) => {
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
    <div style={{ marginBottom: compact ? 0 : 16 }}>
      {label && <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: '#3a3a3a', marginBottom: 6 }}>{label}</div>}
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
        customInput={<DateInputCustom focused={focused} placeholder={placeholder} iconOnlyEmpty={iconOnlyEmpty} compact={compact} />}
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
      {label && <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: '#3a3a3a', marginBottom: 6 }}>{label}</div>}
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', borderRadius: 10, padding: '12px 14px', border: `${focused ? 2 : 1.5}px solid ${focused ? '#5B005F' : C.n300}`, fontFamily: 'Poppins', fontSize: 14, color: C.n900, background: C.white, outline: 'none', resize: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
      />
    </div>
  );
};

// ── MoneyInput ────────────────────────────────────────────
// Input nominal dengan auto thousand separator. Value yang di-set ke parent
// adalah angka mentah (string digit only, tanpa separator).
// Display pakai format Indonesia (1.000.000) supaya gampang dibaca.
export const MoneyInput = ({ label, value, onChange, error, placeholder, autoFocus, name, id, prefix = 'Rp', hint }) => {
  const [focused, setFocused] = useState(false);
  const fieldName = name || (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : 'amount');
  const fieldId = id || fieldName;
  const raw = String(value ?? '').replace(/\D/g, '');
  const display = raw ? Number(raw).toLocaleString('id-ID') : '';

  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label htmlFor={fieldId} style={{ display: 'block', fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: '#3a3a3a', marginBottom: 6 }}>{label}</label>}
      <div style={{ position: 'relative' }}>
        {prefix && (
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: '#3a3a3a',
            pointerEvents: 'none',
          }}>{prefix}</span>
        )}
        <input
          id={fieldId} name={fieldName}
          type="text" inputMode="numeric" autoComplete="off"
          value={display}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder || '0'}
          autoFocus={autoFocus}
          style={{
            width: '100%', height: 48, borderRadius: 10,
            padding: prefix ? '0 14px 0 42px' : '0 14px',
            border: `${focused ? 2 : 1.5}px solid ${error ? C.danger : focused ? C.primary : C.n300}`,
            fontFamily: 'Poppins', fontSize: 14, fontWeight: 600,
            color: C.n900, background: C.white,
            textAlign: 'right', outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
        />
      </div>
      {hint && !error && <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#3a3a3a', marginTop: 4 }}>{hint}</div>}
      {error && <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.danger, marginTop: 4 }}>{error}</div>}
    </div>
  );
};

// ── TimeInput ─────────────────────────────────────────────
// Input jam (HH:mm) — pakai native time input dengan styling konsisten + label.
// BUG FIX #8: Added readOnly to prevent manual typing - user must use picker only.
export const TimeInput = ({ label, value, onChange, error, placeholder, name, id }) => {
  const [focused, setFocused] = useState(false);
  const fieldName = name || (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : 'time');
  const fieldId = id || fieldName;
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label htmlFor={fieldId} style={{ display: 'block', fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: '#3a3a3a', marginBottom: 6 }}>{label}</label>}
      <input
        id={fieldId} name={fieldName} type="time"
        value={value || ''} onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        placeholder={placeholder || '--:--'}
        readOnly // BUG FIX #8: Prevent manual input - user must use picker
        style={{
          width: '100%', height: 48, borderRadius: 10, padding: '0 14px',
          border: `${focused ? 2 : 1.5}px solid ${error ? C.danger : focused ? C.primary : C.n300}`,
          fontFamily: 'Poppins', fontSize: 14, color: C.n900,
          background: C.white, outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.2s',
          cursor: 'pointer', // Show pointer to indicate it's a picker, not editable
        }}
      />
      {error && <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.danger, marginTop: 4 }}>{error}</div>}
    </div>
  );
};

// ── DateTimeInput ─────────────────────────────────────────
// DatePicker + TimePicker inline (2 field) — return ISO datetime string.
// Lebih konsisten daripada native datetime-local yang inkonsisten antar browser.
export const DateTimeInput = ({ label, value, onChange, error, minDate, maxDate, filterDate, placeholder, timeOptional = false }) => {
  // value: ISO string "2026-06-01T00:00:00" atau null
  const initial = value ? new Date(value) : null;
  const [date, setDate] = useState(initial && !Number.isNaN(initial.getTime()) ? initial : null);
  const [time, setTime] = useState(initial && !Number.isNaN(initial.getTime())
    ? `${String(initial.getHours()).padStart(2,'0')}:${String(initial.getMinutes()).padStart(2,'0')}`
    : ''
  );

  // Emit ISO string
  // - timeOptional=false (default): butuh date + time baru emit
  // - timeOptional=true: emit begitu date dipilih, time default 00:00
  const emit = (d, t) => {
    if (!d) {
      onChange(null);
      return;
    }
    if (timeOptional && !t) {
      // Auto set 00:00 kalau time belum diisi
      const yyyy = d.getFullYear();
      const MM = String(d.getMonth() + 1).padStart(2, '0');
      const DD = String(d.getDate()).padStart(2, '0');
      onChange(`${yyyy}-${MM}-${DD}T00:00:00`);
      return;
    }
    if (!t) {
      onChange(null);
      return;
    }
    const [hh, mm] = t.split(':').map(Number);
    const merged = new Date(d);
    merged.setHours(hh || 0, mm || 0, 0, 0);
    const yyyy = merged.getFullYear();
    const MM = String(merged.getMonth() + 1).padStart(2, '0');
    const DD = String(merged.getDate()).padStart(2, '0');
    const HH = String(merged.getHours()).padStart(2, '0');
    const mi = String(merged.getMinutes()).padStart(2, '0');
    onChange(`${yyyy}-${MM}-${DD}T${HH}:${mi}:00`);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {label && <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: '#3a3a3a', marginBottom: 6 }}>{label}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 2 }}>
          <DateInput
            value={date}
            onChange={(d) => { setDate(d); emit(d, time || (timeOptional ? '00:00' : '')); }}
            placeholder={placeholder || 'Pilih tanggal'}
            minDate={minDate}
            maxDate={maxDate}
            filterDate={filterDate}
            returnDate
          />
        </div>
        <div style={{ flex: 1 }}>
          <TimeInput
            value={time}
            onChange={(t) => { setTime(t); emit(date, t); }}
          />
        </div>
      </div>
      {error && <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.danger, marginTop: 4 }}>{error}</div>}
    </div>
  );
};

// ── Select ────────────────────────────────────────────────
// Custom styled dropdown — portal-based, works inside Modal/overflow containers
export const Select = ({ label, value, onChange, options, error, placeholder, compact = false }) => {
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

  // Close + reposition on scroll — TAPI jangan close kalau scroll di dalam dropdown sendiri
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      // Kalau scroll terjadi di dalam dropdown, biarkan (user sedang scroll opsi)
      if (dropRef.current && (dropRef.current === e.target || dropRef.current.contains(e.target))) {
        return;
      }
      setOpen(false);
    };
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
            zIndex: 9000, // Above GlassModal (500) but below ConfirmDialog (9500)
            boxShadow: SHADOW.lg,
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
    <div style={{ marginBottom: compact ? 0 : 16, position: 'relative' }}>
      {label && (
        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: '#3a3a3a', marginBottom: 6 }}>
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
          color: selectedOption ? C.n900 : '#3a3a3a',
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
          fill="none" stroke={open ? C.primary : '#3a3a3a'}
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
  const s = STATUS_COLORS[status] || { bg: C.n100, text: '#3a3a3a' };
  const displayLabel = label || (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown');
  return (
    <span style={{ background: s.bg, color: s.text, fontFamily: 'Poppins', fontSize: small ? 10 : 11, fontWeight: 600, padding: small ? '2px 8px' : '3px 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', border: `1px solid ${s.border || s.bg}` }}>
      {status === 'proses' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3a3a3a' }} />}
      {displayLabel}
    </span>
  );
};

// ── Avatar ────────────────────────────────────────────────
export const Avatar = ({ initials, size = 40, photo, onClick }) => (
  <div
    onClick={onClick}
    style={{ width: size, height: size, borderRadius: size / 2, background: `linear-gradient(145deg, #FFFFFF, #E8EEF5)`, border: '2px solid rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', position: 'relative', boxShadow: `0 2px 8px rgba(0,0,0,0.15)` }}
  >
    {photo
      ? <img src={photo} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: size / 2 }} />
      : <span style={{ fontFamily: 'Poppins', fontSize: size * 0.35, fontWeight: 700, color: C.primary }}>{initials}</span>
    }
  </div>
);

// ── Toast ─────────────────────────────────────────────────
// z-index: 9800 — above ConfirmDialog (9500), below PhotoLightbox (9900)
export const Toast = ({ message, type = 'success', visible }) => (
  <div style={{ position: 'absolute', bottom: 90, left: 16, right: 16, zIndex: 9800, pointerEvents: visible ? 'auto' : 'none', background: type === 'success' ? C.success : type === 'error' ? C.danger : C.n900, color: C.white, borderRadius: 12, padding: '12px 16px', fontFamily: 'Poppins', fontSize: 13, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.28)', transform: visible ? 'translateY(0)' : 'translateY(80px)', opacity: visible ? 1 : 0, transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'flex', alignItems: 'center', gap: 10 }}>
    {type === 'success' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>}
    {message}
  </div>
);

// ── BottomSheet ───────────────────────────────────────────
// z-index: 100 backdrop, 101 content
export const BottomSheet = ({ visible, onClose, title, children }) => (
  <>
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 100, opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity 0.25s' }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.white, borderRadius: '20px 20px 0 0', zIndex: 101, padding: '0 0 32px', transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)', maxHeight: '85%', overflowY: 'auto', boxShadow: SHADOW.xl }}>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: C.n300, margin: '12px auto 4px' }} />
      {title && <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900, padding: '12px 20px 8px' }}>{title}</div>}
      {children}
    </div>
  </>
);

// ── Modal ─────────────────────────────────────────────────
export const Modal = ({ visible, onClose, title, children }) => (
  <>
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 200, opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity 0.2s' }} />
    <div style={{ position: 'absolute', top: '50%', left: 20, right: 20, background: C.white, borderRadius: 20, zIndex: 201, padding: 24, transform: visible ? 'translate(0, -50%) scale(1)' : 'translate(0, -50%) scale(0.9)', opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)', overflow: 'visible', maxHeight: '85vh', overflowY: 'auto', boxShadow: SHADOW.xl }}>
      {title && <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900, marginBottom: 16 }}>{title}</div>}
      {children}
    </div>
  </>
);

// ── StatCard (exported from ./StatCard) ──────────────────────────────────────────

// ── Chip ──────────────────────────────────────────────────
export const Chip = ({ label, active, onClick, color = C.primary }) => (
  <button
    onClick={onClick}
    style={{ padding: '6px 14px', borderRadius: 999, border: `1.5px solid ${active ? color : C.n300}`, background: active ? `${color}12` : C.white, color: active ? color : '#3a3a3a', fontFamily: 'Poppins', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0, boxShadow: active ? `0 2px 8px ${color}20` : 'none' }}
  >
    {label}
  </button>
);

// ── Divider ───────────────────────────────────────────────
export const Divider = ({ mx = 0, my = 12 }) => <div style={{ height: 1, background: C.n100, margin: `${my}px ${mx}px` }} />;

// ── SearchBar ─────────────────────────────────────────────
const SEARCH_INPUT_H = 44;

export const SearchBar = ({ value, onChange, placeholder = 'Cari...', name = 'search', compact = false }) => (
  <div style={{
    position: 'relative',
    marginBottom: compact ? 0 : 12,
    height: compact ? SEARCH_INPUT_H : undefined,
  }}>
    <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#3a3a3a', pointerEvents: 'none', display: 'flex' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
    </div>
    <input
      id={name} name={name}
      value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{
        width: '100%', height: SEARCH_INPUT_H, margin: 0,
        borderRadius: 10, padding: '0 40px 0 38px',
        border: `1.5px solid ${C.n300}`,
        fontFamily: 'Poppins', fontSize: 14, lineHeight: '20px',
        color: C.n900, background: C.white, outline: 'none',
        boxSizing: 'border-box', display: 'block',
        WebkitAppearance: 'none', appearance: 'none',
      }}
    />
    {value && (
      <button type="button" onClick={() => onChange('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#3a3a3a', display: 'flex', padding: 4, margin: 0, minHeight: 'unset', height: 'auto' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    )}
  </div>
);

const FILTER_ICON_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="14" y2="6" />
    <circle cx="16" cy="6" r="2" />
    <line x1="20" y1="6" x2="18" y2="6" />
    <line x1="4" y1="12" x2="6" y2="12" />
    <circle cx="8" cy="12" r="2" />
    <line x1="20" y1="12" x2="10" y2="12" />
    <line x1="4" y1="18" x2="12" y2="18" />
    <circle cx="14" cy="18" r="2" />
    <line x1="20" y1="18" x2="16" y2="18" />
  </svg>
);

// ── FilterIconButton — tombol filter 44×44, sejajar dengan SearchBar ──
export const FilterIconButton = ({ onClick, activeCount = 0, ariaLabel = 'Buka filter' }) => (
  <button
    type="button"
    className="search-filter-btn"
    onClick={onClick}
    aria-label={ariaLabel}
    style={{
      position: 'relative',
      padding: 0,
      margin: 0,
      borderRadius: 10,
      border: `1.5px solid ${activeCount > 0 ? C.primary : C.n300}`,
      background: activeCount > 0 ? `${C.primary}10` : 'white',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: activeCount > 0 ? C.primary : C.n700,
      flexShrink: 0,
      width: SEARCH_INPUT_H,
      height: SEARCH_INPUT_H,
      minHeight: SEARCH_INPUT_H,
      maxHeight: SEARCH_INPUT_H,
      boxSizing: 'border-box',
      WebkitAppearance: 'none',
      appearance: 'none',
    }}
  >
    {FILTER_ICON_SVG}
    {activeCount > 0 && (
      <span style={{
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        background: C.primary,
        color: 'white',
        fontFamily: 'Poppins',
        fontSize: 9,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 3px',
      }}>
        {activeCount}
      </span>
    )}
  </button>
);

// ── SearchFilterRow — search + filter icon sejajar (pola admin approval) ──
export const SearchFilterRow = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Cari...',
  onFilterClick,
  activeFilterCount = 0,
  marginBottom = 10,
}) => (
  <div
    className="search-filter-row"
    style={{
      display: 'grid',
      gridTemplateColumns: `1fr ${SEARCH_INPUT_H}px`,
      gap: 8,
      marginBottom,
      height: SEARCH_INPUT_H,
      alignItems: 'stretch',
    }}
  >
    <SearchBar
      value={searchValue}
      onChange={onSearchChange}
      placeholder={searchPlaceholder}
      compact
    />
    <FilterIconButton onClick={onFilterClick} activeCount={activeFilterCount} />
  </div>
);

// ── EmptyState (exported from ./EmptyState) ─────────────────────────────────────

// ── FAB ───────────────────────────────────────────────────
export const FAB = ({ onClick, icon }) => (
  <button onClick={onClick} style={{ position: 'absolute', bottom: 88, right: 20, width: 52, height: 52, borderRadius: 26, background: `linear-gradient(135deg, ${C.primaryHover}, ${C.primary})`, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 24px rgba(110,46,120,0.50)`, color: C.white, zIndex: 50 }}>
    {icon || <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
  </button>
);

// ── SectionHeader (from PageHeader) ────────────────────────────────────
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
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: done ? 600 : 400, color: done ? C.n900 : '#3a3a3a' }}>{stage}</div>
              {info && <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#3a3a3a', marginTop: 2 }}>{info.pic || '-'} · {info.time ? info.time.split(' ')[1] || info.time : '-'}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── ConfirmDialog ────────────────────────────────────────
// z-index: 9500 backdrop, 9501 content — above Select (9000), below Toast (9800)
export const ConfirmDialog = ({ open, title, message, confirmLabel = 'Ya', cancelLabel = 'Batal', onConfirm, onCancel, danger = false }) => {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.50)' }}>
      <div style={{ background: C.white, borderRadius: 20, padding: '28px 22px 20px', maxWidth: 320, width: '88%', textAlign: 'center', boxShadow: SHADOW.xl }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n900, marginBottom: 8 }}>{title || 'Konfirmasi'}</div>
        <div style={{ fontFamily: 'Poppins', fontSize: 13, color: '#3a3a3a', lineHeight: 1.6, marginBottom: 24 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px 0', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n700, background: C.n100, border: 'none', borderRadius: 10, cursor: 'pointer' }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '11px 0', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.white, background: danger ? C.danger : C.primary, border: 'none', borderRadius: 10, cursor: 'pointer', boxShadow: danger ? `0 4px 12px rgba(225,29,72,0.30)` : `0 4px 12px rgba(110,46,120,0.35)` }}>
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
    // Error sent to backend via onError callback
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
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#3a3a3a', maxWidth: 320, lineHeight: 1.6 }}>
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
export { RevenueAreaChart, TxBarChart, PaymentPieChart, OutletBarChart, ComparisonLineChart, HourlyHeatBar, DonutChart, StackedBarChart, CHART_COLORS } from './Charts';
export { PullToRefresh, usePullToRefresh } from './PullToRefresh';
export { GlobalPullToRefresh, useAppRefresh } from './GlobalPullToRefresh';

// ── OfflineIndicator ──────────────────────────────────────
// Banner kecil di bottom kalau offline
export const OfflineIndicator = ({ online }) => {
  if (online) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: '#1E293B', color: 'white',
      padding: '10px 18px', borderRadius: 999, zIndex: 9800,
      display: 'flex', alignItems: 'center', gap: 8,
      fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
      boxShadow: '0 8px 24px rgba(15,23,42,0.30)',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: '#EF4444', animation: 'pulse 1.5s infinite' }} />
      Anda offline — beberapa fitur tidak tersedia
    </div>
  );
};

// ── PhotoLightbox ────────────────────────────────────────
// z-index: 9900 — highest overlay, above all modals and dropdowns
// Mendukung navigasi prev/next, swipe, escape close, klik backdrop close.
//
// Props:
//   visible: boolean
//   photos: [{ url, type, notes, createdAt, uploadedByName }]
//   index: number — current photo index
//   onClose: () => void
//   onIndexChange: (newIndex) => void
//   formatType?: (type) => string  — optional label formatter
export const PhotoLightbox = ({ visible, photos = [], index = 0, onClose, onIndexChange, formatType }) => {
  // Touch swipe
  const touchStartX = useRef(null);

  useEffect(() => {
    if (!visible) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowLeft' && index > 0) onIndexChange?.(index - 1);
      else if (e.key === 'ArrowRight' && index < photos.length - 1) onIndexChange?.(index + 1);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [visible, index, photos.length, onClose, onIndexChange]);

  if (!visible || !photos.length) return null;
  const current = photos[index];
  if (!current) return null;

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx > 0 && index > 0) onIndexChange?.(index - 1);
      else if (dx < 0 && index < photos.length - 1) onIndexChange?.(index + 1);
    }
    touchStartX.current = null;
  };

  const fmtTime = (v) => {
    if (!v) return '';
    try {
      return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const lightbox = (
    <div
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 9900,
        background: 'rgba(0,0,0,0.94)',
        display: 'flex', flexDirection: 'column',
        animation: 'fadeIn 0.18s ease-out',
      }}
    >
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', color: 'white',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.6), transparent)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: 'white' }}>
            {formatType ? formatType(current.type) : (current.type || 'Foto')}
          </div>
          {(current.createdAt || current.uploadedByName) && (
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              {fmtTime(current.createdAt)}{current.uploadedByName ? ` · ${current.uploadedByName}` : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'Poppins', fontSize: 11, fontWeight: 700,
            background: 'rgba(255,255,255,0.15)', color: 'white',
            padding: '4px 10px', borderRadius: 999,
          }}>
            {index + 1} / {photos.length}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onClose?.(); }}
            aria-label="Tutup"
            style={{
              width: 36, height: 36, borderRadius: 18,
              background: 'rgba(255,255,255,0.15)',
              border: 'none', cursor: 'pointer', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 16px', position: 'relative', overflow: 'hidden',
        }}
      >
        <img
          key={current.url}
          src={current.url}
          alt={current.type || 'foto'}
          style={{
            maxWidth: '100%', maxHeight: '100%',
            borderRadius: 12, objectFit: 'contain',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            animation: 'photoIn 0.22s ease-out',
          }}
        />

        {/* Prev button */}
        {index > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onIndexChange?.(index - 1); }}
            aria-label="Sebelumnya"
            style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              width: 40, height: 40, borderRadius: 20,
              background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)',
              border: 'none', cursor: 'pointer', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        {/* Next button */}
        {index < photos.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); onIndexChange?.(index + 1); }}
            aria-label="Berikutnya"
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              width: 40, height: 40, borderRadius: 20,
              background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)',
              border: 'none', cursor: 'pointer', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Bottom: notes + thumbnails strip */}
      <div onClick={(e) => e.stopPropagation()} style={{ padding: '8px 12px 16px' }}>
        {current.notes && (
          <div style={{
            background: 'rgba(255,255,255,0.10)', borderRadius: 10,
            padding: '8px 12px', marginBottom: 10,
            fontFamily: 'Poppins', fontSize: 12, color: 'white',
            maxHeight: 80, overflowY: 'auto',
          }}>
            📝 {current.notes}
          </div>
        )}
        {photos.length > 1 && (
          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto',
            paddingBottom: 4, scrollbarWidth: 'thin',
          }}>
            {photos.map((p, i) => (
              <button
                key={p.id || p.url || i}
                onClick={(e) => { e.stopPropagation(); onIndexChange?.(i); }}
                style={{
                  flexShrink: 0, width: 50, height: 50,
                  borderRadius: 8, overflow: 'hidden', padding: 0,
                  border: i === index ? '2px solid white' : '2px solid transparent',
                  opacity: i === index ? 1 : 0.55,
                  cursor: 'pointer', background: 'transparent',
                  transition: 'opacity 0.15s, border-color 0.15s',
                }}
              >
                <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes photoIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(lightbox, document.body);
};

// ── New components (split from monolith) ──────────────────────────────────
export { GlobalErrorBoundary } from './GlobalErrorBoundary';
export { GlobalLoading } from './GlobalLoading';
export { default as OutletDropdown } from './OutletDropdown';
export { AnimatedNumber, useAnimatedNumber, ProgressRing, PulseDot } from './AnimatedNumber';
export { SubSessionBadge } from './SubSessionBadge';

// ── EmptyState with Illustrations ──────────────────────────────────────────────
// EmptyState exported below in Compact UI System v2.0 section

// ── Phase 4: Dashboard Intelligence Widgets ─────────────────────────────────
export { default as LowStockAlertWidget } from '../LowStockAlertWidget';
export { default as TransactionMetricsWidget } from '../TransactionMetricsWidget';
export { default as OutletComparisonWidget } from '../OutletComparisonWidget';
export { default as PaymentTrendChart } from '../PaymentTrendChart';
export { default as KasOutletBalanceWidget } from './KasOutletBalanceWidget';
export { default as PaymentBreakdownCard, InlinePaymentSummary } from './PaymentBreakdownCard';

// ── Premium Animations Components ────────────────────────────────────────────
export {
  FloatingBubble,
  Sparkle,
  SparkleIcon,
  GlowOrb,
  Confetti,
  FloatingElement,
  PremiumCard,
  PremiumButton,
  PremiumInput,
  PremiumBadge,
  ShimmerSweep,
  PremiumBackground,
  AnimatedGradientText,
} from './PremiumAnimations';

// ── Status Icons & Payment Status ─────────────────────────────────────────────
export * from './StatusIcons';
export { PaymentStatusBadge, PaymentStatusBadgeSimple, getPaymentStatus } from './PaymentStatusBadge';

// ── Unified Filter Components ──────────────────────────────────────────────
export { default as FilterModal, FilterSection, FilterChipGroup, DatePresets, StatusChips, SearchFilterHeader, QuickFilterChips, CheckboxList } from './FilterModal';

// ── Compact UI System v2.0 Components ──────────────────────────────────────────────
export { default as StatCard, StatCardGrid, StatCardSkeleton, StatCardGridSkeleton, StatMini } from './StatCard';
export { default as ChartCard, ChartCardGrid, ChartSkeleton, ChartCardSkeleton, ChartGridSkeleton } from './ChartCard';
export { default as ListCard, ListCardGroup, ListCardSkeleton, ListCardGridSkeleton, StatusBadge } from './ListCard';
export { default as AlertCard, AlertCardGroup, AlertCardSkeleton, AlertCardGridSkeleton, AlertIcon, SeverityBadge, StockIndicator } from './AlertCard';
export { default as FilterBar, FilterBarSkeleton, DateRangePicker, SearchInput, StatusDropdown, ExportButton } from './FilterBar';
export { default as PageHeader, PageHeaderSkeleton, SectionHeader } from './PageHeader';
export { default as EmptyState, EmptyIllustration, EmptyStateList, EmptyStateCard, EmptyStateInline, EMPTY_STATE_CONFIG } from './EmptyState';

// ── Glassmorphism Components (P2 Design System) ───────────────────────────────────
export { default as GlassModal, ConfirmModal, AlertModal, SuccessModal, ErrorModal } from './GlassModal';
export { default as GlassButton, GlassButtonGroup, GlassIconButton } from './GlassButton';

// ── Service Icon (gambar dari Icon and Asset Laundry sebagai icon) ───────────
export { default as ServiceIcon, ServiceIconBadge, ServiceIconGroup, ServiceIconList, SERVICE_ICON_PRESETS, SERVICE_ICON_NAMES } from './ServiceIcon';
export { ServiceIconWrapper, HybridIcon, ServiceIconButton, QuickIconBadge, IconGrid, LUCIDE_TO_SERVICE } from './IconMapper';

// ── Profile Avatar Components ─────────────────────────────────────────────────
export { default as ProfileAvatar, ProfileAvatarButton, CompactProfileAvatar, AvatarGroup } from './ProfileAvatar';

// ── Layout Components ─────────────────────────────────────────────────────────────
export { PageWrapper, Card, CardHeader, Grid, Stack, Row, Spacer, LAYOUT, getPagePadding, getBottomNavPadding } from '../layout/PageWrapper';
// Note: Divider already exported above at line 1009

// Note: DesignSystem components are NOT re-exported here
// Components like GlassCard, ClayCard, etc. are available directly from './DesignSystem'
// Use: import { GlassCard, ClayCard } from './DesignSystem';
