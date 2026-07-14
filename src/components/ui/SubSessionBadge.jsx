// ─────────────────────────────────────────────────────────────────────────────
// SubSessionBadge.jsx — Individual Frontliner Session Indicator
// Phase 3: Shift Management Enhancement
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, createContext } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { MoneyInput, Btn, Modal } from '.';

const SHIFT_COLORS = {
  pagi: { bg: '#FEF9C3', color: '#854D0E', border: '#FDE047' },
  siang: { bg: '#FEF3C7', color: '#92400E', border: '#FBBF24' },
  malam: { bg: '#EDE9FE', color: '#5B21B6', border: '#A78BFA' },
  full: { bg: '#E0E7FF', color: '#3730A3', border: '#818CF8' },
};

const fmtElapsed = (openedAt) => {
  if (!openedAt) return '';
  const ms = Date.now() - new Date(openedAt).getTime();
  if (ms < 0) return '';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
};

/**
 * SubSessionBadge - Shows current sub-session status in header
 * Props:
 *   - compact: boolean (show minimal info)
 *   - onSubSessionRequired: callback when transaction attempted without sub-session
 */
export const SubSessionBadge = ({ compact = false, onSubSessionRequired }) => {
  const [subSession, setSubSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [mainSessions, setMainSessions] = useState([]);
  const [selectedMainSession, setSelectedMainSession] = useState(null);
  const [beginningCash, setBeginningCash] = useState('');
  const [joining, setJoining] = useState(false);

  const loadSubSession = useCallback(async () => {
    try {
      const res = await axios.get('/api/shifts/sub-session/current');
      setSubSession(res?.data?.data || null);
    } catch (e) {
      // Silent fail - sub-session optional
      setSubSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMainSessions = useCallback(async () => {
    try {
      // Get open sessions at this outlet for joining
      const res = await axios.get('/api/shifts/sessions?status=open&limit=10');
      const sessions = (res?.data?.data || []).filter(s => s.status === 'open');
      setMainSessions(sessions);
    } catch (e) {
      // Silent fail - main sessions optional
      setMainSessions([]);
    }
  }, []);

  useEffect(() => {
    loadSubSession();
  }, [loadSubSession]);

  useEffect(() => {
    if (subSession?.openedAt) {
      const tick = () => setElapsed(fmtElapsed(subSession.openedAt));
      tick();
      const id = setInterval(tick, 30000); // Update every 30s
      return () => clearInterval(id);
    }
  }, [subSession]);

  const handleJoinShift = async () => {
    if (!selectedMainSession) return;
    setJoining(true);
    try {
      const res = await axios.post('/api/shifts/sub-session/open', {
        sessionId: selectedMainSession.id,
        beginningCash: Number(String(beginningCash).replace(/\D/g, '') || 0),
      });
      if (res.data.success) {
        setShowJoinModal(false);
        setBeginningCash('');
        setSelectedMainSession(null);
        await loadSubSession();
      }
    } catch (e) {
      alert(e?.response?.data?.message || 'Gagal bergabung shift.');
    } finally {
      setJoining(false);
    }
  };

  const handleOpenJoinModal = async () => {
    await loadMainSessions();
    // Auto-select first session
    if (mainSessions.length > 0 && !selectedMainSession) {
      setSelectedMainSession(mainSessions[0]);
    }
    setShowJoinModal(true);
  };

  // No sub-session - show warning/join button
  if (!loading && !subSession?.hasActiveSubSession) {
    return (
      <>
        <div
          onClick={handleOpenJoinModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: 999,
            padding: '6px 12px',
            background: '#FEE2E2',
            border: '1.5px solid #FCA5A5',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 3, background: '#EF4444' }} />
          <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#991B1B' }}>
            {compact ? 'Gabung Shift' : 'Belum Gabung Shift'}
          </span>
        </div>

        {/* Join Modal */}
        <Modal
          visible={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          title="Gabung Shift"
        >
          {!subSession?.message?.includes('buka') && mainSessions.length > 0 && (
            <>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#3a3a3a', marginBottom: 12, lineHeight: 1.5 }}>
                Pilih shift utama yang sudah dibuka admin untuk bergabung:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {mainSessions.map((s) => {
                  const colors = SHIFT_COLORS[s.shift] || SHIFT_COLORS.full;
                  const isSelected = selectedMainSession?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedMainSession(s)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: `2px solid ${isSelected ? C.primary : '#E2E8F0'}`,
                        background: isSelected ? `${C.primary}10` : '#FAFAFA',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{
                          background: colors.bg,
                          color: colors.color,
                          border: `1px solid ${colors.border}`,
                          fontFamily: 'Poppins',
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 999,
                        }}>
                          {s.shift?.toUpperCase()}
                        </span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>
                          {s.cashierName || 'Admin'}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#3a3a3a' }}>
                        Outlet: {s.outletName} · Dibuka: {new Date(s.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <MoneyInput
                label="Modal awal laci (Rp)"
                value={beginningCash}
                onChange={setBeginningCash}
                placeholder="0"
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <Btn
                  variant="secondary"
                  onClick={() => setShowJoinModal(false)}
                  style={{ flex: 1 }}
                >
                  Batal
                </Btn>
                <Btn
                  variant="primary"
                  onClick={handleJoinShift}
                  loading={joining}
                  disabled={!selectedMainSession}
                  style={{ flex: 1 }}
                >
                  Gabung Shift
                </Btn>
              </div>
            </>
          )}

          {(!mainSessions || mainSessions.length === 0) && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 8 }}>
                Belum Ada Shift Aktif
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#3a3a3a', lineHeight: 1.6 }}>
                Tidak ada shift utama yang terbuka saat ini.<br />
                Minta admin untuk membuka shift terlebih dahulu.
              </div>
            </div>
          )}
        </Modal>
      </>
    );
  }

  // Has active sub-session - show badge
  const ss = subSession;
  const colors = SHIFT_COLORS[ss.shift] || SHIFT_COLORS.full;

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        padding: '4px 10px',
        background: '#DCFCE7',
        border: '1px solid #86EFAC',
      }}>
        <span style={{ width: 5, height: 5, borderRadius: 2.5, background: '#22C55E', animation: 'pulse 2s infinite' }} />
        <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: '#166534' }}>
          {ss.shift?.toUpperCase()} · {elapsed}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        padding: '6px 12px',
        background: '#DCFCE7',
        border: '1.5px solid #86EFAC',
      }}
      onClick={loadSubSession}
      title="Klik untuk refresh"
    >
      <span style={{ width: 6, height: 6, borderRadius: 3, background: '#22C55E', animation: 'pulse 2s infinite' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          background: colors.bg,
          color: colors.color,
          border: `1px solid ${colors.border}`,
          fontFamily: 'Poppins',
          fontSize: 10,
          fontWeight: 600,
          padding: '2px 6px',
          borderRadius: 999,
        }}>
          {ss.shift?.toUpperCase()}
        </span>
        <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#166534' }}>
          {ss.cashierName || 'Anda'}
        </span>
        <span style={{ fontFamily: 'Poppins', fontSize: 10, color: '#166534', opacity: 0.7 }}>
          · {elapsed}
        </span>
        <span style={{ fontFamily: 'Poppins', fontSize: 10, color: '#166534', opacity: 0.7 }}>
          · {ss.transactionCount || 0} nota
        </span>
      </div>
    </div>
  );
};

/**
 * SubSessionContext - Context for sub-session management across app
 */
export const SubSessionContext = createContext({
  subSession: null,
  refreshSubSession: () => {},
  isLoading: true,
});

export default SubSessionBadge;
