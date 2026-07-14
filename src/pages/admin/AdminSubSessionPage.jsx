import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C, T, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Badge, SearchBar, EmptyState, SkeletonList } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { alertError } from '../../utils/alert';
import { useResponsive } from '../../utils/hooks';

const F = { fontFamily: 'Poppins' };

const SHIFT_COLORS = {
  pagi: { bg: C.warningBg, color: C.warningDark, border: C.warning },
  siang: { bg: C.warningBg, color: C.warningDark, border: C.warning },
  malam: { bg: C.primaryTint, color: C.primary, border: C.primary },
  full: { bg: C.infoBg, color: C.info, border: C.info },
};

function fmtDt(v) {
  if (!v) return '—';
  try { return new Date(v).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return String(v); }
}

function fmtTime(v) {
  if (!v) return '—';
  try { return new Date(v).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
}

function fmtElapsed(openedAt) {
  if (!openedAt) return '';
  const ms = Date.now() - new Date(openedAt).getTime();
  if (ms < 0) return '';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}

const Card = ({ children, style = {}, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: C.white,
      borderRadius: 14,
      padding: 14,
      boxShadow: SHADOW.sm,
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}
  >
    {children}
  </div>
);

const SubSessionRow = ({ subSession, onClick }) => {
  const colors = SHIFT_COLORS[subSession.shift] || SHIFT_COLORS.full;
  const isOpen = subSession.status === 'open';

  return (
    <Card style={{ marginBottom: 10 }} onClick={onClick}>
      {/* Header: Cashier + Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: `linear-gradient(135deg, ${C.primaryHover}, ${C.primary})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
            color: 'white',
          }}>
            {subSession.cashierName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ ...F, fontSize: 14, fontWeight: 600, color: C.n900 }}>
              {subSession.cashierName || 'Unknown'}
            </div>
            <div style={{ ...F, fontSize: 11, color: C.n600 }}>
              {subSession.outletName || `Outlet #${subSession.outletId}`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{
            background: isOpen ? C.successBg : C.n100,
            color: isOpen ? C.successDark : C.n600,
            border: `1px solid ${isOpen ? C.success : C.n200}`,
            ...F,
            fontSize: 10,
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: 999,
          }}>
            {isOpen ? '● AKTIF' : '✓ TUTUP'}
          </span>
          <span style={{
            background: colors.bg,
            color: colors.color,
            border: `1px solid ${colors.border}`,
            ...F,
            fontSize: 9,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 999,
          }}>
            {subSession.shift?.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div style={{ background: C.infoBg, borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ ...F, fontSize: 9, color: C.n600, marginBottom: 2 }}>Transaksi</div>
          <div style={{ ...F, fontSize: 16, fontWeight: 800, color: C.info }}>
            {subSession.transactionCount || 0}
          </div>
        </div>
        <div style={{ background: C.successBg, borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ ...F, fontSize: 9, color: C.n600, marginBottom: 2 }}>Total Bayar</div>
          <div style={{ ...F, fontSize: 13, fontWeight: 800, color: C.successDark, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {rp(subSession.totalPaid || 0)}
          </div>
        </div>
        <div style={{ background: isOpen ? C.warningBg : C.n100, borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ ...F, fontSize: 9, color: C.n600, marginBottom: 2 }}>Modal</div>
          <div style={{ ...F, fontSize: 13, fontWeight: 800, color: C.warningDark, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {rp(subSession.beginningCash || 0)}
          </div>
        </div>
      </div>

      {/* Variance */}
      {subSession.variance != null && (
        <div style={{
          background: Math.abs(subSession.variance) <= 1000 ? C.successBg : C.dangerBg,
          borderRadius: 10,
          padding: '8px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ ...F, fontSize: 11, color: C.n700 }}>Selisih Kas</span>
          <span style={{
            ...F,
            fontSize: 13,
            fontWeight: 700,
            color: Math.abs(subSession.variance) <= 1000 ? C.successDark : C.dangerDark,
          }}>
            {subSession.variance === 0 ? '✓ Sesuai' : rp(subSession.variance)}
          </span>
        </div>
      )}

      {/* Footer: Time */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.n100}` }}>
        <span style={{ ...F, fontSize: 10, color: C.n600 }}>
          Buka: {fmtTime(subSession.openedAt)}
        </span>
        <span style={{ ...F, fontSize: 10, color: C.n600 }}>
          {isOpen ? `Berlangsung ${fmtElapsed(subSession.openedAt)}` : `Tutup: ${fmtTime(subSession.closedAt)}`}
        </span>
      </div>
    </Card>
  );
};

export default function AdminSubSessionPage({ navigate, goBack }) {
  const { isMobile } = useResponsive();
  const { user } = useApp();
  const [mainSessions, setMainSessions] = useState([]);
  const [selectedMainSession, setSelectedMainSession] = useState(null);
  const [subSessions, setSubSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subSessionsLoading, setSubSessionsLoading] = useState(false);

  const loadMainSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/shifts/sessions?status=open&limit=50');
      const sessions = res?.data?.data || [];
      setMainSessions(sessions);
      // Auto-select first open session
      if (sessions.length > 0 && !selectedMainSession) {
        setSelectedMainSession(sessions[0]);
      }
    } catch (e) {
      // Silent fail - sessions list optional
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSubSessions = useCallback(async (sessionId) => {
    if (!sessionId) {
      setSubSessions([]);
      return;
    }
    setSubSessionsLoading(true);
    try {
      const res = await axios.get(`/api/shifts/sub-session/${sessionId}/all`);
      setSubSessions(res?.data?.data || []);
    } catch (e) {
      // Silent fail - sub-sessions optional
      setSubSessions([]);
    } finally {
      setSubSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMainSessions();
  }, [loadMainSessions]);

  useEffect(() => {
    if (selectedMainSession?.id) {
      loadSubSessions(selectedMainSession.id);
    } else {
      setSubSessions([]);
    }
  }, [selectedMainSession, loadSubSessions]);

  // Calculate summary stats
  const summaryStats = subSessions.length > 0 ? {
    totalTransactions: subSessions.reduce((sum, ss) => sum + (ss.transactionCount || 0), 0),
    totalPaid: subSessions.reduce((sum, ss) => sum + (ss.totalPaid || 0), 0),
    openCount: subSessions.filter(ss => ss.status === 'open').length,
    closedCount: subSessions.filter(ss => ss.status === 'closed').length,
    totalVariance: subSessions.reduce((sum, ss) => sum + (ss.variance || 0), 0),
  } : null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Monitoring Sub-Session"
        subtitle="Pantau aktivitas frontliner per shift"
        onBack={goBack}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Session Selector */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...F, fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>
            Pilih Shift Utama
          </div>
          {loading ? (
            <div style={{ ...F, fontSize: 12, color: C.n600 }}>Memuat...</div>
          ) : mainSessions.length === 0 ? (
            <div style={{ ...F, fontSize: 12, color: C.n600, padding: 16, background: C.white, borderRadius: 12, textAlign: 'center' }}>
              Tidak ada shift aktif saat ini.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {mainSessions.map((s) => {
                const colors = SHIFT_COLORS[s.shift] || SHIFT_COLORS.full;
                const isSelected = selectedMainSession?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedMainSession(s)}
                    style={{
                      flexShrink: 0,
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: `2px solid ${isSelected ? C.primary : C.n200}`,
                      background: isSelected ? `${C.primary}10` : C.white,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        background: colors.bg,
                        color: colors.color,
                        border: `1px solid ${colors.border}`,
                        ...F,
                        fontSize: 9,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 999,
                      }}>
                        {s.shift?.toUpperCase()}
                      </span>
                      <span style={{ ...F, fontSize: 10, color: isSelected ? C.primary : C.n600 }}>
                        {isSelected ? '✓' : ''}
                      </span>
                    </div>
                    <div style={{ ...F, fontSize: 11, fontWeight: 600, color: C.n900 }}>
                      {s.cashierName || 'Admin'}
                    </div>
                    <div style={{ ...F, fontSize: 10, color: C.n600 }}>
                      {fmtTime(s.openedAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {summaryStats && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 16 }}>
            <Card>
              <div style={{ ...F, fontSize: 10, color: C.n600, marginBottom: 4 }}>Total Transaksi</div>
              <div style={{ ...F, fontSize: 20, fontWeight: 800, color: C.n900 }}>{summaryStats.totalTransactions}</div>
              <div style={{ ...F, fontSize: 10, color: C.n600, marginTop: 4 }}>
                {summaryStats.openCount} aktif · {summaryStats.closedCount} tutup
              </div>
            </Card>
            <Card>
              <div style={{ ...F, fontSize: 10, color: C.n600, marginBottom: 4 }}>Total Penjualan</div>
              <div style={{ ...F, fontSize: 16, fontWeight: 800, color: C.successDark }}>{rp(summaryStats.totalPaid)}</div>
              <div style={{
                ...F,
                fontSize: 10,
                fontWeight: 600,
                color: Math.abs(summaryStats.totalVariance) <= 1000 ? C.successDark : C.dangerDark,
                marginTop: 4,
              }}>
                {summaryStats.totalVariance === 0 ? '✓ Kas sesuai' : `Selisih: ${rp(summaryStats.totalVariance)}`}
              </div>
            </Card>
          </div>
        )}

        {/* Sub-Sessions List */}
        <div style={{ ...F, fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 10 }}>
          Sub-Session ({subSessions.length})
        </div>

        {subSessionsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ background: C.white, borderRadius: 14, padding: 14, height: 120, animation: 'pulse 1.5s infinite' }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 18, background: C.n200 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ width: '60%', height: 12, background: C.n200, borderRadius: 6, marginBottom: 6 }} />
                    <div style={{ width: '40%', height: 10, background: C.n200, borderRadius: 6 }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div style={{ height: 50, background: C.n100, borderRadius: 10 }} />
                  <div style={{ height: 50, background: C.n100, borderRadius: 10 }} />
                  <div style={{ height: 50, background: C.n100, borderRadius: 10 }} />
                </div>
              </div>
            ))}
          </div>
        ) : subSessions.length === 0 ? (
          <EmptyState
            icon="👥"
            title="Belum Ada Frontliner"
            subtitle={
              selectedMainSession
                ? 'Belum ada frontliner yang bergabung dengan shift ini.'
                : 'Pilih shift utama untuk melihat sub-session.'
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {subSessions.map((ss) => (
              <SubSessionRow
                key={ss.id}
                subSession={ss}
                onClick={() => {
                  // Navigate to sub-session detail if needed
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
