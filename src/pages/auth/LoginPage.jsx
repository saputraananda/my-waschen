import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { C } from '../../utils/theme';
import { MOCK_DATA } from '../../utils/mockData';
import { Btn, Input } from '../../components/ui';
import { useApp } from '../../context/AppContext';

const ROLES = [
  { id: 'admin',    label: 'Admin',    color: '#8B5CF6',  icon: '👑' },
  { id: 'kasir',    label: 'Kasir',    color: C.primary,  icon: '🧾' },
  { id: 'produksi', label: 'Produksi', color: '#0EA5E9',  icon: '🧺' },
  { id: 'finance',  label: 'Finance',  color: C.success,  icon: '💰' },
];

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const { loginContext } = useApp();

  const [step, setStep]                 = useState(1);
  const [adminPayload, setAdminPayload] = useState(null);

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const [errors, setErrors]             = useState({});
  const [globalError, setGlobalError]   = useState('');

  const [roleCode, setRoleCode]             = useState('admin');
  const [outlets, setOutlets]               = useState(MOCK_DATA.outlets);
  const [selectedOutlet, setSelectedOutlet] = useState(MOCK_DATA.outlets[0]);
  const [outletSheet, setOutletSheet]       = useState(false);

  useEffect(() => {
    const fetchOutlets = async () => {
      try {
        const res = await axios.get('/api/auth/outlets');
        const list = res?.data?.data || [];
        if (list.length) {
          setOutlets(list);
          setSelectedOutlet(list[0]);
        }
      } catch {}
    };
    fetchOutlets();
  }, []);

  const validate = () => {
    const errs = {};
    if (!email.trim())    errs.email    = 'Email wajib diisi';
    if (!password.trim()) errs.password = 'Password wajib diisi';
    return errs;
  };

  const finalizeLogin = (payload, overrideRole, overrideOutlet) => {
    const finalRole = overrideRole || payload.roleCode || payload.role;
    const finalOutletId = overrideOutlet ? overrideOutlet.id : payload.outletId;
    const finalOutletName = overrideOutlet ? overrideOutlet.name : payload.outletName;
    
    loginContext({
      token:      payload.token,
      userId:     payload.userId,
      name:       payload.name,
      avatar:     payload.avatar,
      roleCode:   finalRole,
      outletId:   finalOutletId,
      outletName: finalOutletName,
    });

    if (onLogin) onLogin({ ...payload, roleCode: finalRole });

    const rolePathMap = {
      kasir: '/kasir/dashboard',
      produksi: '/produksi/dashboard',
      admin: '/admin/dashboard',
      finance: '/finance/dashboard',
    };
    navigate(rolePathMap[finalRole] || '/kasir/dashboard');
  };

  const handleLogin = async () => {
    setGlobalError('');
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/login', { email: email.trim(), password });
      const payload = response?.data?.data || {};

      if (payload.roleCode === 'admin') {
        setAdminPayload(payload);
        const defaultOutlet = outlets.find(o => o.id === payload.outletId) || outlets[0];
        setSelectedOutlet(defaultOutlet);
        setStep(2);
      } else {
        finalizeLogin(payload, null, null);
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Kredensial tidak valid. Coba lagi.';
      setGlobalError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminProceed = () => finalizeLogin(adminPayload, roleCode, selectedOutlet);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (step === 1) handleLogin();
      if (step === 2) handleAdminProceed();
    }
  };

  const eyeIcon = (
    <button onClick={() => setShowPass(!showPass)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.n500, display: 'flex', padding: 0 }}>
      {showPass 
        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>}
    </button>
  );

  return (
    <div 
      onKeyDown={handleKeyDown}
      style={{ 
        flex: 1, 
        minHeight: '100vh',
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        background: '#F8FAFC', // Base cerah
        overflow: 'hidden',
        fontFamily: 'Poppins, sans-serif'
      }} 
    >
      {/* ─── AMBIENT GLOWING BACKGROUND (THE MAGIC) ─── */}
      <div style={{ position: 'absolute', top: '-10%', left: '-20%', width: '60vw', height: '60vw', background: C.primary, borderRadius: '50%', filter: 'blur(100px)', opacity: 0.35, zIndex: 0, animation: 'pulseGlow 8s infinite alternate' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-15%', width: '50vw', height: '50vw', background: '#0EA5E9', borderRadius: '50%', filter: 'blur(100px)', opacity: 0.25, zIndex: 0, animation: 'pulseGlow 10s infinite alternate-reverse' }} />

      {/* ─── MAIN CONTENT WRAPPER ─── */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '420px', margin: '0 auto' }}>
        
        {/* HEADER AREA */}
        <div style={{ textAlign: 'center', marginBottom: '32px', animation: 'fadeInDown 0.5s ease-out' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '24px', margin: '0 auto 20px',
            background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 12px 24px ${C.primary}40`,
            border: '2px solid rgba(255,255,255,0.5)'
          }}>
            <svg width="42" height="42" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="18" stroke="white" strokeWidth="3" fill="none" opacity="0.3" />
              <path d="M14 24 C14 18, 20 14, 24 20 C28 14, 34 18, 34 24 C34 30, 28 35, 24 38 C20 35, 14 30, 14 24Z" fill="white" />
            </svg>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: C.n900, margin: '0 0 4px', letterSpacing: '-0.5px' }}>Waschen</h1>
          <p style={{ fontSize: '15px', color: C.n500, margin: 0, fontWeight: 500 }}>
            {step === 1 ? 'Smart Laundry POS System' : `Welcome back, ${adminPayload?.name?.split(' ')[0]} 👋`}
          </p>
        </div>

        {/* ─── FROSTED GLASS CARD ─── */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(24px)', // Efek kaca buram
          WebkitBackdropFilter: 'blur(24px)', // Support iOS
          border: '1px solid rgba(255, 255, 255, 0.8)',
          borderRadius: '32px',
          padding: '36px 24px',
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,1)',
          animation: 'fadeInUp 0.5s ease-out'
        }}>
          
          {/* ─── STEP 1: LOGIN ─── */}
          {step === 1 && (
            <div>
              <Input 
                label="Email Pekerja" 
                value={email} 
                onChange={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: '' })); setGlobalError(''); }} 
                placeholder="nama@waschen.id" 
                error={errors.email} 
              />
              
              <div style={{ marginTop: '20px' }}>
                <Input 
                  label="Password" 
                  value={password} 
                  onChange={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: '' })); setGlobalError(''); }} 
                  type={showPass ? 'text' : 'password'} 
                  placeholder="••••••••" 
                  error={errors.password} 
                  rightIcon={eyeIcon} 
                />
              </div>

              {globalError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: `1px solid ${C.danger}30`, borderRadius: '14px', padding: '12px 16px', marginTop: '20px', fontSize: '13px', color: C.danger, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span>{globalError}
                </div>
              )}

              <div style={{ marginTop: '32px' }}>
                <Btn variant="primary" fullWidth size="lg" loading={loading} onClick={handleLogin} 
                     style={{ height: '56px', fontSize: '16px', fontWeight: 600, borderRadius: '16px', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, boxShadow: `0 12px 24px ${C.primary}35`, transition: 'transform 0.2s' }}>
                  Masuk Sekarang
                </Btn>
              </div>
            </div>
          )}

          {/* ─── STEP 2: ADMIN SWITCHER ─── */}
          {step === 2 && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.n600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lokasi Cabang</div>
                <button onClick={() => setOutletSheet(true)} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: `1px solid rgba(255,255,255,0.8)`, background: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                      <span style={{ fontSize: '20px' }}>🏬</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: C.n900, textAlign: 'left' }}>{selectedOutlet?.name}</div>
                      <div style={{ fontSize: '12px', color: C.n500, textAlign: 'left', marginTop: '2px' }}>{selectedOutlet?.address?.split(',')[0]}</div>
                    </div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.n600} strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
              </div>

              <div style={{ marginBottom: '32px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.n600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pilih Role Akses</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {ROLES.map((r) => (
                    <button key={r.id} onClick={() => setRoleCode(r.id)} style={{ padding: '16px 12px', borderRadius: '16px', border: roleCode === r.id ? `2px solid ${r.color}` : '2px solid transparent', background: roleCode === r.id ? `${r.color}15` : 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', transform: roleCode === r.id ? 'translateY(-4px)' : 'none', boxShadow: roleCode === r.id ? `0 8px 16px ${r.color}20` : '0 2px 8px rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: '28px', filter: roleCode === r.id ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' : 'none' }}>{r.icon}</span>
                      <span style={{ fontSize: '13px', fontWeight: roleCode === r.id ? 700 : 600, color: roleCode === r.id ? r.color : C.n600 }}>{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Btn variant="primary" fullWidth size="lg" onClick={handleAdminProceed} style={{ height: '56px', fontSize: '16px', fontWeight: 600, borderRadius: '16px', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, boxShadow: `0 12px 24px ${C.primary}35` }}>
                  Buka Dashboard
                </Btn>
                
                <button onClick={() => setStep(1)} style={{ width: '100%', marginTop: '16px', padding: '12px', background: 'none', border: 'none', color: C.n500, fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s' }}>
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Outlet Bottom Sheet Modal ── */}
      {outletSheet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 100, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setOutletSheet(false)}>
          <div style={{ width: '100%', maxWidth: '480px', background: C.white, borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '24px 24px 40px', animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 -10px 40px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: '48px', height: '6px', borderRadius: '3px', background: C.n200, margin: '0 auto 24px' }} />
            <div style={{ fontSize: '20px', fontWeight: 800, color: C.n900, marginBottom: '24px' }}>Pilih Cabang Waschen</div>
            <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
              {outlets.map((o) => (
                <button key={o.id} onClick={() => { setSelectedOutlet(o); setOutletSheet(false); }} style={{ width: '100%', padding: '18px 20px', borderRadius: '20px', border: selectedOutlet?.id === o.id ? `2px solid ${C.primary}` : `1px solid ${C.n200}`, background: selectedOutlet?.id === o.id ? C.primaryLight : C.white, cursor: 'pointer', textAlign: 'left', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: C.n900 }}>{o.name}</div>
                    <div style={{ fontSize: '13px', color: C.n500, marginTop: '4px', fontWeight: 500 }}>{o.address}</div>
                  </div>
                  {selectedOutlet?.id === o.id && (
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${C.primary}40` }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modern Animations */}
      <style>{`
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes pulseGlow { 0% { transform: scale(1) translate(0, 0); opacity: 0.25; } 100% { transform: scale(1.1) translate(20px, 20px); opacity: 0.45; } }
      `}</style>
    </div>
  );
};