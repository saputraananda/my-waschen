import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Input } from '../../components/ui';

const METHOD_LABEL = {
  cash: 'Tunai',
  transfer: 'Transfer',
  qris: 'QRIS',
  ovo: 'OVO',
  gopay: 'GoPay',
  dana: 'DANA',
  shopeepay: 'ShopeePay',
  deposit: 'Deposit',
};

const fmtDt = (v) => {
  if (!v) return '-';
  try {
    return new Date(v).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(v);
  }
};

const SHIFT_LABEL = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam', full: 'Full Day' };

const fmtTimeOnly = (v) => {
  if (!v) return '';
  return new Date(v).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false });
};

const fmtElapsed = (openedAt) => {
  if (!openedAt) return '';
  const ms = Date.now() - new Date(openedAt).getTime();
  if (ms < 0) return '';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}j ${m}m`;
  return `${m} menit`;
};

const METHOD_ICON_COLOR = {
  cash: { icon: '💵', bg: '#DCFCE7', color: '#166534' },
  transfer: { icon: '🏦', bg: '#DBEAFE', color: '#1E40AF' },
  qris: { icon: '📱', bg: '#F3E8FF', color: '#7C3AED' },
  ovo: { icon: '🟣', bg: '#F3E8FF', color: '#7C3AED' },
  gopay: { icon: '🟢', bg: '#DCFCE7', color: '#166534' },
  dana: { icon: '🔵', bg: '#DBEAFE', color: '#1E40AF' },
  shopeepay: { icon: '🟠', bg: '#FFF7ED', color: '#C2410C' },
  deposit: { icon: '💰', bg: '#FEF3C7', color: '#92400E' },
};

export default function KasirShiftPage({ navigate, goBack }) {
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [shiftType, setShiftType] = useState('full');
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [closingResult, setClosingResult] = useState(null);
  const [elapsed, setElapsed] = useState('');
  const [liveSummary, setLiveSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // ── Kas Laci state ──
  const [drawerEntries, setDrawerEntries] = useState([]);
  const [drawerSummary, setDrawerSummary] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryForm, setEntryForm] = useState({ type: 'out', category: 'pengeluaran_operasional', amount: '', description: '' });
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState('');

  const loadStatus = async () => {
    try {
      const res = await axios.get('/api/shifts/status');
      setShift(res?.data || null);
    } catch {
      setShift(null);
    }
  };

  const loadLiveSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await axios.get('/api/shifts/current-summary');
      setLiveSummary(res?.data?.data || null);
    } catch {
      setLiveSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadDrawerEntries = useCallback(async () => {
    setDrawerLoading(true);
    try {
      const res = await axios.get('/api/cash-drawer/entries');
      setDrawerEntries(res?.data?.data || []);
      setDrawerSummary(res?.data?.summary || null);
    } catch {
      setDrawerEntries([]);
      setDrawerSummary(null);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (shift?.isOpen && !shift?.bypass) {
      loadLiveSummary();
      loadDrawerEntries();
    }
  }, [shift, loadDrawerEntries]);

  useEffect(() => {
    if (!shift?.isOpen || !shift.session?.openedAt) return;
    const tick = () => setElapsed(fmtElapsed(shift.session.openedAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [shift]);

  const handleOpenShift = async () => {
    setLoading(true);
    try {
      await axios.post('/api/shifts/open', {
        openingCash: Number(openingCash || 0),
        shift: shiftType,
      });
      setOpeningCash('');
      await loadStatus();
    } catch (e) {
      alert(e?.response?.data?.message || 'Gagal buka shift.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    const cash = Number(closingCash || 0);
    if (!Number.isFinite(cash) || cash < 0) {
      alert('Total uang tunai di laci tidak valid.');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post('/api/shifts/close', {
        closingCash: cash,
        notes,
      });
      setClosingResult(res?.data?.data || null);
      setClosingCash('');
      setNotes('');
      await loadStatus();
    } catch (e) {
      alert(e?.response?.data?.message || 'Gagal tutup shift.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async () => {
    const amt = Number(String(entryForm.amount).replace(/\D/g, ''));
    if (!amt || amt <= 0) { setEntryError('Jumlah harus lebih dari 0.'); return; }
    if (!entryForm.description?.trim()) { setEntryError('Keterangan wajib diisi.'); return; }
    setEntryLoading(true); setEntryError('');
    try {
      await axios.post('/api/cash-drawer/entry', {
        type: entryForm.type,
        category: entryForm.category,
        amount: amt,
        description: entryForm.description.trim(),
      });
      setEntryForm({ type: 'out', category: 'pengeluaran_operasional', amount: '', description: '' });
      setShowAddEntry(false);
      await loadDrawerEntries();
    } catch (e) {
      setEntryError(e?.response?.data?.message || 'Gagal mencatat entri.');
    } finally {
      setEntryLoading(false);
    }
  };

  const handleDeleteEntry = async (id) => {
    if (!window.confirm('Hapus entri kas ini?')) return;
    try {
      await axios.delete(`/api/cash-drawer/entry/${id}`);
      await loadDrawerEntries();
    } catch (e) {
      alert(e?.response?.data?.message || 'Gagal menghapus entri.');
    }
  };

  const isOpen = !!shift?.isOpen && !shift?.bypass;
  const activeSession = shift?.session;
  const lastClosed = closingResult || shift?.lastClosedSession;
  const paymentSummary = lastClosed?.paymentSummary || [];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Shift Kasir" subtitle="Buka/tutup shift dan rekap pembayaran harian" onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ background: C.white, borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '4px 10px', background: isOpen ? '#DCFCE7' : '#FEE2E2' }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: isOpen ? '#166534' : '#991B1B', animation: isOpen ? 'pulse 2s ease-in-out infinite' : 'none' }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: isOpen ? '#166534' : '#991B1B' }}>
              {isOpen ? `Shift aktif sejak ${fmtTimeOnly(activeSession?.openedAt)}` : 'Shift belum aktif'}
            </span>
          </div>
          {activeSession && (
            <div style={{ marginTop: 8, fontFamily: 'Poppins', fontSize: 12, color: C.n700, lineHeight: 1.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ background: '#EFF6FF', color: '#1D4ED8', fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{SHIFT_LABEL[activeSession.shift] || activeSession.shift}</span>
                {elapsed && <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>⏱ {elapsed} berlalu</span>}
              </div>
              <div>Dibuka: <strong>{fmtDt(activeSession.openedAt)}</strong></div>
              <div>Modal awal: <strong>{rp(activeSession.openingCash || 0)}</strong></div>
            </div>
          )}
        </div>

        {!isOpen && (
          <div style={{ background: C.white, borderRadius: 14, padding: 14, marginBottom: 12 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Buka shift</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginBottom: 6 }}>Jenis shift</div>
              <select value={shiftType} onChange={(e) => setShiftType(e.target.value)} style={{ width: '100%', height: 42, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins' }}>
                <option value="full">Full hari</option>
                <option value="pagi">Pagi</option>
                <option value="siang">Siang</option>
                <option value="malam">Malam</option>
              </select>
            </div>
            <Input label="Modal awal laci (Rp)" type="number" value={openingCash} onChange={setOpeningCash} placeholder="0" />
            <Btn variant="success" fullWidth loading={loading} onClick={handleOpenShift}>Buka shift sekarang</Btn>
          </div>
        )}

        {isOpen && (
          <>
            {/* ── Ringkasan Transaksi Shift ── */}
            <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>Ringkasan Transaksi</div>
                <button onClick={loadLiveSummary} disabled={summaryLoading} style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.primary, background: 'none', border: 'none', cursor: 'pointer' }}>
                  {summaryLoading ? 'Memuat...' : '↻ Refresh'}
                </button>
              </div>

              {/* Stat cards row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                <div style={{ background: '#F0F9FF', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 800, color: '#0C4A6E' }}>{liveSummary?.totalTransactions ?? 0}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#0369A1' }}>Total Transaksi</div>
                </div>
                <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: '#166534' }}>{rp(liveSummary?.totalOmset ?? 0)}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#15803D' }}>Total Omset</div>
                </div>
              </div>

              {/* Per-method breakdown */}
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Rekap per Metode Pembayaran</div>
              {(!liveSummary?.paymentSummary || liveSummary.paymentSummary.length === 0) ? (
                <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, textAlign: 'center', padding: '16px 0' }}>
                  Belum ada transaksi pada shift ini.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {liveSummary.paymentSummary.map((p) => {
                    const meta = METHOD_ICON_COLOR[p.method] || { icon: '💳', bg: C.n50, color: C.n700 };
                    return (
                      <div key={p.method} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: meta.bg, borderRadius: 10 }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{meta.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: meta.color }}>{METHOD_LABEL[p.method] || p.method}</div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: meta.color, opacity: 0.7 }}>{p.count} transaksi</div>
                        </div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: meta.color }}>{rp(p.amount)}</div>
                      </div>
                    );
                  })}
                  {/* Grand total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderTop: `2px solid ${C.n200}`, marginTop: 4 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>Total Semua Metode</span>
                    <span style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 800, color: C.primary }}>{rp(liveSummary.grandTotalPayments || 0)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Panel Kas Laci & Pengeluaran ── */}
            <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>🗄️ Kas Laci</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={loadDrawerEntries} disabled={drawerLoading} style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, background: 'none', border: 'none', cursor: 'pointer' }}>
                    {drawerLoading ? '...' : '↻'}
                  </button>
                  <button
                    onClick={() => { setShowAddEntry(!showAddEntry); setEntryError(''); }}
                    style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: 'white', background: C.primary, border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
                  >
                    {showAddEntry ? 'Tutup' : '+ Catat'}
                  </button>
                </div>
              </div>

              {/* Ringkasan saldo kas laci */}
              {drawerSummary && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
                  {[
                    { label: 'Masuk', val: drawerSummary.totalIn, color: '#166534', bg: '#DCFCE7' },
                    { label: 'Keluar', val: drawerSummary.totalOut, color: '#991B1B', bg: '#FEE2E2' },
                    { label: 'Saldo', val: drawerSummary.balance, color: '#1E40AF', bg: '#DBEAFE' },
                  ].map((s) => (
                    <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: s.color, marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 800, color: s.color }}>{rp(s.val)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Form tambah entri */}
              {showAddEntry && (
                <div style={{ background: C.n50, borderRadius: 12, padding: 12, marginBottom: 12, border: `1.5px solid ${C.n200}` }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n800, marginBottom: 10 }}>Catat Pengeluaran / Kas Masuk</div>

                  {/* Tipe */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    {[['out', '📤 Keluar', '#FEE2E2', '#991B1B'], ['in', '📥 Masuk', '#DCFCE7', '#166534']].map(([val, label, bg, color]) => (
                      <button
                        key={val}
                        onClick={() => setEntryForm(f => ({ ...f, type: val }))}
                        style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: entryForm.type === val ? `2px solid ${color}` : `1.5px solid ${C.n200}`, background: entryForm.type === val ? bg : C.white, fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: entryForm.type === val ? color : C.n600, cursor: 'pointer' }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Kategori */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Kategori</div>
                    <select
                      value={entryForm.category}
                      onChange={(e) => setEntryForm(f => ({ ...f, category: e.target.value }))}
                      style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 10px', background: C.white }}
                    >
                      {entryForm.type === 'out' ? (
                        <>
                          <option value="pengeluaran_operasional">Pengeluaran Operasional</option>
                          <option value="setoran_bank">Setoran Bank</option>
                          <option value="cash_adjustment">Penyesuaian Kas</option>
                          <option value="lainnya">Lainnya</option>
                        </>
                      ) : (
                        <>
                          <option value="modal">Modal / Tambah Kas</option>
                          <option value="cash_adjustment">Penyesuaian Kas</option>
                          <option value="lainnya">Lainnya</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* Jumlah */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Jumlah (Rp)</div>
                    <input
                      type="number"
                      value={entryForm.amount}
                      onChange={(e) => setEntryForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0"
                      style={{ width: '100%', height: 42, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, padding: '0 12px', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Keterangan */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Keterangan <span style={{ color: '#DC2626' }}>*</span></div>
                    <input
                      type="text"
                      value={entryForm.description}
                      onChange={(e) => setEntryForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Contoh: Beli detergen Rinso 2kg"
                      style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', boxSizing: 'border-box' }}
                    />
                  </div>

                  {entryError && <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#DC2626', marginBottom: 8 }}>{entryError}</div>}

                  <button
                    onClick={handleAddEntry}
                    disabled={entryLoading}
                    style={{ width: '100%', height: 42, borderRadius: 10, background: entryForm.type === 'out' ? '#DC2626' : '#16A34A', color: 'white', border: 'none', fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: entryLoading ? 0.6 : 1 }}
                  >
                    {entryLoading ? 'Menyimpan...' : `Simpan ${entryForm.type === 'out' ? 'Pengeluaran' : 'Kas Masuk'}`}
                  </button>
                </div>
              )}

              {/* Riwayat entri */}
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Riwayat Kas Laci</div>
              {drawerLoading ? (
                <div style={{ textAlign: 'center', padding: 16, color: C.n500, fontFamily: 'Poppins', fontSize: 12 }}>Memuat...</div>
              ) : drawerEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 16, color: C.n400, fontFamily: 'Poppins', fontSize: 12 }}>Belum ada entri kas laci shift ini.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {drawerEntries.map((e) => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: e.type === 'out' ? '#FFF5F5' : '#F0FDF4', borderRadius: 10 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{e.type === 'out' ? '📤' : '📥'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: e.type === 'out' ? '#991B1B' : '#166534', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.description || e.categoryLabel}
                        </div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>
                          {e.categoryLabel} · {new Date(e.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: e.type === 'out' ? '#DC2626' : '#16A34A' }}>
                          {e.type === 'out' ? '-' : '+'}{rp(e.amount)}
                        </div>
                        <button
                          onClick={() => handleDeleteEntry(e.id)}
                          style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n400, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Form Tutup Shift ── */}
            <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900, marginBottom: 4 }}>Tutup Shift</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginBottom: 14, lineHeight: 1.5 }}>
                Hitung uang tunai di laci lalu rekonsiliasi. Data tutup shift dan timestamp dikirim ke pusat agar admin dapat memantau disiplin kas per outlet.
              </div>

              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.primary, marginBottom: 6 }}>Total uang tunai di laci (Rp)</div>
              <input
                type="number"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder="0"
                style={{ width: '100%', height: 48, borderRadius: 12, border: `1.5px solid ${C.n300}`, padding: '0 14px', fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n900, boxSizing: 'border-box', marginBottom: 12 }}
              />

              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 6 }}>Catatan (opsional)</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Contoh: selisih karena kembalian"
                style={{ width: '100%', borderRadius: 12, border: `1.5px solid ${C.n300}`, padding: 12, fontFamily: 'Poppins', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', marginBottom: 14 }}
              />

              <Btn variant="danger" fullWidth loading={loading} onClick={handleCloseShift}>
                Tutup shift & simpan
              </Btn>
            </div>
          </>
        )}

        {lastClosed && (
          <div style={{ background: C.white, borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900, marginBottom: 12 }}>Rekap Shift Terakhir</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ background: C.n50, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>Buka</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{fmtDt(lastClosed.openedAt)}</div>
              </div>
              <div style={{ background: C.n50, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>Tutup</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{fmtDt(lastClosed.closedAt)}</div>
              </div>
            </div>

            {/* Reconciliation */}
            <div style={{ background: '#FAFAFA', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              {[
                ['Modal awal', rp(lastClosed.openingCash || 0), null],
                ['+ Penjualan tunai', rp((lastClosed.systemCash || 0) - (lastClosed.openingCash || 0) + (lastClosed.totalExpense || 0)), '#166534'],
                ['− Pengeluaran kas', lastClosed.totalExpense != null ? rp(lastClosed.totalExpense) : '-', '#DC2626'],
                ['= Sistem (seharusnya)', rp(lastClosed.systemCash || 0), '#1D4ED8'],
                ['Fisik di laci', rp(lastClosed.closingCash || 0), null],
              ].map(([label, val, color]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontFamily: 'Poppins', fontSize: 12 }}>
                  <span style={{ color: C.n600 }}>{label}</span>
                  <strong style={{ color: color || C.n900 }}>{val}</strong>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', borderTop: `1.5px solid ${C.n200}`, marginTop: 4, fontFamily: 'Poppins', fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: C.n900 }}>Selisih</span>
                <strong style={{ color: Math.abs(Number(lastClosed.difference ?? lastClosed.cashDiff ?? 0)) >= 10000 ? '#DC2626' : '#166534' }}>
                  {rp(lastClosed.difference ?? lastClosed.cashDiff ?? 0)}
                </strong>
              </div>
            </div>

            {/* Payment methods */}
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Rekap per Metode Pembayaran</div>
            {paymentSummary.length === 0 ? (
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, textAlign: 'center', padding: 12 }}>Belum ada pembayaran tercatat.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {paymentSummary.map((p) => {
                  const meta = METHOD_ICON_COLOR[p.method] || { icon: '💳', bg: C.n50, color: C.n700 };
                  return (
                    <div key={p.method} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: meta.bg, borderRadius: 8 }}>
                      <span style={{ fontSize: 16 }}>{meta.icon}</span>
                      <span style={{ flex: 1, fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: meta.color }}>{METHOD_LABEL[p.method] || p.method} ({p.count}x)</span>
                      <strong style={{ fontFamily: 'Poppins', fontSize: 12, color: meta.color }}>{rp(p.amount || 0)}</strong>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
