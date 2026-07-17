import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Modal, Input, Select, MoneyInput } from '../../components/ui';
import { alertError, alertSuccess, alertConfirm } from '../../utils/alert';
import { useResponsive } from '../../utils/hooks';
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
function SkeletonBlock({ height = 160, style = {} }) {
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

const MONTHS = [
  { value: 1, label: 'Januari' },  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },    { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },      { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },     { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' }, { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' }, { value: 12, label: 'Desember' },
];
const YEAR_RANGE = (() => {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1].map(v => ({ value: v, label: String(v) }));
})();

function pctColor(pct) {
  if (pct >= 100) return C.success;
  if (pct >= 80)  return C.success;
  if (pct >= 50)  return C.warning;
  return C.danger;
}
function pctBg(pct) {
  if (pct >= 100) return C.successBg;
  if (pct >= 80)  return C.successBg;
  if (pct >= 50)  return C.warningBg;
  return C.dangerBg;
}

function ProgressBar({ pct, color }) {
  return (
    <div style={{ height: 6, background: C.n200, borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, pct)}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ height: '100%', background: color, borderRadius: 3 }}
      />
    </div>
  );
}

export default function AdminTargetPage({ navigate, goBack }) {
  const { isMobile } = useResponsive();
  const now = new Date();
  const [year, setYear]         = useState(now.getFullYear());
  const [month, setMonth]       = useState(now.getMonth() + 1);
  const [outlets, setOutlets]   = useState([]);
  const [filterOutlet, setFilterOutlet] = useState('');
  const [targets, setTargets]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [modal, setModal]       = useState(false);
  const [formOutlet, setFormOutlet]   = useState('');
  const [formYear, setFormYear]       = useState(now.getFullYear());
  const [formMonth, setFormMonth]     = useState(now.getMonth() + 1);
  const [formAmount, setFormAmount]   = useState('');
  const [formNotes, setFormNotes]     = useState('');
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    axios.get('/api/master/outlets').then(r => {
      setOutlets(r?.data?.data || []);
    }).catch(() => {});
  }, []);

  const fetchTargets = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ year });
      if (month) q.set('month', month);
      if (filterOutlet) q.set('outletId', filterOutlet);
      const res = await axios.get(`/api/targets?${q}`);
      setTargets(res?.data?.data || []);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal memuat data target.');
    } finally {
      setLoading(false);
    }
  }, [year, month, filterOutlet]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  const openAdd = () => {
    setFormOutlet(outlets[0]?.id || '');
    setFormYear(year);
    setFormMonth(month);
    setFormAmount('');
    setFormNotes('');
    setModal('add');
  };

  const openEdit = (row) => {
    setFormOutlet(row.outletId);
    setFormYear(row.year);
    setFormMonth(row.month);
    setFormAmount(String(row.targetAmount));
    setFormNotes(row.notes || '');
    setModal(row);
  };

  const handleSave = async () => {
    if (!formOutlet || !formAmount) { alertError('Outlet dan nilai target wajib diisi.'); return; }
    setSaving(true);
    try {
      await axios.post('/api/targets', {
        outletId: formOutlet,
        year: Number(formYear),
        month: Number(formMonth),
        targetAmount: Number(String(formAmount).replace(/[^0-9]/g, '')),
        notes: formNotes || null,
      });
      alertSuccess('Target berhasil disimpan.');
      setModal(false);
      fetchTargets();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyimpan target.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    const ok = await alertConfirm(`Hapus target ${row.outletName} — ${row.monthName} ${row.year}?`);
    if (!ok) return;
    try {
      await axios.delete(`/api/targets/${row.id}`);
      alertSuccess('Target dihapus.');
      fetchTargets();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menghapus.');
    }
  };

  const outletOptions     = [{ value: '', label: 'Semua Outlet' }, ...outlets.map(o => ({ value: o.id, label: o.name }))];
  const outletFormOptions = outlets.map(o => ({ value: o.id, label: o.name }));
  const monthOptions      = [{ value: '', label: 'Semua Bulan' }, ...MONTHS.map(m => ({ value: m.value, label: m.label }))];
  const monthFormOptions  = MONTHS.map(m => ({ value: m.value, label: m.label }));

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
              Capaian Target
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              Manajemen target per outlet
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

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 100px' }}>

        {/* Filter bar */}
        <div style={{ ...PREMIUM_CARD, padding: isMobile ? '12px' : '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <Select label="Tahun" value={year} onChange={v => setYear(Number(v))} options={YEAR_RANGE} />
            <Select label="Bulan" value={month} onChange={v => setMonth(v ? Number(v) : '')} options={monthOptions} />
          </div>
          <Select label="Outlet" value={filterOutlet} onChange={setFilterOutlet} options={outletOptions} />
        </div>

        {/* Summary totals */}
        {targets.length > 0 && (() => {
          const totalTarget = targets.reduce((s, r) => s + r.targetAmount, 0);
          const totalActual = targets.reduce((s, r) => s + r.actualAmount, 0);
          const pct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
          const color = pctColor(pct);
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                ...PREMIUM_CARD,
                padding: '14px 16px', marginBottom: 12,
                borderLeft: `4px solid ${color}`,
              }}
            >
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, letterSpacing: 0.5, marginBottom: 10 }}>RINGKASAN PERIODE</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Realisasi</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 600, color }}>{rp(totalActual)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Target</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n700 }}>{rp(totalTarget)}</div>
                </div>
              </div>
              <ProgressBar pct={pct} color={color} />
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color, textAlign: 'center', marginTop: 6 }}>
                {pct}% tercapai
              </div>
            </motion.div>
          );
        })()}

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SkeletonBlock height={160} />
            <SkeletonBlock height={160} />
          </div>
        ) : targets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              ...PREMIUM_CARD,
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: 'linear-gradient(145deg, #F8F4FF, #FFFFFF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '8px 8px 20px rgba(110, 46, 120, 0.12), -4px -4px 10px rgba(255, 255, 255, 0.95)',
              margin: '0 auto 16px'
            }}>
              <span style={{ fontSize: 28 }}>🎯</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: C.n800 }}>Belum ada target</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, marginBottom: 20, textAlign: 'center' }}>Tambahkan target capaian untuk outlet dan periode ini.</div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={openAdd}
              style={{
                padding: '10px 24px',
                borderRadius: 14,
                border: 'none',
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                color: 'white',
                fontFamily: 'Poppins',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(91, 0, 95, 0.25)',
              }}
            >
              + Tambah Target
            </motion.button>
          </motion.div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {targets.map((row, idx) => {
              const color = pctColor(row.pct);
              return (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  whileHover={{ y: -2 }}
                  style={{
                    ...PREMIUM_CARD,
                    padding: '14px 16px',
                    borderLeft: `4px solid ${color}`,
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{row.outletName}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 1 }}>{row.monthName} {row.year}</div>
                    </div>
                    <div style={{ background: pctBg(row.pct), padding: '3px 10px', borderRadius: 999, boxShadow: `0 2px 6px ${color}20` }}>
                      <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color }}>{row.pct}%</span>
                    </div>
                  </div>

                  {/* Values */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, background: 'linear-gradient(145deg, #F8F4FF, #FFFFFF)', borderRadius: 10, padding: '8px 12px', boxShadow: '4px 4px 10px rgba(110, 46, 120, 0.08), -2px -2px 6px rgba(255, 255, 255, 0.95)' }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.n500, letterSpacing: 0.5 }}>REALISASI</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color }}>{rp(row.actualAmount)}</div>
                    </div>
                    <div style={{ flex: 1, background: 'linear-gradient(145deg, #F8F4FF, #FFFFFF)', borderRadius: 10, padding: '8px 12px', boxShadow: '4px 4px 10px rgba(110, 46, 120, 0.08), -2px -2px 6px rgba(255, 255, 255, 0.95)' }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.n500, letterSpacing: 0.5 }}>TARGET</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n700 }}>{rp(row.targetAmount)}</div>
                    </div>
                  </div>

                  <ProgressBar pct={row.pct} color={color} />

                  {/* Achievement banner */}
                  {row.actualAmount > row.targetAmount && row.targetAmount > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        marginTop: 8, padding: '8px 12px', borderRadius: 12,
                        background: 'linear-gradient(90deg, #DCFCE7, #F0FDF4)',
                        border: `1px solid ${C.successBg}`, display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>🏆</span>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.successDark }}>
                        Surplus <strong>{rp(row.actualAmount - row.targetAmount)}</strong> · Lampaui target {row.pct - 100}%
                      </div>
                    </motion.div>
                  )}
                  {row.actualAmount >= row.targetAmount && row.actualAmount === row.targetAmount && row.targetAmount > 0 && (
                    <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 12, background: C.successBg, border: `1px solid ${C.successBg}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>✅</span>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.successDark }}>Target tercapai persis!</div>
                    </div>
                  )}
                  {row.actualAmount < row.targetAmount && row.targetAmount > 0 && (
                    <div style={{
                      marginTop: 8, padding: '6px 12px', borderRadius: 10,
                      background: row.pct >= 70 ? C.validationWarningBg : C.validationErrorBg,
                      border: `1px solid ${row.pct >= 70 ? C.validationWarningBorder : C.validationErrorBorder}`,
                      fontFamily: 'Poppins', fontSize: 10,
                      color: row.pct >= 70 ? C.validationWarningText : C.validationErrorText,
                    }}>
                      Kurang <strong>{rp(row.targetAmount - row.actualAmount)}</strong> ({100 - row.pct}%) untuk mencapai target
                    </div>
                  )}

                  {row.notes && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 8 }}>📝 {row.notes}</div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => navigate('admin_target_detail', { outletId: row.outletId, year: row.year, month: row.month })}
                      style={{
                        flex: isMobile ? 1 : 1.5, padding: '8px 0', fontSize: 12,
                        borderRadius: 12, border: 'none',
                        background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                        color: 'white', cursor: 'pointer',
                        fontFamily: 'Poppins', fontWeight: 600,
                        boxShadow: '0 4px 12px rgba(91, 0, 95, 0.25)',
                      }}
                    >📊 Lihat Detail Harian</motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => openEdit(row)}
                      style={{
                        flex: 1, padding: '8px 0', fontSize: 12,
                        borderRadius: 12,
                        border: '1.5px solid rgba(91, 0, 95, 0.15)',
                        background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
                        color: C.primary, cursor: 'pointer',
                        fontFamily: 'Poppins', fontWeight: 600,
                        boxShadow: '0 2px 8px rgba(110, 46, 120, 0.08)',
                      }}
                    >✏️ Edit</motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleDelete(row)}
                      style={{
                        flex: 1, padding: '8px 0', fontSize: 12,
                        borderRadius: 12,
                        border: '1.5px solid rgba(184, 40, 72, 0.15)',
                        background: C.dangerBg,
                        color: C.danger, cursor: 'pointer',
                        fontFamily: 'Poppins', fontWeight: 600,
                      }}
                    >🗑️</motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      {targets.length > 0 && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={openAdd}
          style={{
            position: 'fixed', bottom: 24, right: 20, zIndex: 50,
            width: 56, height: 56, borderRadius: 28,
            background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(110,46,120,0.45)',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </motion.button>
      )}

      {/* Modal */}
      <Modal visible={!!modal} onClose={() => setModal(false)} title={modal === 'add' ? '🎯 Tambah Target' : '✏️ Edit Target'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 4px 0' }}>
          <Select label="Outlet" value={formOutlet} onChange={setFormOutlet} options={outletFormOptions} />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
            <Select label="Bulan" value={formMonth} onChange={v => setFormMonth(Number(v))} options={monthFormOptions} />
            <Select label="Tahun" value={formYear} onChange={v => setFormYear(Number(v))} options={YEAR_RANGE} />
          </div>
          <MoneyInput
            label="Target Omset (Rp)"
            value={formAmount}
            onChange={setFormAmount}
            placeholder="50.000.000"
            hint={formAmount && !isNaN(Number(formAmount)) ? `= ${rp(Number(formAmount))}` : undefined}
          />
          <Input label="Catatan (opsional)" value={formNotes} onChange={setFormNotes} placeholder="Misal: target bonus lebaran..." />
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setModal(false)} style={{ flex: 1 }}>Batal</Btn>
            <Btn variant="primary" onClick={handleSave} loading={saving} style={{ flex: 1 }}>Simpan</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
