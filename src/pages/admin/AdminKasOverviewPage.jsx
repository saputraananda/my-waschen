// ─────────────────────────────────────────────────────────────────────────────
// AdminKasOverviewPage — admin dashboard semua outlet kas operasional
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useIsMobile, useResponsive, useWindowSize } from '../../utils/hooks';
import { TopBar, Btn, useAppRefresh } from '../../components/ui';
import { alertError, alertSuccess } from '../../utils/alert';
import { getAllBalances, getCashSummary, topupCash, reconcileBalance, getCashConfig, exportCashCsv } from '../../utils/outletCashApi';
import { CATEGORY_META, TOPUP_SOURCE_META } from '../../utils/outletCashApi';

const fmtDate = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return '-'; }
};

export default function AdminKasOverviewPage({ goBack, navigate }) {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Topup modal
  const [showTopup, setShowTopup] = useState(false);
  const [topupForm, setTopupForm] = useState({ outletId: null, amount: '', source: 'transfer', picName: '', proofPhotoUrl: '', notes: '', referenceNo: '' });
  const [topupLoading, setTopupLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => { getCashConfig().then(setConfig).catch(() => {}); }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllBalances();
      setBalances(data);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAppRefresh(() => fetchData(), [fetchData]);

  const minBalance = config?.minBalance || 2_000_000;
  const totalBalance = balances.reduce((sum, b) => sum + Number(b.balance || 0), 0);
  const lowCount = balances.filter(b => Number(b.balance || 0) < minBalance).length;

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alertError('Ukuran file maksimal 5MB'); return; }
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'proof');
      const res = await axios.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res?.data?.url) {
        setTopupForm(f => ({ ...f, proofPhotoUrl: res.data.url }));
      } else throw new Error('No URL');
    } catch (err) {
      alertError('Gagal upload foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleTopup = async () => {
    const numAmount = Number(String(topupForm.amount).replace(/\D/g, '')) || 0;
    if (numAmount <= 0) { alertError('Nominal harus > 0'); return; }
    if (!topupForm.picName.trim()) { alertError('Nama PIC wajib'); return; }
    if (!topupForm.proofPhotoUrl.trim()) { alertError('Bukti foto wajib'); return; }

    setTopupLoading(true);
    try {
      await topupCash({
        outletId: topupForm.outletId,
        amount: numAmount,
        source: topupForm.source,
        picName: topupForm.picName.trim(),
        proofPhotoUrl: topupForm.proofPhotoUrl.trim(),
        notes: topupForm.notes.trim() || undefined,
        referenceNo: topupForm.referenceNo.trim() || undefined,
      });
      alertSuccess(`Top-up ${rp(numAmount)} berhasil!`);
      setShowTopup(false);
      setTopupForm({ outletId: null, amount: '', source: 'transfer', picName: '', proofPhotoUrl: '', notes: '', referenceNo: '' });
      fetchData();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal top-up');
    } finally {
      setTopupLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      await exportCashCsv({});
      alertSuccess('CSV berhasil diunduh.');
    } catch (err) {
      alertError('Gagal export CSV.');
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <style>{`
        @media (max-width: 480px) {
          .kas-overview-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .kas-overview-card { flex-direction: column !important; gap: 10px !important; }
          .kas-modal-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <TopBar title="Kas Semua Outlet" subtitle="Overview saldo kas operasional" onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }} className="kas-overview-stats">
          <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', boxShadow: SHADOW.sm, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.n600, letterSpacing: 0.3 }}>TOTAL SALDO</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: C.success, marginTop: 4 }}>{rp(totalBalance)}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 2 }}>{balances.length} outlet</div>
          </div>
          <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', boxShadow: SHADOW.sm, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.n600, letterSpacing: 0.3 }}>MINIMUM</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.primary, marginTop: 4 }}>{rp(minBalance)}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 2 }}>batas per outlet</div>
          </div>
          <div style={{ background: lowCount > 0 ? C.warningBg : 'white', borderRadius: 14, padding: '14px 16px', boxShadow: SHADOW.sm, textAlign: 'center', border: lowCount > 0 ? `1.5px solid ${C.warning}` : 'none' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.n600, letterSpacing: 0.3 }}>SALDO RENDAH</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 800, color: lowCount > 0 ? C.warningDark : C.success, marginTop: 4 }}>{lowCount}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 2 }}>outlet</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Btn variant="primary" onClick={handleExport} style={{ flex: 1 }} size="sm">📥 Export CSV</Btn>
          <Btn variant="secondary" onClick={() => navigate('kas_approval')} style={{ flex: 1 }} size="sm">📋 Approval</Btn>
        </div>

        {/* Outlet cards */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Memuat…</div>
        )}

        {!loading && balances.map(b => {
          const bal = Number(b.balance || 0);
          const isLow = bal < minBalance;
          return (
            <div key={b.outletId} style={{
              background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 10,
              boxShadow: SHADOW.sm,
              borderLeft: `4px solid ${isLow ? C.warning : C.success}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>
                      {b.outletName}
                    </span>
                    {isLow && (
                      <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: C.warningBg, color: C.warningDark }}>
                        ⚠️ Rendah
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 2 }}>
                    {b.last_topup_at && `Top-up: ${fmtDate(b.last_topup_at)}`}
                    {b.last_expense_at && ` · Expense: ${fmtDate(b.last_expense_at)}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: isLow ? C.warningDark : C.success }}>
                    {rp(bal)}
                  </div>
                  <button
                    onClick={() => {
                      setTopupForm(f => ({ ...f, outletId: b.outletId }));
                      setShowTopup(true);
                    }}
                    style={{
                      marginTop: 4, padding: '4px 12px', borderRadius: 8,
                      border: `1.5px solid ${C.primary}`, background: 'white',
                      color: C.primary, fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >📥 Top-up</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Topup Modal */}
      {showTopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: '24px 20px', maxWidth: 400, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900, marginBottom: 16 }}>Top-up Kas Outlet</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Nominal (Rp) *</div>
              <input
                type="text"
                value={topupForm.amount}
                onChange={(e) => setTopupForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="500.000"
                style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Nama PIC *</div>
              <input
                type="text"
                value={topupForm.picName}
                onChange={(e) => setTopupForm(f => ({ ...f, picName: e.target.value }))}
                placeholder="Nama PIC"
                style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Sumber Dana</div>
              <select
                value={topupForm.source}
                onChange={(e) => setTopupForm(f => ({ ...f, source: e.target.value }))}
                style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', boxSizing: 'border-box' }}
              >
                {Object.entries(TOPUP_SOURCE_META).map(([k, m]) => (
                  <option key={k} value={k}>{m.icon} {m.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>No. Referensi (opsional)</div>
              <input
                type="text"
                value={topupForm.referenceNo}
                onChange={(e) => setTopupForm(f => ({ ...f, referenceNo: e.target.value }))}
                placeholder="No transfer"
                style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Bukti Foto Transfer *</div>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} style={{ display: 'none' }} id="admin-topup-proof" />
              <label htmlFor="admin-topup-proof" style={{
                display: 'block', padding: '12px 16px', background: C.n50,
                border: `1.5px dashed ${C.n300}`, borderRadius: 12,
                cursor: uploadingPhoto ? 'not-allowed' : 'pointer', textAlign: 'center',
                fontFamily: 'Poppins', fontSize: 12, color: C.n600,
              }}>
                {uploadingPhoto ? '⏳ Mengunggah...' : topupForm.proofPhotoUrl ? '✅ Foto terupload — Klik ganti' : '📷 Upload foto'}
              </label>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Catatan (opsional)</div>
              <textarea
                value={topupForm.notes}
                onChange={(e) => setTopupForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Catatan"
                style={{ width: '100%', borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13, padding: 10, boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" onClick={() => setShowTopup(false)} style={{ flex: 1 }}>Batal</Btn>
              <Btn
                variant="primary"
                onClick={handleTopup}
                loading={topupLoading}
                disabled={!topupForm.amount || !topupForm.picName.trim() || !topupForm.proofPhotoUrl.trim()}
                style={{ flex: 1 }}
              >Top-up</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
