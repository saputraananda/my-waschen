import { useState } from 'react';
import { C } from '../utils/theme';
import { Avatar, Btn, Divider } from '../components/ui';

const ROLE_LABEL = { admin: 'Admin', kasir: 'Kasir', produksi: 'Produksi', finance: 'Finance' };

export default function SettingsPage({ user, navigate, onLogout, onSwitchRole }) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isAdmin = (user?.originalRoleCode ?? user?.roleCode) === 'admin';

  const ADMIN_ROLES = [
    { id: 'kasir',    label: 'Kasir',    icon: '🧾' },
    { id: 'produksi', label: 'Produksi', icon: '🧺' },
    { id: 'admin',    label: 'Admin',    icon: '👑' },
    { id: 'finance',  label: 'Finance',  icon: '💰' },
  ];

  const MENUS = [
    { label: 'Notifikasi',      icon: '🔔', screen: 'notifikasi' },
    { label: 'Daftar Member',   icon: '👥', screen: 'daftar_member' },
    { label: 'Bantuan',         icon: '❓', screen: null },
    { label: 'Kebijakan Privasi', icon: '🔒', screen: null },
  ];

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
            <span style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{user?.outlet?.name || ''}</span>
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
          <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.07)' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n500, letterSpacing: 0.5, marginBottom: 12 }}>GANTI TAMPILAN ROLE</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {ADMIN_ROLES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSwitchRole(r.id)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 4px', borderRadius: 12, border: `1.5px solid ${user?.role === r.id ? C.primary : C.n100}`, background: user?.role === r.id ? C.primaryLight : C.n50, cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 18 }}>{r.icon}</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: user?.role === r.id ? 700 : 400, color: user?.role === r.id ? C.primary : C.n600 }}>{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Menu */}
        <div style={{ background: C.white, borderRadius: 16, padding: '4px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          {MENUS.map((m, i) => (
            <div key={m.label}>
              <button
                onClick={() => m.screen && navigate(m.screen)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', background: 'transparent', border: 'none', cursor: m.screen ? 'pointer' : 'default', textAlign: 'left' }}
              >
                <span style={{ fontSize: 18, width: 28 }}>{m.icon}</span>
                <span style={{ flex: 1, fontFamily: 'Poppins', fontSize: 14, color: C.n900 }}>{m.label}</span>
                {m.screen && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>}
              </button>
              {i < MENUS.length - 1 && <Divider mx={0} my={0} />}
            </div>
          ))}
        </div>

        {/* App version */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Waschen v1.0.0 · PT Waschen Alora Indonesia</div>
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
