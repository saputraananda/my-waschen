import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Modal, Input, Select } from '../../components/ui';
import { alertError, alertSuccess, alertConfirm } from '../../utils/alert';

const MONTHS = [
  { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },   { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },     { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },    { value: 8, label: 'Agustus' },
  { value: 9, label: 'September'}, { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },{ value: 12, label: 'Desember' },
];

const YEAR_RANGE = (() => {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1].map(v => ({ value: v, label: String(v) }));
})();

function pctColor(pct) {
  if (pct >= 100) return '#059669';
  if (pct >= 80)  return '#10B981';
  if (pct >= 50)  return '#F59E0B';
  return '#EF4444';
}
function pctBg(pct) {
  if (pct >= 100) return '#DCFCE7';
  if (pct >= 80)  return '#D1FAE5';
  if (pct >= 50)  return '#FEF3C7';
  return '#FEE2E2';
}

function ProgressBar({ pct, color }) {
  return (
    <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
    </div>
  );
}

export default function AdminTargetPage({ navigate, goBack }) {
  const now = new Date();
  const [year, setYear]       = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [outlets, setOutlets] = useState([]);
  const [filterOutlet, setFilterOutlet] = useState('');
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [modal, setModal] = useState(false); // false | 'add' | row
  const [formOutlet, setFormOutlet]       = useState('');
  const [formYear, setFormYear]           = useState(now.getFullYear());
  const [formMonth, setFormMonth]         = useState(now.getMonth() + 1);
  const [formAmount, setFormAmount]       = useState('');
  const [formNotes, setFormNotes]         = useState('');
  const [saving, setSaving]               = useState(false);

  useEffect(() => {
    axios.get('/api/master/outlets').then(r => {
      const list = r?.data?.data || [];
      setOutlets(list);
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

  const outletOptions = [
    { value: '', label: 'Semua Outlet' },
    ...outlets.map(o => ({ value: o.id, label: o.name })),
  ];
  const outletFormOptions = outlets.map(o => ({ value: o.id, label: o.name }));
  const monthOptions = [{ value: '', label: 'Semua Bulan' }, ...MONTHS.map(m => ({ value: m.value, label: m.label }))];
  const monthFormOptions = MONTHS.map(m => ({ value: m.value, label: m.label }));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Capaian Target" subtitle="Manajemen target per outlet" onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 80px' }}>

        {/* Filter bar */}
        <div style={{ background: 'white', borderRadius: 14, padding: '12px 14px', marginBottom: 14, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 10 }}>Filter</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <Select
              label="Tahun"
              value={year}
              onChange={v => setYear(Number(v))}
              options={YEAR_RANGE}
            />
            <Select
              label="Bulan"
              value={month}
              onChange={v => setMonth(v ? Number(v) : '')}
              options={monthOptions}
            />
          </div>
          <Select
            label="Outlet"
            value={filterOutlet}
            onChange={setFilterOutlet}
            options={outletOptions}
          />
        </div>

        {/* Summary totals */}
        {targets.length > 0 && (() => {
          const totalTarget = targets.reduce((s, r) => s + r.targetAmount, 0);
          const totalActual = targets.reduce((s, r) => s + r.actualAmount, 0);
          const pct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
          const color = pctColor(pct);
          return (
            <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 14, boxShadow: '0 2px 8px rgba(15,23,42,0.06)', border: `2px solid ${color}22` }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, letterSpacing: 0.5, marginBottom: 10 }}>RINGKASAN PERIODE</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Realisasi</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 900, color: color }}>{rp(totalActual)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Target</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n700 }}>{rp(totalTarget)}</div>
                </div>
              </div>
              <ProgressBar pct={pct} color={color} />
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: color, textAlign: 'center', marginTop: 6 }}>
                {pct}% tercapai
              </div>
            </div>
          );
        })()}

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat data...</div>
        ) : targets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.n900, marginBottom: 4 }}>Belum ada target</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, marginBottom: 20 }}>Tambahkan target capaian untuk outlet dan periode ini.</div>
            <Btn variant="primary" onClick={openAdd}>+ Tambah Target</Btn>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {targets.map(row => {
              const color = pctColor(row.pct);
              return (
                <div key={row.id} style={{ background: 'white', borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', border: `1.5px solid ${pctBg(row.pct)}` }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>{row.outletName}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>{row.monthName} {row.year}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ background: pctBg(row.pct), padding: '3px 10px', borderRadius: 999 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 800, color }}>{row.pct}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Values */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, background: C.n50, borderRadius: 10, padding: '8px 12px' }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, color: C.n500, letterSpacing: 0.5 }}>REALISASI</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 800, color }}>{rp(row.actualAmount)}</div>
                    </div>
                    <div style={{ flex: 1, background: C.n50, borderRadius: 10, padding: '8px 12px' }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, color: C.n500, letterSpacing: 0.5 }}>TARGET</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 800, color: C.n700 }}>{rp(row.targetAmount)}</div>
                    </div>
                  </div>

                  <ProgressBar pct={row.pct} color={color} />

                  {row.notes && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#92400E', marginTop: 8 }}>📝 {row.notes}</div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <Btn variant="secondary" onClick={() => openEdit(row)} style={{ flex: 1, padding: '8px 0', fontSize: 12 }}>✏️ Edit</Btn>
                    <Btn variant="danger" onClick={() => handleDelete(row)} style={{ flex: 1, padding: '8px 0', fontSize: 12 }}>🗑️ Hapus</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB tambah */}
      {targets.length > 0 && (
        <div style={{ position: 'fixed', bottom: 24, right: 20, zIndex: 50 }}>
          <button
            onClick={openAdd}
            style={{ width: 54, height: 54, borderRadius: 27, background: C.primary, border: 'none', boxShadow: '0 4px 16px rgba(91,0,95,0.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      )}

      {/* Modal tambah/edit */}
      <Modal isOpen={!!modal} onClose={() => setModal(false)} title={modal === 'add' ? '🎯 Tambah Target' : '✏️ Edit Target'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Select
            label="Outlet"
            value={formOutlet}
            onChange={setFormOutlet}
            options={outletFormOptions}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Select
              label="Bulan"
              value={formMonth}
              onChange={v => setFormMonth(Number(v))}
              options={monthFormOptions}
            />
            <Select
              label="Tahun"
              value={formYear}
              onChange={v => setFormYear(Number(v))}
              options={YEAR_RANGE}
            />
          </div>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Target Omset (Rp)</div>
            <input
              type="number"
              value={formAmount}
              onChange={e => setFormAmount(e.target.value)}
              placeholder="Contoh: 50000000"
              style={{ width: '100%', height: 44, borderRadius: 10, border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins', fontSize: 14, padding: '0 12px', boxSizing: 'border-box', outline: 'none' }}
            />
            {formAmount && !isNaN(Number(formAmount)) && (
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 4 }}>= {rp(Number(formAmount))}</div>
            )}
          </div>
          <Input
            label="Catatan (opsional)"
            value={formNotes}
            onChange={setFormNotes}
            placeholder="Misal: target bonus lebaran..."
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setModal(false)} style={{ flex: 1 }}>Batal</Btn>
            <Btn variant="primary" onClick={handleSave} loading={saving} style={{ flex: 1 }}>Simpan</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
