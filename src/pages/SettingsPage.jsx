import { C } from '../utils/theme';
import { Avatar, Btn, Divider } from '../components/ui';

export default function SettingsPage({ user, navigate, onLogout, onSwitchRole }) {
  const ROLES = [
    { id: 'kasir', label: 'Kasir', icon: '🧾' },
    { id: 'produksi', label: 'Produksi', icon: '🧺' },
    { id: 'admin', label: 'Admin', icon: '👑' },
    { id: 'finance', label: 'Finance', icon: '💰' },
  ];

  const MENUS = [
    { label: 'Notifikasi', icon: '🔔', screen: 'notifikasi' },
    { label: 'Daftar Member', icon: '👥', screen: 'daftar_member' },
    { label: 'Bantuan', icon: '❓', screen: null },
    { label: 'Kebijakan Privasi', icon: '🔒', screen: null },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.n50 }}>
      {/* Profile header */}
      <div style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, padding: '24px 20px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <Avatar initials={user?.avatar || 'US'} size={68} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: 'white' }}>{user?.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'white', padding: '2px 10px', borderRadius: 999 }}>{user?.role?.toUpperCase()}</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{user?.outlet?.name || ''}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px', marginTop: -16, paddingBottom: 24 }}>
        {/* Switch role */}
        <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.07)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 12 }}>GANTI ROLE</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {ROLES.map((r) => (
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

        <Btn variant="danger" fullWidth onClick={onLogout}>Keluar</Btn>
      </div>
    </div>
  );
}
