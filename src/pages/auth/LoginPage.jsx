import { useState } from 'react';
import { C } from '../../utils/theme';
import { MOCK_DATA } from '../../utils/mockData';
import { Btn, Input } from '../../components/ui';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [selectedRole, setSelectedRole] = useState('kasir');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [selectedOutlet, setSelectedOutlet] = useState(MOCK_DATA.outlets[0]);
  const [outletSheet, setOutletSheet] = useState(false);

  const ROLES = [
    { id: 'kasir', label: 'Kasir', color: C.primary },
    { id: 'produksi', label: 'Produksi', color: '#0EA5E9' },
    { id: 'admin', label: 'Admin', color: '#8B5CF6' },
    { id: 'finance', label: 'Finance', color: C.success },
  ];

  const handleLogin = () => {
    const errs = {};
    if (!username.trim()) errs.username = 'Username wajib diisi';
    if (!password.trim()) errs.password = 'Password wajib diisi';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    setTimeout(() => {
      const user = MOCK_DATA.users.find((u) => u.role === selectedRole) || MOCK_DATA.users[0];
      setLoading(false);
      onLogin({ ...user, role: selectedRole, outlet: selectedOutlet });
    }, 1200);
  };

  const eyeIcon = (
    <button onClick={() => setShowPass(!showPass)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.n600, display: 'flex', padding: 0 }}>
      {showPass
        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>}
    </button>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.n50 }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${C.primary}, ${C.primaryDark})`, padding: '40px 24px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4, border: '1.5px solid rgba(255,255,255,0.2)' }}>
          <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="18" stroke="white" strokeWidth="2.5" fill="none" opacity="0.3" />
            <path d="M14 24 C14 18, 20 14, 24 20 C28 14, 34 18, 34 24 C34 30, 28 35, 24 38 C20 35, 14 30, 14 24Z" fill="white" opacity="0.9" />
          </svg>
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 26, fontWeight: 700, color: 'white' }}>Waschen</div>
        <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Masuk ke akun Anda</div>
      </div>

      <div style={{ margin: '-24px 20px 0', background: C.white, borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(15,23,42,0.1)', position: 'relative', zIndex: 1, marginBottom: 24 }}>
        {/* Outlet selector */}
        <button onClick={() => setOutletSheet(true)} style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${C.n300}`, background: C.n50, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🏪</span>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, textAlign: 'left' }}>{selectedOutlet.name}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, textAlign: 'left' }}>{selectedOutlet.address}</div>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n600} strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>

        {/* Role selector */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n600, marginBottom: 8 }}>Role</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRole(r.id)}
                style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: `1.5px solid ${selectedRole === r.id ? r.color : C.n300}`, background: selectedRole === r.id ? `${r.color}15` : C.white, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 11, fontWeight: selectedRole === r.id ? 700 : 400, color: selectedRole === r.id ? r.color : C.n600, textAlign: 'center' }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <Input label="Username / Email" value={username} onChange={setUsername} placeholder="Masukkan username" error={errors.username} />
        <Input label="Password" value={password} onChange={setPassword} type={showPass ? 'text' : 'password'} placeholder="Masukkan password" error={errors.password} rightIcon={eyeIcon} />

        <Btn variant="primary" fullWidth size="lg" loading={loading} onClick={handleLogin} style={{ marginTop: 8 }}>
          Masuk
        </Btn>
      </div>

      {/* Outlet sheet */}
      {outletSheet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }} onClick={() => setOutletSheet(false)}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.white, borderRadius: '20px 20px 0 0', padding: '20px 20px 40px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900, marginBottom: 16 }}>Pilih Outlet</div>
            {MOCK_DATA.outlets.map((o) => (
              <button key={o.id} onClick={() => { setSelectedOutlet(o); setOutletSheet(false); }} style={{ width: '100%', padding: '14px', borderRadius: 12, border: `1.5px solid ${selectedOutlet.id === o.id ? C.primary : C.n100}`, background: selectedOutlet.id === o.id ? C.primaryLight : C.white, cursor: 'pointer', textAlign: 'left', marginBottom: 10 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{o.name}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>{o.address}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
