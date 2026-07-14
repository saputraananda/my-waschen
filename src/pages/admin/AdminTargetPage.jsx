import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Modal, Input, Select, MoneyInput } from '../../components/ui';
import { alertError, alertSuccess, alertConfirm } from '../../utils/alert';
import { useResponsive } from '../../utils/hooks';

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
  if (pct >= 80)  return C.success; // Keeping this specific shade for 80-99% range
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
      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Capaian Target" subtitle="Manajemen target per outlet" onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 80px' }}>

        {/* Filter bar */}
        <div style={{ background: C.white, borderRadius: 16, padding: isMobile ? '12px' : '14px 16px', marginBottom: 12, boxShadow: SHADOW.md }}>
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
            <div style={{
              background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 12,
              boxShadow: SHADOW.md, borderLeft: `4px solid ${color}`,
            }}>
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
            </div>
          );
        })()}

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12 }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${C.n200}`, borderTop: `3px solid ${C.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n700 }}>Memuat data...</span>
          </div>
        ) : targets.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 10 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: `${C.primary}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${C.primary}18` }}>
              <span style={{ fontSize: 28 }}>🎯</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: C.n800 }}>Belum ada target</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, marginBottom: 20, textAlign: 'center' }}>Tambahkan target capaian untuk outlet dan periode ini.</div>
            <Btn variant="primary" onClick={openAdd}>+ Tambah Target</Btn>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {targets.map(row => {
              const color = pctColor(row.pct);
              return (
                <div key={row.id} style={{
                  background: C.white, borderRadius: 16, padding: '14px 16px',
                  boxShadow: SHADOW.md, borderLeft: `4px solid ${color}`,
                  transition: 'all 0.2s ease',
                }}>
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
                    <div style={{ flex: 1, background: C.n50, borderRadius: 10, padding: '8px 12px' }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.n500, letterSpacing: 0.5 }}>REALISASI</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color }}>{rp(row.actualAmount)}</div>
                    </div>
                    <div style={{ flex: 1, background: C.n50, borderRadius: 10, padding: '8px 12px' }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.n500, letterSpacing: 0.5 }}>TARGET</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n700 }}>{rp(row.targetAmount)}</div>
                    </div>
                  </div>

                  <ProgressBar pct={row.pct} color={color} />

                  {/* Achievement banner */}
                  {row.actualAmount > row.targetAmount && row.targetAmount > 0 && (
                    <div style={{
                      marginTop: 8, padding: '8px 12px', borderRadius: 10,
                      background: 'linear-gradient(90deg, #DCFCE7, #F0FDF4)',
                      border: `1px solid ${C.successBg}`, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ fontSize: 14 }}>🏆</span>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.successDark }}>
                        Surplus <strong>{rp(row.actualAmount - row.targetAmount)}</strong> · Lampaui target {row.pct - 100}%
                      </div>
                    </div>
                  )}
                  {row.actualAmount >= row.targetAmount && row.actualAmount === row.targetAmount && row.targetAmount > 0 && (
                    <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: C.successBg, border: `1px solid ${C.successBg}`, display: 'flex', alignItems: 'center', gap: 6 }}>
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
                    <Btn
                      variant="primary"
                      onClick={() => navigate('admin_target_detail', { outletId: row.outletId, year: row.year, month: row.month })}
                      style={{ flex: isMobile ? 1 : 1.5, padding: '8px 0', fontSize: 12 }}
                    >📊 Lihat Detail Harian</Btn>
                    <Btn variant="secondary" onClick={() => openEdit(row)} style={{ flex: 1, padding: '8px 0', fontSize: 12 }}>✏️ Edit</Btn>
                    <Btn variant="danger" onClick={() => handleDelete(row)} style={{ flex: 1, padding: '8px 0', fontSize: 12 }}>🗑️</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      {targets.length > 0 && (
        <button onClick={openAdd} style={{
          position: 'fixed', bottom: 24, right: 20, zIndex: 50,
          width: 56, height: 56, borderRadius: 28,
          background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(110,46,120,0.45)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(110,46,120,0.55)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(110,46,120,0.45)'; }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
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