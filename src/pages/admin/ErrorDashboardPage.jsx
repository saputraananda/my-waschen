// ─────────────────────────────────────────────────────────────────────────────
// ErrorDashboardPage.jsx — Error Tracking Dashboard
// Phase 8: Technical Debt & Optimization
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { TopBar, Btn, Chip, Select } from '../../components/ui';
// import { Pagination } from '../../components/ui'; // TODO: Add Pagination component
import { alertError, alertSuccess } from '../../utils/alert';
import { useResponsive } from '../../utils/hooks';

const F = { fontFamily: 'Poppins' };

// ─── Severity Badge ────────────────────────────────────────────────────────────
const SeverityBadge = ({ severity }) => {
  const config = {
    critical: { color: C.danger, bg: C.dangerBg, label: 'Critical' },
    high: { color: C.warningDark, bg: C.warningBg, label: 'High' },
    medium: { color: C.warning, bg: C.warningBg, label: 'Medium' },
    low: { color: C.success, bg: C.successBg, label: 'Low' },
  };
  const { color, bg, label } = config[severity] || config.medium;

  return (
    <span style={{
      ...F, fontSize: 10, fontWeight: 600,
      padding: '3px 8px', borderRadius: 6,
      background: bg, color, letterSpacing: 0.2,
    }}>
      {label}
    </span>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const config = {
    new: { color: C.primary, bg: C.primary + '20', label: 'New' },
    reviewed: { color: C.warning, bg: C.warningBg, label: 'Reviewed' },
    resolved: { color: C.success, bg: C.successBg, label: 'Resolved' },
    ignored: { color: C.n500, bg: C.n100, label: 'Ignored' },
  };
  const { color, bg, label } = config[status] || config.new;

  return (
    <span style={{
      ...F, fontSize: 10, fontWeight: 600,
      padding: '3px 8px', borderRadius: 6,
      background: bg, color, letterSpacing: 0.2,
    }}>
      {label}
    </span>
  );
};

// ─── Stats Cards ──────────────────────────────────────────────────────────────
const StatsCard = ({ title, value, color = C.n900, bg }) => (
  <div style={{
    background: bg || C.white, padding: '14px 16px', borderRadius: 12,
    boxShadow: SHADOW.sm, textAlign: 'center', flex: 1,
  }}>
    <div style={{ ...F, fontSize: 28, fontWeight: 700, color, lineHeight: 1.1 }}>
      {value}
    </div>
    <div style={{ ...F, fontSize: 11, color: C.n500, fontWeight: 600, marginTop: 4 }}>
      {title}
    </div>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────
export function ErrorDashboardPageContent({ navigate, goBack }) {
  const { isMobile } = useResponsive();
  const [errors, setErrors] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // Filters
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  // Modal state
  const [selectedError, setSelectedError] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');

  // ─── Fetch Stats ─────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get('/api/errors/stats');
      if (res?.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
    }
  }, []);

  // ─── Fetch Errors ────────────────────────────────────────────────────────
  const fetchErrors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', pagination.page);
      params.set('limit', pagination.limit);
      if (severity) params.set('severity', severity);
      if (status) params.set('status', status);
      if (search) params.set('search', search);

      const res = await axios.get(`/api/errors?${params.toString()}`);
      if (res?.data?.success) {
        setErrors(res.data.data);
        setPagination(prev => ({
          ...prev,
          ...res.data.pagination,
        }));
      }
    } catch (err) {
      alertError('Gagal memuat error logs');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, severity, status, search]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  // ─── Handle Actions ────────────────────────────────────────────────────
  const handleViewDetail = (error) => {
    setSelectedError(error);
    setShowDetail(true);
  };

  const handleResolve = async () => {
    if (!selectedError) return;

    try {
      const res = await axios.patch(`/api/errors/${selectedError.id}/resolve`, {
        resolutionNotes: resolveNotes,
      });

      if (res?.data?.success) {
        alertSuccess('Error berhasil ditandai resolved');
        setShowDetail(false);
        setSelectedError(null);
        setResolveNotes('');
        fetchErrors();
        fetchStats();
      }
    } catch (err) {
      alertError('Gagal update error');
    }
  };

  const handleStatusChange = async (errorId, newStatus) => {
    try {
      await axios.patch(`/api/errors/${errorId}`, { status: newStatus });
      alertSuccess(`Status diubah ke ${newStatus}`);
      fetchErrors();
      fetchStats();
    } catch (err) {
      alertError('Gagal update status');
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="🔍 Error Dashboard"
        subtitle="Pantau dan kelola error aplikasi"
        onBack={goBack}
      />

      {/* Stats Summary */}
      {stats && (
        <div style={{
          display: 'flex', gap: 10, padding: 16, overflowX: 'auto',
          background: C.white, borderBottom: `1px solid ${C.n200}`,
        }}>
          <div style={{ flexShrink: 0, minWidth: 100 }}>
            <StatsCard
              title="TODAY"
              value={stats.today?.total || 0}
              bg={C.n50}
            />
          </div>
          <div style={{ flexShrink: 0, minWidth: 100 }}>
            <StatsCard
              title="UNRESOLVED"
              value={stats.unresolved || 0}
              color={stats.unresolved > 0 ? C.danger : C.success}
              bg={stats.unresolved > 0 ? C.dangerBg : C.successBg}
            />
          </div>
          <div style={{ flexShrink: 0, minWidth: 100 }}>
            <StatsCard
              title="7-DAY TREND"
              value={stats.trend7Days?.reduce((sum, d) => sum + d.count, 0) || 0}
              color={C.primary}
              bg={C.primary + '15'}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 10, padding: '12px 16px',
        background: C.white, borderBottom: `1px solid ${C.n200}`,
        flexWrap: 'wrap',
        overflowX: 'auto',
      }}>
        <select
          value={severity}
          onChange={(e) => { setSeverity(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
          style={{
            ...F, fontSize: 12, padding: '8px 12px', borderRadius: 8,
            border: `1px solid ${C.n300}`, outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="">Semua Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
          style={{
            ...F, fontSize: 12, padding: '8px 12px', borderRadius: 8,
            border: `1px solid ${C.n300}`, outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="">Semua Status</option>
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="resolved">Resolved</option>
          <option value="ignored">Ignored</option>
        </select>

        <input
          type="text"
          placeholder="Cari error..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
          style={{
            ...F, fontSize: 12, padding: '8px 12px', borderRadius: 8,
            border: `1px solid ${C.n300}`, outline: 'none', flex: 1, minWidth: 150,
          }}
        />
      </div>

      {/* Error List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, overflowX: 'hidden' }}>
        {loading ? (
          <div style={{ ...F, fontSize: 13, color: C.n500, textAlign: 'center', padding: 40 }}>
            Memuat...
          </div>
        ) : errors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ ...F, fontSize: 14, color: C.n700 }}>
              Tidak ada error yang ditemukan
            </div>
          </div>
        ) : (
          errors.map((error) => (
            <div
              key={error.id}
              style={{
                background: C.white, borderRadius: 12, padding: 14, marginBottom: 10,
                boxShadow: SHADOW.sm, border: `1px solid ${C.n200}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => handleViewDetail(error)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...F, fontSize: 12, fontWeight: 600, color: C.n900, marginBottom: 2 }}>
                    {error.errorMessage?.substring(0, 80)}
                    {(error.errorMessage?.length || 0) > 80 ? '...' : ''}
                  </div>
                  <div style={{ ...F, fontSize: 10, color: C.n500 }}>
                    {error.errorType} • {error.endpoint || '-'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <SeverityBadge severity={error.severity} />
                  <StatusBadge status={error.status} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ ...F, fontSize: 10, color: C.n500 }}>
                  {error.occurredAt ? new Date(error.occurredAt).toLocaleString('id-ID') : '-'}
                  {error.userId && ` • User #${error.userId}`}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {error.status === 'new' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(error.id, 'reviewed'); }}
                      style={{
                        ...F, fontSize: 10, padding: '4px 10px', borderRadius: 6,
                        border: 'none', background: C.n100, color: C.n700, cursor: 'pointer',
                      }}
                    >
                      Mark Reviewed
                    </button>
                  )}
                  {error.status === 'reviewed' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(error.id, 'resolved'); }}
                      style={{
                        ...F, fontSize: 10, padding: '4px 10px', borderRadius: 6,
                        border: 'none', background: C.success + '20', color: C.success, cursor: 'pointer',
                      }}
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 8, padding: 12,
          background: C.white, borderTop: `1px solid ${C.n200}`,
        }}>
          <button
            onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
            disabled={pagination.page <= 1}
            style={{
              ...F, fontSize: 12, padding: '6px 12px', borderRadius: 8,
              border: `1px solid ${C.n300}`, background: C.white,
              cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
              opacity: pagination.page <= 1 ? 0.5 : 1,
            }}
          >
            ←
          </button>
          <span style={{ ...F, fontSize: 12, color: C.n700, display: 'flex', alignItems: 'center' }}>
            Page {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
            disabled={pagination.page >= pagination.totalPages}
            style={{
              ...F, fontSize: 12, padding: '6px 12px', borderRadius: 8,
              border: `1px solid ${C.n300}`, background: C.white,
              cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
              opacity: pagination.page >= pagination.totalPages ? 0.5 : 1,
            }}
          >
            →
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selectedError && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 500, padding: 20,
        }} onClick={() => setShowDetail(false)}>
          <div style={{
            background: C.white, borderRadius: 16, padding: 20, maxWidth: 600,
            width: '100%', maxHeight: '80vh', overflowY: 'auto',
            margin: isMobile ? 12 : 20,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ ...F, fontSize: 16, fontWeight: 700, color: C.n900, margin: 0 }}>
                Error Detail
              </h3>
              <button onClick={() => setShowDetail(false)} style={{
                border: 'none', background: 'none', fontSize: 20, cursor: 'pointer',
              }}>×</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <SeverityBadge severity={selectedError.severity} />
              <StatusBadge status={selectedError.status} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ ...F, fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4 }}>Error Type</div>
              <div style={{ ...F, fontSize: 13, color: C.n800 }}>{selectedError.errorType}</div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ ...F, fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4 }}>Message</div>
              <div style={{
                ...F, fontSize: 12, color: C.n800, background: C.n50, padding: 10,
                borderRadius: 8, wordBreak: 'break-word',
              }}>
                {selectedError.errorMessage}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ ...F, fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4 }}>Endpoint</div>
              <div style={{ ...F, fontSize: 12, color: C.n800 }}>
                {selectedError.method || '-'} {selectedError.endpoint || '-'}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ ...F, fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4 }}>Stack Trace</div>
              <pre style={{
                ...F, fontSize: 11, background: C.n800, color: C.white,
                padding: 12, borderRadius: 8, overflow: 'auto', maxHeight: 200,
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>
                {selectedError.stackTrace || 'No stack trace available'}
              </pre>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ ...F, fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4 }}>Timestamp</div>
              <div style={{ ...F, fontSize: 12, color: C.n800 }}>
                {selectedError.occurredAt ? new Date(selectedError.occurredAt).toLocaleString('id-ID') : '-'}
              </div>
            </div>

            {selectedError.status !== 'resolved' && (
              <div style={{ marginTop: 16 }}>
                <div style={{ ...F, fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 6 }}>
                  Resolution Notes
                </div>
                <textarea
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="Catatan resolution..."
                  rows={3}
                  style={{
                    ...F, fontSize: 12, width: '100%', padding: 10,
                    border: `1px solid ${C.n300}`, borderRadius: 8, outline: 'none',
                    resize: 'vertical',
                  }}
                />
                <button
                  onClick={handleResolve}
                  style={{
                    ...F, fontSize: 13, fontWeight: 600, marginTop: 10,
                    padding: '10px 20px', borderRadius: 10, border: 'none',
                    background: C.success, color: 'white', cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  ✓ Mark as Resolved
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ErrorDashboardPageContent;
