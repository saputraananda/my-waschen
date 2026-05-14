import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Chip, Avatar, SearchBar, Modal } from '../../components/ui';
import OutletDropdown from '../../components/ui/OutletDropdown';

export default function VerifikasiPaymentPage({ navigate, goBack }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [outletId, setOutletId] = useState('');
  const [outlets, setOutlets] = useState([]);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);

  // Fetch outlets for filter
  useEffect(() => {
    const fetchOutlets = async () => {
      try {
        const res = await axios.get('/api/finance/stats');
        if (res?.data?.data?.outlets) setOutlets(res.data.data.outlets);
      } catch { /* ignore */ }
    };
    fetchOutlets();
  }, []);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/finance/payments?status=${filter}`;
      if (outletId) url += `&outletId=${outletId}`;
      const res = await axios.get(url);
      setPayments(res?.data?.data || []);
    } catch (err) {
      console.error('[VerifikasiPayment] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, outletId]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const handleVerify = async (id) => {
    setActionLoading(id);
    setConfirmModal(null);
    try {
      await axios.patch(`/api/finance/payments/${id}/verify`);
      setPayments((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('[VerifikasiPayment] verify error:', err);
      alert(err?.response?.data?.message || 'Gagal memverifikasi pembayaran');
    } finally {
      setActionLoading(null);
    }
  };

  const METHOD_LABEL = { transfer: '🏦 Transfer', qris: '📱 QRIS' };
  const METHOD_COLOR = { transfer: '#2563EB', qris: '#7C3AED' };

  // Filter by search
  const filtered = payments.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.customerName || '').toLowerCase().includes(q) ||
      (p.transactionNo || '').toLowerCase().includes(q) ||
      (p.cashierName || '').toLowerCase().includes(q)
    );
  });

  const pendingCount = filter === 'pending' ? filtered.length : 0;
  const totalPending = filter === 'pending' ? filtered.reduce((s, p) => s + (p.total || 0), 0) : 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Verifikasi Pembayaran"
        subtitle={filter === 'pending' ? `${pendingCount} menunggu · ${rp(totalPending)}` : `${filtered.length} data`}
        onBack={goBack}
      />

      {/* Filters */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Chip label={`Belum ✋`} active={filter === 'pending'} onClick={() => setFilter('pending')} />
          <Chip label={`Verified ✅`} active={filter === 'verified'} onClick={() => setFilter('verified')} />
          <Chip label="Semua" active={filter === 'all'} onClick={() => setFilter('all')} />
        </div>

        {/* Outlet filter */}
        {outlets.length > 1 && (
          <OutletDropdown value={outletId} onChange={setOutletId} outlets={outlets} />
        )}

        <SearchBar value={search} onChange={setSearch} placeholder="Cari nota / customer..." />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ background: C.white, borderRadius: 14, padding: 14, height: 90, animation: 'pulse 1.5s infinite', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12 }}>
            <div style={{ width: 80, height: 80, borderRadius: 40, background: filter === 'pending' ? '#DCFCE7' : C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 36 }}>{filter === 'pending' ? '✅' : '📋'}</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: C.n900, textAlign: 'center' }}>
              {filter === 'pending' ? 'Semua pembayaran sudah terverifikasi!' : 'Belum ada data'}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, textAlign: 'center' }}>
              {filter === 'pending' ? 'Tidak ada pembayaran transfer/QRIS yang menunggu verifikasi' : 'Belum ada riwayat verifikasi pembayaran'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((p) => {
              const methodColor = METHOD_COLOR[p.payMethod] || C.primary;
              return (
                <div
                  key={p.id}
                  style={{
                    background: C.white, borderRadius: 14, padding: '12px 14px',
                    boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
                    borderLeft: `3px solid ${p.verified ? C.success : methodColor}`,
                    transition: 'transform 0.15s',
                  }}
                >
                  {/* Top row — customer + amount */}
                  <div
                    onClick={() => setDetailModal(p)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}
                  >
                    <Avatar initials={p.customerName?.split(' ').map((w) => w[0]).join('').slice(0, 2) || '??'} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.customerName}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {p.transactionNo}
                        <span style={{ background: `${methodColor}15`, color: methodColor, fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>
                          {METHOD_LABEL[p.payMethod] || p.payMethod}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.primary }}>{rp(p.total)}</div>
                    </div>
                  </div>

                  {/* Bottom row — meta + action */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${C.n100}` }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, lineHeight: 1.5 }}>
                      {p.outletName && <span>{p.outletName} · </span>}
                      {p.cashierName && <span>{p.cashierName} · </span>}
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </div>

                    {!p.verified ? (
                      <Btn
                        variant="success"
                        size="sm"
                        loading={actionLoading === p.id}
                        onClick={() => setConfirmModal(p)}
                        style={{ padding: '0 14px', height: 30, fontSize: 11 }}
                      >
                        ✓ Verifikasi
                      </Btn>
                    ) : (
                      <span style={{
                        fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                        color: C.success, background: '#DCFCE7',
                        padding: '3px 10px', borderRadius: 999,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}>
                        ✓ {p.verifiedByName || 'Verified'}
                        {p.verifiedAt && (
                          <span style={{ fontWeight: 400, color: '#166534' }}>
                            · {new Date(p.verifiedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Confirm Verification Modal ────────────────────────────── */}
      <Modal
        visible={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title="Konfirmasi Verifikasi"
      >
        {confirmModal && (
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600, marginBottom: 16, lineHeight: 1.6 }}>
              Apakah Anda yakin ingin memverifikasi pembayaran ini?
            </div>
            <div style={{ background: C.n50, borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Nota</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{confirmModal.transactionNo}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Customer</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{confirmModal.customerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Metode</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{METHOD_LABEL[confirmModal.payMethod] || confirmModal.payMethod}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Total</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.primary }}>{rp(confirmModal.total)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="secondary" fullWidth onClick={() => setConfirmModal(null)}>Batal</Btn>
              <Btn variant="success" fullWidth loading={actionLoading === confirmModal.id} onClick={() => handleVerify(confirmModal.id)}>Verifikasi</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Detail Modal ──────────────────────────────────────────── */}
      <Modal
        visible={!!detailModal}
        onClose={() => setDetailModal(null)}
        title="Detail Pembayaran"
      >
        {detailModal && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Avatar initials={detailModal.customerName?.split(' ').map((w) => w[0]).join('').slice(0, 2) || '??'} size={44} />
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: C.n900 }}>{detailModal.customerName}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{detailModal.customerPhone}</div>
              </div>
            </div>
            <div style={{ background: C.n50, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              {[
                ['Nota', detailModal.transactionNo],
                ['Outlet', detailModal.outletName || '-'],
                ['Kasir', detailModal.cashierName || '-'],
                ['Metode', METHOD_LABEL[detailModal.payMethod] || detailModal.payMethod],
                ['Tanggal', detailModal.createdAt ? new Date(detailModal.createdAt).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'],
                ['Total', rp(detailModal.total)],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.n100}` }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>{label}</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: label === 'Total' ? C.primary : C.n900 }}>{val}</span>
                </div>
              ))}
              {detailModal.verified && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: '#DCFCE7', borderRadius: 8 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#166534' }}>
                    ✓ Diverifikasi oleh {detailModal.verifiedByName || '-'}
                  </div>
                  {detailModal.verifiedAt && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#166534', marginTop: 2 }}>
                      {new Date(detailModal.verifiedAt).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <Btn variant="secondary" fullWidth onClick={() => setDetailModal(null)}>Tutup</Btn>
          </div>
        )}
      </Modal>
    </div>
  );
}
