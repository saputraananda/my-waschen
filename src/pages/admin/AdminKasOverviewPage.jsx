// ─────────────────────────────────────────────────────────────────────────────
// AdminKasOverviewPage — admin dashboard semua outlet kas operasional
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useIsMobile, useResponsive, useWindowSize } from '../../utils/hooks';
import { TopBar, Btn, useAppRefresh } from '../../components/ui';
import { alertError, alertSuccess } from '../../utils/alert';
import { getAllBalances, getCashSummary, topupCash, reconcileBalance, getCashConfig, exportCashCsv } from '../../utils/outletCashApi';
import { CATEGORY_META, TOPUP_SOURCE_META } from '../../utils/outletCashApi';
import { GlowOrb, Sparkle, FloatingBubble } from '../../components/ui/PremiumAnimations';
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp';
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp';

// ─── Premium Card Style ──────────────────────────────────────────────────────
const PREMIUM_CARD = {
  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
  boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
  borderRadius: 18,
};

// ─── Skeleton Block ───────────────────────────────────────────────────────────
function SkeletonBlock({ height = 80, style = {} }) {
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F3EEF7', overflow: 'hidden' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes floatA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-14px,16px) scale(1.08)} }
        @keyframes twinkle { 0%,100%{opacity:0;transform:scale(0.4) rotate(0deg)} 50%{opacity:1;transform:scale(1) rotate(20deg)} }
        @media (max-width: 480px) {
          .kas-overview-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .kas-overview-card { flex-direction: column !important; gap: 10px !important; }
          .kas-modal-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Premium Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        padding: '16px 20px 52px',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
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
              Kas Semua Outlet
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              Overview saldo kas operasional
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

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }} className="kas-overview-stats">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
            whileHover={{ y: -2 }}
            style={{
              ...PREMIUM_CARD,
              padding: '14px 16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.n600, letterSpacing: 0.3 }}>TOTAL SALDO</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: C.success, marginTop: 4 }}>{rp(totalBalance)}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 2 }}>{balances.length} outlet</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            whileHover={{ y: -2 }}
            style={{
              ...PREMIUM_CARD,
              padding: '14px 16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.n600, letterSpacing: 0.3 }}>MINIMUM</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.primary, marginTop: 4 }}>{rp(minBalance)}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 2 }}>batas per outlet</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ y: -2 }}
            style={{
              ...PREMIUM_CARD,
              padding: '14px 16px',
              textAlign: 'center',
              background: lowCount > 0 ? `linear-gradient(145deg, ${C.warningBg}, #FFF8E6)` : PREMIUM_CARD.background,
              border: lowCount > 0 ? `1.5px solid ${C.warning}` : '1px solid rgba(110, 46, 120, 0.04)',
            }}
          >
            <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.n600, letterSpacing: 0.3 }}>SALDO RENDAH</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 800, color: lowCount > 0 ? C.warningDark : C.success, marginTop: 4 }}>{lowCount}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 2 }}>outlet</div>
          </motion.div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleExport}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 14,
              border: 'none',
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
              color: 'white',
              fontFamily: 'Poppins',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(91, 0, 95, 0.25)',
            }}
          >
            📥 Export CSV
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('kas_approval')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 14,
              border: '1.5px solid rgba(91, 0, 95, 0.2)',
              background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
              color: C.primary,
              fontFamily: 'Poppins',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(91, 0, 95, 0.1)',
            }}
          >
            📋 Approval
          </motion.button>
        </div>

        {/* Outlet cards */}
        {loading && (
          <div>
            <SkeletonBlock height={90} />
            <SkeletonBlock height={90} />
            <SkeletonBlock height={90} />
          </div>
        )}

        {!loading && balances.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              ...PREMIUM_CARD,
              padding: '40px 20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 10 }}>💰</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n700 }}>Belum ada data kas</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 4 }}>Data kas outlet akan muncul di sini.</div>
          </motion.div>
        )}

        {!loading && balances.map((b, idx) => {
          const bal = Number(b.balance || 0);
          const isLow = bal < minBalance;
          return (
            <motion.div
              key={b.outletId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              whileHover={{ y: -2 }}
              style={{
                ...PREMIUM_CARD,
                padding: '14px 16px',
                marginBottom: 10,
                borderLeft: `4px solid ${isLow ? C.warning : C.success}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>
                      {b.outletName}
                    </span>
                    {isLow && (
                      <span style={{
                        fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                        background: C.warningBg, color: C.warningDark,
                      }}>
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
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setTopupForm(f => ({ ...f, outletId: b.outletId }));
                      setShowTopup(true);
                    }}
                    style={{
                      marginTop: 4, padding: '6px 14px', borderRadius: 10,
                      border: `1.5px solid ${C.primary}`, background: 'white',
                      color: C.primary, fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    📥 Top-up
                  </motion.button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Topup Modal */}
      {showTopup && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            style={{
              background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
              borderRadius: 22, padding: '24px 20px',
              maxWidth: 400, width: '90%', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 20px 50px rgba(91, 0, 95, 0.3)',
            }}
          >
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900, marginBottom: 16 }}>Top-up Kas Outlet</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Nominal (Rp) *</div>
              <input
                type="text"
                value={topupForm.amount}
                onChange={(e) => setTopupForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="500.000"
                style={{ width: '100%', height: 44, borderRadius: 12, border: '1.5px solid rgba(91, 0, 95, 0.15)', fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Nama PIC *</div>
              <input
                type="text"
                value={topupForm.picName}
                onChange={(e) => setTopupForm(f => ({ ...f, picName: e.target.value }))}
                placeholder="Nama PIC"
                style={{ width: '100%', height: 44, borderRadius: 12, border: '1.5px solid rgba(91, 0, 95, 0.15)', fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Sumber Dana</div>
              <select
                value={topupForm.source}
                onChange={(e) => setTopupForm(f => ({ ...f, source: e.target.value }))}
                style={{ width: '100%', height: 44, borderRadius: 12, border: '1.5px solid rgba(91, 0, 95, 0.15)', fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', boxSizing: 'border-box', outline: 'none' }}
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
                style={{ width: '100%', height: 44, borderRadius: 12, border: '1.5px solid rgba(91, 0, 95, 0.15)', fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Bukti Foto Transfer *</div>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} style={{ display: 'none' }} id="admin-topup-proof" />
              <label htmlFor="admin-topup-proof" style={{
                display: 'block', padding: '12px 16px',
                background: 'linear-gradient(145deg, #F8F4FF, #FFFFFF)',
                border: `1.5px dashed rgba(91, 0, 95, 0.2)`,
                borderRadius: 14,
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
                style={{ width: '100%', borderRadius: 12, border: '1.5px solid rgba(91, 0, 95, 0.15)', fontFamily: 'Poppins', fontSize: 13, padding: 10, boxSizing: 'border-box', resize: 'vertical', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowTopup(false)}
                style={{
                  flex: 1, height: 44, borderRadius: 12,
                  border: '1.5px solid rgba(91, 0, 95, 0.15)',
                  background: 'white',
                  fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n600, cursor: 'pointer',
                }}
              >
                Batal
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleTopup}
                disabled={!topupForm.amount || !topupForm.picName.trim() || !topupForm.proofPhotoUrl.trim() || topupLoading}
                style={{
                  flex: 1, height: 44, borderRadius: 12,
                  border: 'none',
                  background: topupLoading
                    ? C.n400
                    : `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                  fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(91, 0, 95, 0.3)',
                }}
              >
                {topupLoading ? 'Menyimpan...' : 'Top-up'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
