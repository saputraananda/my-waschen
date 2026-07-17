import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Modal, Input, Select } from '../../components/ui';
import { alertError, alertSuccess, alertConfirm } from '../../utils/alert';
import { useResponsive } from '../../utils/hooks';
import { GlowOrb, Sparkle, FloatingBubble } from '../../components/ui/PremiumAnimations';

const MONTH_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Claymorphism card style
const clayCard = {
  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
  boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
  borderRadius: 18,
};

// Skeleton shimmer animation
const skeletonKeyframes = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .skeleton-shimmer {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
`;

const SkeletonBlock = ({ width = '100%', height = 20, borderRadius = 8, style = {} }) => (
  <div
    className="skeleton-shimmer"
    style={{ width, height, borderRadius, ...style }}
  />
);

function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
}
function fmtDateTime(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
}

function PctBadge({ pct }) {
  if (pct == null) return null;
  const color = pct >= 100 ? C.success : pct >= 80 ? C.success : pct >= 50 ? C.warning : C.danger;
  const bg    = pct >= 100 ? C.successBg : pct >= 80 ? C.successBg : pct >= 50 ? C.warningBg : C.dangerBg;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', background: bg, padding: '2px 10px', borderRadius: 999 }}>
      <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color }}>{pct}% target</span>
    </div>
  );
}

function ProgressBar({ pct, color }) {
  return (
    <div style={{ height: 6, background: C.n200, borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ height: '100%', width: `${Math.min(100, pct || 0)}%`, background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
    </div>
  );
}

export default function AdminPeriodClosePage({ goBack }) {
  const { isMobile } = useResponsive();
  const [outlets, setOutlets] = useState([]);
  const [selOutlet, setSelOutlet] = useState('');
  const [period, setPeriod]   = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(false);

  // Tutup buku modal
  const [closeModal, setCloseModal] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');
  const [closing, setClosing]       = useState(false);

  // Dynamic subtitle based on period data
  const periodSubtitle = period
    ? `Periode ${MONTH_NAMES[period.month] || ''} ${period.year}`
    : 'Memuat periode...';

  useEffect(() => {
    axios.get('/api/master/outlets').then(r => {
      const list = r?.data?.data || [];
      setOutlets(list);
      if (list.length > 0) setSelOutlet(list[0].id);
    }).catch(() => {
      // Silent fail for optional outlet fetch
    });
  }, []);

  const fetchPeriod = useCallback(async () => {
    if (!selOutlet) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/periods/current?outletId=${selOutlet}`);
      setPeriod(res?.data?.data || null);
    } catch {
      setPeriod(null);
    } finally {
      setLoading(false);
    }
  }, [selOutlet]);

  const fetchHistory = useCallback(async () => {
    if (!selOutlet) return;
    setHistLoading(true);
    try {
      const res = await axios.get(`/api/periods/history?outletId=${selOutlet}`);
      setHistory(res?.data?.data || []);
    } catch {
      setHistory([]);
    } finally {
      setHistLoading(false);
    }
  }, [selOutlet]);

  useEffect(() => {
    fetchPeriod();
    fetchHistory();
  }, [fetchPeriod, fetchHistory]);

  const handleClosePeriod = async () => {
    const ok = await alertConfirm(
      `Tutup buku periode ${period?.periodLabel}?\n\nSnapshot penjualan akan disimpan. Tindakan ini tidak dapat dibatalkan.`
    );
    if (!ok) return;
    setClosing(true);
    try {
      await axios.post('/api/periods/close', { outletId: selOutlet, notes: closeNotes || null });
      alertSuccess(`Tutup buku ${period?.periodLabel} berhasil!`);
      setCloseModal(false);
      setCloseNotes('');
      fetchPeriod();
      fetchHistory();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal tutup buku.');
    } finally {
      setClosing(false);
    }
  };

  const outletName = outlets.find(o => o.id === selOutlet)?.name || '';
  const pctColor = (p) => p >= 100 ? C.success : p >= 80 ? C.success : p >= 50 ? C.warning : C.danger;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F3EEF7', overflow: 'hidden' }}>
      {/* Premium Header */}
      <div style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        padding: '16px 16px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <GlowOrb color="rgba(255,255,255,0.08)" size={200} top="-60px" right="-40px" />
        <GlowOrb color="rgba(255,200,255,0.06)" size={150} bottom="-30px" left="-30px" />
        <Sparkle color="rgba(255,255,255,0.6)" size={8} top="20px" left="30%" delay={0.5} />
        <Sparkle color="rgba(255,255,255,0.5)" size={6} top="40px" right="25%" delay={1.2} />
        <FloatingBubble size={12} top="10px" left="60%" delay={0.8} duration={4} />
        <FloatingBubble size={8} bottom="5px" right="20%" delay={2} duration={3.5} />

        <TopBar
          title="Tutup Buku"
          subtitle={periodSubtitle}
          onBack={goBack}
          transparent
        />
      </div>

      <style>{skeletonKeyframes}</style>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 80px' }}>

        {/* Outlet selector */}
        <div style={{
          ...clayCard,
          padding: isMobile ? '12px' : '12px 14px',
          marginBottom: 16,
        }}>
          <Select
            label="Outlet"
            value={selOutlet}
            onChange={setSelOutlet}
            options={outlets.map(o => ({ value: o.id, label: o.name }))}
          />
        </div>

        {/* Current period card */}
        {loading ? (
          <div style={{ ...clayCard, padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <SkeletonBlock width={150} height={20} style={{ marginBottom: 6 }} />
                <SkeletonBlock width={200} height={14} />
              </div>
              <SkeletonBlock width={100} height={24} borderRadius={12} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <SkeletonBlock height={60} borderRadius={10} />
              <SkeletonBlock height={60} borderRadius={10} />
              <SkeletonBlock height={60} borderRadius={10} />
              <SkeletonBlock height={60} borderRadius={10} />
            </div>
          </div>
        ) : period && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              ...clayCard,
              padding: '16px',
              marginBottom: 16,
              border: `2px solid ${period.alreadyClosed ? C.success : period.isClosing ? C.warning : C.n200}`,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900 }}>
                  {period.periodLabel}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700 }}>
                  {fmtDate(period.periodStart)} – {fmtDate(period.periodEnd)}
                </div>
              </div>
              <div>
                {period.alreadyClosed ? (
                  <span style={{ background: C.successBg, color: C.success, fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 999 }}>
                    ✅ Sudah Ditutup
                  </span>
                ) : period.isClosing ? (
                  <span style={{ background: C.warningBg, color: C.warning, fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 999 }}>
                    ⚠️ {period.daysLeft} hari lagi
                  </span>
                ) : (
                  <span style={{ background: C.n100, color: C.n700, fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 999 }}>
                    {period.daysLeft} hari lagi
                  </span>
                )}
              </div>
            </div>

            {/* Alert tutup buku */}
            {!period.alreadyClosed && period.isClosing && (
              <div style={{ background: C.warningBg, borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.warning, marginBottom: 2 }}>
                  ⚠️ Segera lakukan tutup buku!
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.warningDark }}>
                  Periode {period.periodLabel} berakhir pada {fmtDate(period.periodEnd)}.
                  Lakukan tutup buku untuk menyimpan snapshot penjualan bulan ini.
                </div>
              </div>
            )}

            {period.alreadyClosed && period.closedAt && (
              <div style={{ background: C.successBg, borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.successDark }}>
                  ✅ Ditutup pada {fmtDateTime(period.closedAt)}
                </div>
              </div>
            )}

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'OMSET PERIODE', value: rp(period.stats.totalOmset), color: C.primary },
                { label: 'PELUNASAN', value: rp(period.stats.totalPelunasan), color: C.success },
                { label: 'TOTAL NOTA', value: period.stats.totalTransaksi, color: C.info },
                { label: 'SELESAI', value: period.stats.totalSelesai, color: C.primaryTint },
              ].map(s => (
                <div key={s.label} style={{ background: C.n50, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.n700, letterSpacing: 0.5 }}>{s.label}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: s.color, marginTop: 2 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {!period.alreadyClosed && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setCloseModal(true)}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'Poppins',
                  background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 12,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(91, 0, 95, 0.3)',
                }}
              >
                📒 Tutup Buku {period.periodLabel}
              </motion.button>
            )}
          </motion.div>
        )}

        {/* History */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, marginBottom: 10 }}>
            📂 Riwayat Tutup Buku — {outletName}
          </div>

          {histLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ ...clayCard, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <SkeletonBlock width={120} height={16} style={{ marginBottom: 4 }} />
                      <SkeletonBlock width={180} height={12} />
                    </div>
                    <SkeletonBlock width={80} height={20} borderRadius={10} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <SkeletonBlock width={80} height={50} borderRadius={8} />
                    <SkeletonBlock width={80} height={50} borderRadius={8} />
                    <SkeletonBlock width={80} height={50} borderRadius={8} />
                  </div>
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div style={{ ...clayCard, padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n700 }}>Belum ada riwayat tutup buku untuk outlet ini.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map((row, idx) => {
                const color = row.pct != null ? pctColor(row.pct) : C.n700;
                const piutang = Math.max(0, row.totalOmset - row.totalPelunasan);
                return (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    style={{ ...clayCard, padding: '14px 16px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>
                          {row.periodLabel}
                        </div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n700 }}>
                          {fmtDate(row.periodStart)} – {fmtDate(row.periodEnd)}
                        </div>
                      </div>
                      <PctBadge pct={row.pct} />
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: isMobile ? '100%' : 80, background: C.n50, borderRadius: 8, padding: '6px 10px' }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n700, fontWeight: 600 }}>OMSET</div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.primary }}>{rp(row.totalOmset)}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 80, background: C.n50, borderRadius: 8, padding: '6px 10px' }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n700, fontWeight: 600 }}>PELUNASAN</div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.success }}>{rp(row.totalPelunasan)}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 80, background: C.n50, borderRadius: 8, padding: '6px 10px' }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n700, fontWeight: 600 }}>NOTA</div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.info }}>{row.totalTransaksi}</div>
                      </div>
                    </div>

                    {row.targetAmount != null && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Poppins', fontSize: 10, color: C.n700, marginBottom: 3 }}>
                          <span>Target: {rp(row.targetAmount)}</span>
                          <span style={{ color }}>{row.pct}%</span>
                        </div>
                        <ProgressBar pct={row.pct} color={color} />
                      </>
                    )}

                    {piutang > 0 && (
                      <div style={{ marginTop: 8, fontFamily: 'Poppins', fontSize: 11, color: C.warning, background: C.warningBg, borderRadius: 8, padding: '5px 10px' }}>
                        ⚠️ Piutang belum terbayar: {rp(piutang)}
                      </div>
                    )}

                    <div style={{ marginTop: 8, fontFamily: 'Poppins', fontSize: 10, color: C.n700 }}>
                      Ditutup oleh {row.closedByName || '—'} · {fmtDateTime(row.closedAt)}
                    </div>
                    {row.notes && (
                      <div style={{ marginTop: 4, fontFamily: 'Poppins', fontSize: 10, color: C.warning }}>📝 {row.notes}</div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal konfirmasi tutup buku */}
      <Modal isOpen={closeModal} onClose={() => setCloseModal(false)} title={`📒 Tutup Buku ${period?.periodLabel || ''}`}>
        <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n700, marginBottom: 12, lineHeight: 1.6 }}>
          Tindakan ini akan menyimpan <strong>snapshot permanen</strong> dari seluruh penjualan periode{' '}
          <strong>{period?.periodLabel}</strong> ({fmtDate(period?.periodStart)} – {fmtDate(period?.periodEnd)}).
          Data historis akan tetap tersimpan.
        </div>

        {/* Ringkasan */}
        {period?.stats && (
          <div style={{ background: C.n50, borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Ringkasan periode ini:</div>
            {[
              ['Omset', rp(period.stats.totalOmset)],
              ['Pelunasan', rp(period.stats.totalPelunasan)],
              ['Total nota', period.stats.totalTransaksi],
              ['Piutang', rp(Math.max(0, period.stats.totalOmset - period.stats.totalPelunasan))],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Poppins', fontSize: 12, color: C.n800, marginBottom: 4 }}>
                <span>{k}</span><strong>{v}</strong>
              </div>
            ))}
          </div>
        )}

        <Input label="Catatan penutupan (opsional)" value={closeNotes} onChange={setCloseNotes} placeholder="Misal: ada transaksi pending X yang perlu di-follow-up..." />

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setCloseModal(false)}
            style={{
              flex: 1,
              padding: '12px 0',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Poppins',
              background: C.n100,
              color: C.n700,
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            Batal
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleClosePeriod}
            style={{
              flex: 1,
              padding: '12px 0',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Poppins',
              background: closing ? C.n300 : 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              cursor: closing ? 'not-allowed' : 'pointer',
              boxShadow: closing ? 'none' : '0 4px 15px rgba(91, 0, 95, 0.3)',
            }}
            disabled={closing}
          >
            {closing ? 'Menutup...' : 'Tutup Buku'}
          </motion.button>
        </div>
      </Modal>
    </div>
  );
}
