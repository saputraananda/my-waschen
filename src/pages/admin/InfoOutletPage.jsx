import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Chip, ProfileAvatar } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../utils/hooks';
import { GlowOrb, Sparkle, FloatingBubble } from '../../components/ui/PremiumAnimations';
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp';
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp';

const ROLE_LABEL = {
  kasir: 'Frontliner',
  frontline: 'Frontliner',
  admin: 'Admin',
  produksi: 'Produksi',
};

const fmtDate = (v) => {
  if (!v) return '-';
  try {
    return new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return String(v);
  }
};

const fmtDt = (v) => {
  if (!v) return '-';
  try {
    return new Date(v).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  } catch (e) {
    return String(v);
  }
};

// ─── Premium Card Style ──────────────────────────────────────────────────────
const PREMIUM_CARD = {
  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
  boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
  borderRadius: 18,
};

// ─── Skeleton Block ───────────────────────────────────────────────────────────
function SkeletonBlock({ height = 120, style = {} }) {
  return (
    <div style={{
      height,
      borderRadius: 18,
      background: 'linear-gradient(90deg, rgba(91,0,95,0.05) 25%, rgba(91,0,95,0.1) 50%, rgba(91,0,95,0.05) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      marginBottom: 10,
      ...style,
    }} />
  );
}

// ── Balance Tab Button ──────────────────────────────────────────────────────
const BalanceTab = ({ label, active, onClick }) => (
  <motion.button
    onClick={onClick}
    whileTap={{ scale: 0.97 }}
    style={{
      flex: 1,
      padding: '10px 0',
      fontFamily: 'Poppins',
      fontSize: 13,
      fontWeight: active ? 700 : 500,
      color: active ? 'white' : C.n700,
      background: active ? `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` : 'transparent',
      border: `1.5px solid ${active ? C.primary : C.n200}`,
      borderRadius: 12,
      cursor: 'pointer',
      transition: 'all 0.2s',
      boxShadow: active ? '0 4px 12px rgba(91, 0, 95, 0.2)' : 'none',
    }}
  >
    {label}
  </motion.button>
);

// ── Menu Item Row ────────────────────────────────────────────────────────────
const MenuItem = ({ icon, label, sub, onClick }) => (
  <motion.button
    onClick={onClick}
    whileTap={{ scale: 0.98 }}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      width: '100%',
      padding: '16px 0',
      background: 'none',
      border: 'none',
      borderBottom: `1px solid ${C.n100}`,
      cursor: 'pointer',
      textAlign: 'left',
    }}
  >
    <div style={{
      width: 40, height: 40, borderRadius: 12,
      background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
      boxShadow: '4px 4px 10px rgba(110, 46, 120, 0.08), -2px -2px 6px rgba(255, 255, 255, 0.95)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: C.primary, flexShrink: 0
    }}>
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{label}</div>
      {sub && <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700, marginTop: 1 }}>{sub}</div>}
    </div>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.n700} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
  </motion.button>
);

// ── Section Tab ──────────────────────────────────────────────────────────────
const SectionTab = ({ label, active, onClick }) => (
  <motion.button
    onClick={onClick}
    whileTap={{ scale: 0.98 }}
    style={{
      padding: '10px 16px',
      fontFamily: 'Poppins',
      fontSize: 12,
      fontWeight: active ? 700 : 500,
      color: active ? C.primary : C.n700,
      background: 'none',
      border: 'none',
      borderBottom: active ? `2.5px solid ${C.primary}` : '2.5px solid transparent',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </motion.button>
);

// ═════════════════════════════════════════════════════════════════════════════
export default function InfoOutletPage({ navigate, goBack, screenParams }) {
  const { isMobile } = useResponsive();
  const { user } = useApp();
  const outletId = screenParams?.outletId ?? user?.outletId;

  const [outlet, setOutlet] = useState(null);
  const [team, setTeam] = useState([]);
  const [services, setServices] = useState([]);
  const [kas, setKas] = useState(null);
  const [loading, setLoading] = useState(true);

  const [balanceTab, setBalanceTab] = useState('kas'); // kas | qris
  const [sectionTab, setSectionTab] = useState('info'); // info | layanan | tim

  const fetchAll = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      const [detailRes, teamRes, kasRes, svcRes] = await Promise.all([
        axios.get(`/api/outlets/${outletId}`),
        axios.get(`/api/outlets/${outletId}/team`),
        axios.get(`/api/outlets/${outletId}/kas`),
        axios.get(`/api/services?outletId=${outletId}`),
      ]);
      if (detailRes?.data?.data) setOutlet(detailRes.data.data);
      if (teamRes?.data?.data) setTeam(teamRes.data.data);
      if (kasRes?.data?.data) setKas(kasRes.data.data);
      if (svcRes?.data?.data) setServices(svcRes.data.data);
    } catch {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (!outletId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 14, color: C.n700 }}>Outlet ID tidak ditemukan.</div>
        <Btn variant="primary" onClick={goBack}>Kembali</Btn>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F3EEF7' }}>
        <style>{`
          @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        `}</style>
        {/* Premium Header */}
        <div style={{
          background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
          padding: '16px 20px 52px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <GlowOrb color="rgba(140, 76, 143, 0.4)" size={200} top="-60px" left="-30px" blur={50} />
          <GlowOrb color="rgba(249, 62, 17, 0.25)" size={150} top="40px" right="-40px" blur={40} />
          <Sparkle top="10%" left="15%" size={8} delay={0} color="#FFD700" />
          <Sparkle top="20%" left="80%" size={6} delay={0.5} color="#FF6B6B" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 700, color: 'white' }}>Info Outlet</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>Memuat data...</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <SkeletonBlock height={180} />
            <SkeletonBlock height={250} />
          </div>
        </div>
      </div>
    );
  }

  // Group services by category
  const svcByCategory = services.reduce((acc, s) => {
    const cat = s.category || 'Lainnya';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  // Group team by role
  const teamByRole = team.reduce((acc, u) => {
    const role = ROLE_LABEL[u.roleCode] || u.roleName || 'Lainnya';
    if (!acc[role]) acc[role] = [];
    acc[role].push(u);
    return acc;
  }, {});

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F3EEF7', overflow: 'hidden' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes floatA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-14px,16px) scale(1.08)} }
        @keyframes twinkle { 0%,100%{opacity:0;transform:scale(0.4) rotate(0deg)} 50%{opacity:1;transform:scale(1) rotate(20deg)} }
      `}</style>

      {/* ── Premium Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        padding: '16px 20px 52px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <GlowOrb color="rgba(140, 76, 143, 0.4)" size={200} top="-60px" left="-30px" blur={50} />
        <GlowOrb color="rgba(249, 62, 17, 0.25)" size={150} top="40px" right="-40px" blur={40} />
        <Sparkle top="10%" left="15%" size={8} delay={0} color="#FFD700" />
        <Sparkle top="20%" left="80%" size={6} delay={0.5} color="#FF6B6B" />
        <Sparkle top="60%" left="25%" size={7} delay={1} color="#4ECDC4" />
        <FloatingBubble src={bubbleIcon} size={18} top="15%" left="5%" delay={0} opacity={0.4} />
        <FloatingBubble src={bubble2Icon} size={14} top="35%" right="8%" delay={0.5} opacity={0.35} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>
              {outlet?.name || 'Outlet'}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              Info Outlet
            </div>
          </div>
          {goBack && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={goBack}
              style={{
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: 'white',
              }}
            >
              ← Kembali
            </motion.button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* ── Header Card ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            ...PREMIUM_CARD,
            padding: '20px',
            margin: '12px 16px 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 600, color: C.n900, lineHeight: 1.3 }}>
                {outlet?.name || 'Outlet'}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n700, marginTop: 4, lineHeight: 1.5 }}>
                {outlet?.address || '-'}
              </div>
            </div>
            <span style={{
              fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
              background: outlet?.isActive ? C.successBg : C.dangerBg,
              color: outlet?.isActive ? C.success : C.danger,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {outlet?.isActive ? 'Aktif' : 'Nonaktif'}
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: outlet?.isActive ? C.success : C.danger, marginLeft: 5, verticalAlign: 'middle' }} />
            </span>
          </div>

          {/* ── Balance Tabs ───────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <BalanceTab label="Kas Kasir" active={balanceTab === 'kas'} onClick={() => setBalanceTab('kas')} />
            <BalanceTab label="QRIS" active={balanceTab === 'qris'} onClick={() => setBalanceTab('qris')} />
          </div>

          {/* ── Balance Display ────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              marginTop: 12, padding: isMobile ? '12px' : '14px 16px', borderRadius: 14,
              background: 'linear-gradient(145deg, #F8F4FF, #FFFFFF)',
              boxShadow: '6px 6px 14px rgba(110, 46, 120, 0.08), -3px -3px 8px rgba(255, 255, 255, 0.95)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 12,
            }}
          >
            {balanceTab === 'kas' ? (
              <>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 600, color: C.n900 }}>
                    {rp(kas?.currentCash || 0)}
                  </div>
                  {kas?.cashierName && kas?.hasOpenSession && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700, marginTop: 2 }}>
                      Shift aktif oleh {kas.cashierName}
                    </div>
                  )}
                  {!kas?.hasOpenSession && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700, marginTop: 2 }}>
                      Tidak ada shift aktif
                    </div>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('admin_shift', { outletId })}
                  style={{
                    fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.primary,
                    background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
                  }}
                >
                  Lihat Riwayat
                </motion.button>
              </>
            ) : (
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n700 }}>
                  QRIS belum tersedia
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700, marginTop: 2 }}>
                  Fitur QRIS balance akan segera hadir.
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* ── Menu Items ──────────────────────────────────────── */}
        <div style={{ background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)', margin: '12px 16px', borderRadius: 18, padding: '4px 20px', boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, padding: '12px 0 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Info Outlet
          </div>
          <MenuItem
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
            label="Daftar Layanan"
            sub={`Layanan yang tersedia di Outlet ini (${outlet?.serviceCount || 0})`}
            onClick={() => setSectionTab('layanan')}
          />
          <MenuItem
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>}
            label="Daftar Deposit"
            sub="Deposit yang terdapat di Outlet ini"
            onClick={() => navigate('daftar_member')}
          />
          <MenuItem
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /></svg>}
            label="Daftar E-Payment"
            sub="Paket E-Payment"
            onClick={() => { }}
          />
          <MenuItem
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>}
            label="Daftar Tim di Outlet"
            sub={`Daftar kontak semua anggota (${outlet?.teamCount || 0})`}
            onClick={() => setSectionTab('tim')}
          />
        </div>

        {/* ── Section Tabs ────────────────────────────────────── */}
        <div style={{ background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)', margin: '0 16px', borderRadius: 18, boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${C.n100}`, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <SectionTab label="INFORMASI OUTLET" active={sectionTab === 'info'} onClick={() => setSectionTab('info')} />
            <SectionTab label="DAFTAR LAYANAN" active={sectionTab === 'layanan'} onClick={() => setSectionTab('layanan')} />
            <SectionTab label="DAFTAR TIM" active={sectionTab === 'tim'} onClick={() => setSectionTab('tim')} />
          </div>

          <div style={{ padding: 20 }}>
            {/* ── Tab: Info ─────────────────────────────────────── */}
            {sectionTab === 'info' && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                {[
                  ['Kontak', outlet?.phone || '-'],
                  ['Email', outlet?.email || '-'],
                  ['Kode Outlet', outlet?.outletCode || '-'],
                  ['NPWP', outlet?.npwp || '-'],
                  ['Terdaftar sejak', fmtDate(outlet?.createdAt)],
                  ['Status outlet', outlet?.isActive ? 'Aktif' : 'Nonaktif'],
                  ['Jumlah layanan', `${outlet?.serviceCount || 0} layanan aktif`],
                  ['Jumlah anggota', `${outlet?.teamCount || 0} orang`],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700 }}>{label}</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 14, color: C.n900, marginTop: 2 }}>{val}</div>
                  </div>
                ))}

                {/* Kas History Preview */}
                {kas?.recentSessions?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Riwayat Shift Terakhir</div>
                    {kas.recentSessions.slice(0, 3).map((s, idx) => (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.n50}` }}
                      >
                        <div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{s.cashierName}</div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n700 }}>{fmtDt(s.openedAt)}{s.closedAt ? ` → ${fmtDt(s.closedAt)}` : ' (aktif)'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{rp(s.closingCash ?? s.openingCash ?? 0)}</div>
                          {s.cashDiff != null && (
                            <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: Math.abs(s.cashDiff) > 10000 ? C.danger : C.success }}>
                              Selisih: {rp(s.cashDiff)}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Tab: Layanan ──────────────────────────────────── */}
            {sectionTab === 'layanan' && (
              <div>
                {Object.keys(svcByCategory).length === 0 ? (
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n700, textAlign: 'center', padding: 20 }}>
                    Belum ada layanan di outlet ini.
                  </div>
                ) : (
                  Object.entries(svcByCategory).map(([cat, items]) => (
                    <div key={cat} style={{ marginBottom: 20 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.primary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {cat}
                      </div>
                      {items.map((s, idx) => (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.n50}` }}
                        >
                          <div>
                            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{s.name}</div>
                            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700 }}>
                              {s.unit}{s.expressExtra > 0 ? ` · Express +${rp(s.expressExtra)}` : ''}
                            </div>
                          </div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.primary }}>
                            {rp(s.price)}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Tab: Tim ─────────────────────────────────────── */}
            {sectionTab === 'tim' && (
              <div>
                {team.length === 0 ? (
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n700, textAlign: 'center', padding: 20 }}>
                    Belum ada anggota di outlet ini.
                  </div>
                ) : (
                  Object.entries(teamByRole).map(([role, members]) => (
                    <div key={role} style={{ marginBottom: 20 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.primary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {role} ({members.length})
                      </div>
                      {members.map((u, idx) => (
                        <motion.div
                          key={u.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.n50}` }}
                        >
                          <ProfileAvatar user={u} size={38} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{u.name}</div>
                            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700 }}>
                              {u.phone || u.email || u.username || '-'}
                            </div>
                          </div>
                          <span style={{
                            fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, padding: '3px 8px',
                            borderRadius: 999, background: u.isActive ? C.successBg : C.dangerBg,
                            color: u.isActive ? C.success : C.danger,
                          }}>
                            {u.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom spacer */}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}
