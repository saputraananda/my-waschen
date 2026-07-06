import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { C, T } from '../utils/theme';
import { Avatar, Btn, Divider } from '../components/ui';
import {
  IconChart, IconPackage, IconStar, IconMoney, IconPrint, IconStore,
  IconBell, IconUsers, IconHelp, IconLock, IconPerson, IconClock
} from '../components/ui/StatusIcons';

// ─── Premium Animation Assets ───────────────────────────────────────────────
import bubbleIcon from '../assets/Decorative icon/bubble-1.webp'
import bubble2Icon from '../assets/Decorative icon/bubble-2.webp'
import soapBubble from '../assets/Decorative icon/soap-bubble.webp'

// ─── Premium Animation Components ──────────────────────────────────────────────
const FloatingBubble = ({ src, size, top, left, right, bottom, delay = 0, duration = 5, opacity = 0.35 }) => (
  <motion.div
    animate={{ y: [0, -15, 0], scale: [1, 1.08, 1], opacity: [opacity * 0.5, opacity, opacity * 0.5] }}
    transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
    style={{ position: 'absolute', top, left, right, bottom, width: size, height: size, pointerEvents: 'none', zIndex: 0 }}
  >
    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.08))' }} loading="lazy" />
  </motion.div>
);

const Sparkle = ({ top, left, size = 5, delay = 0 }) => (
  <motion.div
    style={{ position: 'absolute', top, left, width: size, height: size, background: '#E85D04', borderRadius: '50%', boxShadow: `0 0 ${size}px #E85D04`, pointerEvents: 'none', zIndex: 1 }}
    animate={{ scale: [0, 1, 0], opacity: [0, 1, 0], rotate: [0, 180, 360] }}
    transition={{ duration: 2, delay, repeat: Infinity, ease: 'easeOut' }}
  />
);

const ROLE_LABEL = { admin: 'Admin', kasir: 'Frontline', frontline: 'Frontline', produksi: 'Produksi', finance: 'Finance' };

const fmtDate = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return v; }
};

export default function SettingsPage({ user, navigate, onLogout, onSwitchRole }) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [shiftStatus, setShiftStatus] = useState(null);
  const [outletInfo, setOutletInfo] = useState(null);

  const isAdmin = (user?.originalRoleCode ?? user?.roleCode) === 'admin';

  const ADMIN_ROLES = [
    { id: 'frontline', label: 'Frontline', Icon: IconPackage },
    { id: 'produksi', label: 'Produksi', Icon: IconChart },
    { id: 'admin',    label: 'Admin',    Icon: IconStar },
    { id: 'finance',  label: 'Finance',  Icon: IconMoney },
  ];

  const role = user?.role;
  const outletBadge = outletInfo ? (outletInfo.isActive ? { text: '● Aktif', bg: C.successBg, color: C.success } : { text: '● Nonaktif', bg: C.validationErrorBg, color: C.danger }) : null;

  const MENUS = (() => {
    const base = [];

    if (role === 'kasir' || role === 'frontline') {
      base.push(
        { label: 'Pengaturan Printer', Icon: IconPrint, screen: 'printer_settings' },
        { label: 'Info Outlet', Icon: IconStore, screen: 'info_outlet', params: { outletId: user?.outletId }, badge: outletBadge },
        { label: 'Notifikasi', Icon: IconBell, screen: 'notifikasi' },
        { label: 'Daftar Member', Icon: IconUsers, screen: 'daftar_member' },
      );
    } else if (role === 'produksi') {
      base.push(
        { label: 'Notifikasi', Icon: IconBell, screen: 'notifikasi' },
      );
    } else if (role === 'finance') {
      base.push(
        { label: 'Laporan Outlet', Icon: IconChart, screen: 'kasir_laporan' },
        { label: 'Info Outlet', Icon: IconStore, screen: 'info_outlet', params: { outletId: user?.outletId }, badge: outletBadge },
        { label: 'Notifikasi', Icon: IconBell, screen: 'notifikasi' },
        { label: 'Daftar Member', Icon: IconUsers, screen: 'daftar_member' },
      );
    } else {
      base.push(
        { label: 'Pengaturan Printer', Icon: IconPrint, screen: 'printer_settings' },
        { label: 'Manajemen Outlet', Icon: IconStore, screen: 'manajemen_outlet' },
        { label: 'Notifikasi', Icon: IconBell, screen: 'notifikasi' },
        { label: 'Data Pegawai', Icon: IconPerson, screen: 'manajemen_user' },
        { label: 'Manajemen Layanan', Icon: IconPackage, screen: 'manajemen_layanan' },
      );
    }

    base.push(
      { label: 'Bantuan', Icon: IconHelp, screen: null },
      { label: 'Kebijakan Privasi', Icon: IconLock, screen: 'kebijakan_privasi' },
    );

    return base;
  })();

  useEffect(() => {
    if (user?.role !== 'kasir' && user?.role !== 'frontline') return;
    axios.get('/api/shifts/status')
      .then((r) => setShiftStatus(r?.data || null))
      .catch(() => setShiftStatus(null));
  }, [user?.role]);

  useEffect(() => {
    if (!user?.outletId) return;
    axios.get(`/api/outlets/${user.outletId}`)
      .then((r) => setOutletInfo(r?.data?.data || null))
      .catch(() => setOutletInfo(null));
  }, [user?.outletId]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.n50 }}>
      {/* Profile header */}
      <div style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, padding: '24px 20px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <Avatar photo={user?.photo} initials={user?.avatar || 'US'} size={72} onClick={() => navigate('profil')} />
          <div style={{ position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: 11, background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.5" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: 'white' }}>{user?.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'white', padding: '2px 10px', borderRadius: 999 }}>
              {ROLE_LABEL[user?.role] || user?.role?.toUpperCase()}
            </span>
            {user?.outlet?.name && (
              <span style={{ background: 'rgba(255,255,255,0.15)', fontFamily: 'Poppins', fontSize: 11, color: 'white', padding: '2px 10px', borderRadius: 999 }}>
                {user.outlet.name}
              </span>
            )}
            {outletInfo && (
              <span style={{
                background: outletInfo.isActive ? C.success : C.danger,
                fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: 'white',
                padding: '2px 9px', borderRadius: 999,
                display: 'inline-flex', alignItems: 'center', gap: 4,
                boxShadow: outletInfo.isActive ? `0 2px 6px ${C.success}65` : `0 2px 6px ${C.danger}65`,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: 3,
                  background: 'white',
                  boxShadow: '0 0 0 2px rgba(255,255,255,0.3)',
                }} />
                {outletInfo.isActive ? 'Aktif' : 'Nonaktif'}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate('profil')}
          style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, padding: '6px 18px', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: 'white' }}
        >
          Lihat Profil
        </button>
      </div>

      <div style={{ padding: '0 16px', marginTop: -16, paddingBottom: 24 }}>

        {/* Switch role — hanya admin */}
        {isAdmin && (
          <div style={{ ...T.card, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, letterSpacing: 0.5, marginBottom: 12 }}>GANTI TAMPILAN ROLE</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {ADMIN_ROLES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSwitchRole(r.id)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 4px', borderRadius: 12, border: `1.5px solid ${user?.role === r.id ? C.primary : C.n100}`, background: user?.role === r.id ? C.primaryTint : C.n50, cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 18, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><r.Icon size={18} color="#6e2e78" /></span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: user?.role === r.id ? 700 : 400, color: user?.role === r.id ? C.primary : C.n600 }}>{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}


        {/* Shift section */}
        {(role === 'kasir' || role === 'frontline') && (
          <div style={{ ...T.card, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, letterSpacing: 0.5, marginBottom: 10 }}>
              SHIFT KASIR
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>
                  {shiftStatus?.isOpen ? 'Shift sedang aktif' : 'Shift belum aktif'}
                </div>
                {shiftStatus?.session?.openedAt && (
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>
                    Dibuka {new Date(shiftStatus.session.openedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                )}
              </div>
              <span style={{
                padding: '4px 10px',
                borderRadius: 999,
                fontFamily: 'Poppins',
                fontSize: 10,
                fontWeight: 700,
                background: shiftStatus?.isOpen ? C.successBg : C.validationErrorBg,
                color: shiftStatus?.isOpen ? C.successDark : C.validationErrorText,
              }}>
                {shiftStatus?.isOpen ? 'BUKA' : 'TUTUP'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn
                variant="success"
                style={{ flex: 1 }}
                onClick={() => navigate('buka_shift')}
                disabled={!!shiftStatus?.isOpen}
              >
                Buka Shift
              </Btn>
              <Btn
                variant="danger"
                style={{ flex: 1 }}
                onClick={() => navigate('tutup_shift')}
                disabled={!shiftStatus?.isOpen}
              >
                Tutup Shift
              </Btn>
            </div>
          </div>
        )}

        {/* Menu */}
        <div style={{ ...T.card, padding: '4px 16px', marginBottom: 12 }}>
          {MENUS.map((m, i) => (
            <div key={m.label}>
              <button
                onClick={() => m.screen && navigate(m.screen, m.params || undefined)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', background: 'transparent', border: 'none', cursor: m.screen ? 'pointer' : 'default', textAlign: 'left' }}
              >
                <span style={{ width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><m.Icon size={18} color="#6e2e78" /></span>
                <span style={{ flex: 1, fontFamily: 'Poppins', fontSize: 14, color: C.n900 }}>{m.label}</span>
                {m.badge && (
                  <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: m.badge.bg, color: m.badge.color, marginRight: 4 }}>
                    {m.badge.text}
                  </span>
                )}
                {m.screen && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n600} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>}
              </button>
              {i < MENUS.length - 1 && <Divider mx={0} my={0} />}
            </div>
          ))}
        </div>

        {/* App version */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>Waschen v1.0.0 · PT Waschen Alora Indonesia</div>
        </div>

        <Btn variant="danger" fullWidth onClick={() => setShowLogoutConfirm(true)}>Keluar</Btn>
      </div>

      {showLogoutConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: 360, background: C.white, borderRadius: 18, padding: 18,
              boxShadow: '0 12px 36px rgba(15,23,42,0.18)', border: `1.5px solid ${C.n100}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: `${C.danger}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
              </div>
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.n900 }}>Konfirmasi Keluar</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Apakah kamu yakin ingin keluar?</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${C.n200}`, background: C.white, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700 }}
              >
                Batal
              </button>
              <button
                onClick={() => { setShowLogoutConfirm(false); onLogout(); }}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: 'none', background: C.danger, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: 'white', boxShadow: `0 6px 16px ${C.danger}45` }}
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
