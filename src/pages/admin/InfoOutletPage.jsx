import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Chip } from '../../components/ui';

const ROLE_LABEL = {
  kasir: 'Kasir',
  admin: 'Admin',
  produksi: 'Produksi',
  finance: 'Finance',
  delivery: 'Delivery',
  owner: 'Owner',
  superadmin: 'Super Admin',
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

// ── Balance Tab Button ──────────────────────────────────────────────────────
const BalanceTab = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1,
      padding: '10px 0',
      fontFamily: 'Poppins',
      fontSize: 13,
      fontWeight: active ? 700 : 500,
      color: active ? 'white' : C.n700,
      background: active ? C.primary : 'transparent',
      border: `1.5px solid ${active ? C.primary : C.n200}`,
      borderRadius: 10,
      cursor: 'pointer',
      transition: 'all 0.2s',
    }}
  >
    {label}
  </button>
);

// ── Menu Item Row ────────────────────────────────────────────────────────────
const MenuItem = ({ icon, label, sub, onClick }) => (
  <button
    onClick={onClick}
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
    <div style={{ width: 36, height: 36, borderRadius: 10, background: C.n50, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n600, flexShrink: 0 }}>
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{label}</div>
      {sub && <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 1 }}>{sub}</div>}
    </div>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
  </button>
);

// ── Section Tab ──────────────────────────────────────────────────────────────
const SectionTab = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '10px 16px',
      fontFamily: 'Poppins',
      fontSize: 12,
      fontWeight: active ? 700 : 500,
      color: active ? C.primary : C.n600,
      background: 'none',
      border: 'none',
      borderBottom: active ? `2.5px solid ${C.primary}` : '2.5px solid transparent',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </button>
);

// ═════════════════════════════════════════════════════════════════════════════
export default function InfoOutletPage({ navigate, goBack, screenParams }) {
  const outletId = screenParams?.outletId;

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
    } catch (err) {
      console.error('[InfoOutletPage] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (!outletId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 14, color: C.n600 }}>Outlet ID tidak ditemukan.</div>
        <Btn variant="primary" onClick={() => navigate('dashboard')}>Kembali</Btn>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50 }}>
        <TopBar title="Info Outlet" onBack={goBack} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${C.n200}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Info Outlet" onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* ── Header ──────────────────────────────────────────── */}
        <div style={{ padding: '20px 20px 16px', background: C.white }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: C.n900, lineHeight: 1.3 }}>
                {outlet?.name || 'Outlet'}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 4, lineHeight: 1.5 }}>
                {outlet?.address || '-'}
              </div>
            </div>
            <span style={{
              fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
              background: outlet?.isActive ? '#DCFCE7' : '#FEE2E2',
              color: outlet?.isActive ? '#166534' : '#991B1B',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {outlet?.isActive ? 'Aktif' : 'Nonaktif'}
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: outlet?.isActive ? '#166534' : '#991B1B', marginLeft: 5, verticalAlign: 'middle' }} />
            </span>
          </div>

          {/* ── Balance Tabs ───────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <BalanceTab label="Kas Kasir" active={balanceTab === 'kas'} onClick={() => setBalanceTab('kas')} />
            <BalanceTab label="QRIS" active={balanceTab === 'qris'} onClick={() => setBalanceTab('qris')} />
          </div>

          {/* ── Balance Display ────────────────────────────────── */}
          <div style={{
            marginTop: 12, padding: '14px 16px', borderRadius: 12,
            border: `1.5px solid ${C.n200}`, background: C.n50,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            {balanceTab === 'kas' ? (
              <>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 700, color: C.n900 }}>
                    {rp(kas?.currentCash || 0)}
                  </div>
                  {kas?.cashierName && kas?.hasOpenSession && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 2 }}>
                      Shift aktif oleh {kas.cashierName}
                    </div>
                  )}
                  {!kas?.hasOpenSession && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 2 }}>
                      Tidak ada shift aktif
                    </div>
                  )}
                </div>
                <button
                  onClick={() => navigate('admin_shift', { outletId })}
                  style={{
                    fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.primary,
                    background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
                  }}
                >
                  Lihat Riwayat
                </button>
              </>
            ) : (
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n600 }}>
                  QRIS belum tersedia
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 2 }}>
                  Fitur QRIS balance akan segera hadir.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Menu Items ──────────────────────────────────────── */}
        <div style={{ background: C.white, marginTop: 8, padding: '4px 20px' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n500, padding: '12px 0 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
            onClick={() => {}}
          />
          <MenuItem
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>}
            label="Daftar Tim di Outlet"
            sub={`Daftar kontak semua anggota (${outlet?.teamCount || 0})`}
            onClick={() => setSectionTab('tim')}
          />
        </div>

        {/* ── Section Tabs ────────────────────────────────────── */}
        <div style={{ background: C.white, marginTop: 8 }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${C.n100}`, overflowX: 'auto' }}>
            <SectionTab label="INFORMASI OUTLET" active={sectionTab === 'info'} onClick={() => setSectionTab('info')} />
            <SectionTab label="DAFTAR LAYANAN" active={sectionTab === 'layanan'} onClick={() => setSectionTab('layanan')} />
            <SectionTab label="DAFTAR TIM" active={sectionTab === 'tim'} onClick={() => setSectionTab('tim')} />
          </div>

          <div style={{ padding: 20 }}>
            {/* ── Tab: Info ─────────────────────────────────────── */}
            {sectionTab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n500 }}>{label}</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 14, color: C.n900, marginTop: 2 }}>{val}</div>
                  </div>
                ))}

                {/* Kas History Preview */}
                {kas?.recentSessions?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n500, marginBottom: 8 }}>Riwayat Shift Terakhir</div>
                    {kas.recentSessions.slice(0, 3).map((s) => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.n50}` }}>
                        <div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{s.cashierName}</div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>{fmtDt(s.openedAt)}{s.closedAt ? ` → ${fmtDt(s.closedAt)}` : ' (aktif)'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{rp(s.closingCash ?? s.openingCash ?? 0)}</div>
                          {s.cashDiff != null && (
                            <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: Math.abs(s.cashDiff) > 10000 ? C.danger : C.success }}>
                              Selisih: {rp(s.cashDiff)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Layanan ──────────────────────────────────── */}
            {sectionTab === 'layanan' && (
              <div>
                {Object.keys(svcByCategory).length === 0 ? (
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500, textAlign: 'center', padding: 20 }}>
                    Belum ada layanan di outlet ini.
                  </div>
                ) : (
                  Object.entries(svcByCategory).map(([cat, items]) => (
                    <div key={cat} style={{ marginBottom: 20 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {cat}
                      </div>
                      {items.map((s) => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.n50}` }}>
                          <div>
                            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{s.name}</div>
                            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>
                              {s.unit}{s.expressExtra > 0 ? ` · Express +${rp(s.expressExtra)}` : ''}
                            </div>
                          </div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary }}>
                            {rp(s.price)}
                          </div>
                        </div>
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
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500, textAlign: 'center', padding: 20 }}>
                    Belum ada anggota di outlet ini.
                  </div>
                ) : (
                  Object.entries(teamByRole).map(([role, members]) => (
                    <div key={role} style={{ marginBottom: 20 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {role} ({members.length})
                      </div>
                      {members.map((u) => (
                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.n50}` }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 19, background: `${C.primary}15`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary, flexShrink: 0,
                          }}>
                            {u.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{u.name}</div>
                            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>
                              {u.phone || u.email || u.username || '-'}
                            </div>
                          </div>
                          <span style={{
                            fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, padding: '3px 8px',
                            borderRadius: 999, background: u.isActive ? '#DCFCE7' : '#FEE2E2',
                            color: u.isActive ? '#166534' : '#991B1B',
                          }}>
                            {u.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
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
