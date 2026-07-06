import { useState, useEffect } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Modal, Chip } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';

const EMPTY_FORM = { name: '', outletCode: '', address: '', phone: '', email: '' };

export default function ManajemenOutletPage({ navigate, goBack }) {
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, active, inactive

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Confirm toggle
  const [confirmToggle, setConfirmToggle] = useState(null);

  const fetchOutlets = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/outlets/admin/all');
      setOutlets(res?.data?.data || []);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal memuat data outlet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOutlets(); }, []);

  const filtered = outlets.filter((o) => {
    if (filter === 'active') return o.isActive;
    if (filter === 'inactive') return !o.isActive;
    return true;
  });

  const openCreate = () => {
    setEditingOutlet(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (o) => {
    setEditingOutlet(o);
    setForm({
      name: o.name || '',
      outletCode: o.outletCode || '',
      address: o.address || '',
      phone: o.phone || '',
      email: o.email || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.outletCode.trim()) {
      alertWarning('Nama dan kode outlet wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingOutlet) {
        await axios.put(`/api/outlets/${editingOutlet.id}`, form);
        alertSuccess('Outlet berhasil diperbarui.');
      } else {
        await axios.post('/api/outlets', form);
        alertSuccess('Outlet baru berhasil dibuat.');
      }
      setShowForm(false);
      fetchOutlets();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyimpan outlet.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (outlet) => {
    try {
      await axios.patch(`/api/outlets/${outlet.id}/toggle`, { isActive: !outlet.isActive });
      alertSuccess(`Outlet ${!outlet.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`);
      setConfirmToggle(null);
      fetchOutlets();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal mengubah status.');
    }
  };

  const handleDelete = async (outlet) => {
    const { confirmAction } = await import('../../utils/alert');
    const ok = await confirmAction({
      text: `Hapus outlet "${outlet.name}"? Outlet akan diarsipkan dan semua user terkait dinonaktifkan.`,
    });
    if (!ok) return;
    try {
      await axios.delete(`/api/outlets/${outlet.id}`);
      alertSuccess(`Outlet "${outlet.name}" berhasil dihapus.`);
      fetchOutlets();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menghapus outlet.');
    }
  };

  const totalRevenue = outlets.reduce((s, o) => s + o.monthlyRevenue, 0);
  const activeCount = outlets.filter(o => o.isActive).length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Manajemen Outlet" subtitle={`${outlets.length} outlet terdaftar`} onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: '10px 12px', textAlign: 'center', boxShadow: SHADOW.sm }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 600, color: C.primary }}>{outlets.length}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600, fontWeight: 600 }}>TOTAL</div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: '10px 12px', textAlign: 'center', boxShadow: SHADOW.sm }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 600, color: C.success }}>{activeCount}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600, fontWeight: 600 }}>AKTIF</div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: '10px 12px', textAlign: 'center', boxShadow: SHADOW.sm }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.primary }}>{rp(totalRevenue)}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600, fontWeight: 600 }}>OMSET 30H</div>
          </div>
        </div>

        {/* Filter + Add */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            <Chip label="Semua" active={filter === 'all'} onClick={() => setFilter('all')} />
            <Chip label="Aktif" active={filter === 'active'} onClick={() => setFilter('active')} />
            <Chip label="Nonaktif" active={filter === 'inactive'} onClick={() => setFilter('inactive')} />
          </div>
          <button
            onClick={openCreate}
            style={{
              padding: '8px 14px', borderRadius: 10, border: 'none',
              background: C.primary, color: 'white',
              fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Outlet
          </button>
        </div>

        {/* Outlet list */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${C.n200}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Memuat outlet…</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, background: 'white', borderRadius: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏪</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n600 }}>Tidak ada outlet</div>
          </div>
        )}

        {!loading && filtered.map((o) => {
          const pctTarget = o.targetAmount ? Math.min(100, Math.round((o.monthlyRevenue / o.targetAmount) * 100)) : null;
          return (
            <div key={o.id} style={{
              background: 'white', borderRadius: 16, padding: '14px 16px',
              marginBottom: 10, boxShadow: SHADOW.md,
              border: `1.5px solid ${o.isActive ? C.n100 : C.validationErrorBorder}`,
              opacity: o.isActive ? 1 : 0.75,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: o.isActive ? `${C.primary}14` : C.dangerBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>
                  🏪
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{o.name}</span>
                    <span style={{
                      fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
                      padding: '1px 6px', borderRadius: 999,
                      background: o.isActive ? C.successBg : C.dangerBg,
                      color: o.isActive ? C.successDark : C.validationErrorText,
                    }}>
                      {o.isActive ? '● Aktif' : '● Nonaktif'}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>
                    {o.outletCode} {o.address ? `· ${o.address}` : ''}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 12, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.n100}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600, fontWeight: 600 }}>TIM</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n800 }}>{o.teamCount}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600, fontWeight: 600 }}>LAYANAN</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n800 }}>{o.serviceCount}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600, fontWeight: 600 }}>TX/30H</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n800 }}>{o.monthlyTxCount}</div>
                </div>
                <div style={{ flex: 1.5 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600, fontWeight: 600 }}>OMSET/30H</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.primary }}>{rp(o.monthlyRevenue)}</div>
                </div>
              </div>

              {/* Target progress */}
              {pctTarget !== null && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600 }}>Target bulan ini</span>
                    <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: pctTarget >= 100 ? C.success : pctTarget >= 70 ? C.warning : C.danger }}>{pctTarget}%</span>
                  </div>
                  <div style={{ height: 5, background: C.n100, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pctTarget}%`, background: pctTarget >= 100 ? C.success : pctTarget >= 70 ? C.warning : C.danger, borderRadius: 3 }} />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => openEdit(o)}
                  style={{ flex: 1, height: 34, borderRadius: 8, border: `1.5px solid ${C.n200}`, background: 'white', fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, cursor: 'pointer' }}
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => navigate('kasir_laporan', { outletId: o.id })}
                  style={{ flex: 1, height: 34, borderRadius: 8, border: `1.5px solid ${C.primary}30`, background: `${C.primary}08`, fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.primary, cursor: 'pointer' }}
                >
                  📊 Laporan
                </button>
                <button
                  onClick={() => handleDelete(o)}
                  style={{ flex: 1, height: 34, borderRadius: 8, border: `1.5px solid ${C.validationErrorBorder}`, background: C.validationErrorBg, fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.danger, cursor: 'pointer' }}
                >
                  🗑️ Hapus
                </button>
                <button
                  onClick={() => setConfirmToggle(o)}
                  style={{
                    flex: 1, height: 34, borderRadius: 8, border: 'none',
                    background: o.isActive ? C.dangerBg : C.successBg,
                    fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                    color: o.isActive ? C.validationErrorText : C.successDark, cursor: 'pointer',
                  }}
                >
                  {o.isActive ? '⏸ Nonaktif' : '▶ Aktifkan'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/Edit Modal */}
      <Modal visible={showForm} onClose={() => setShowForm(false)} title={editingOutlet ? 'Edit Outlet' : 'Outlet Baru'}>
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4, display: 'block' }}>Kode Outlet *</label>
              <input
                value={form.outletCode}
                onChange={(e) => setForm({ ...form, outletCode: e.target.value })}
                placeholder="cth: RAFFLES"
                style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4, display: 'block' }}>Nama Outlet *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="cth: Waschen Laundry Raffles Hills"
                style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4, display: 'block' }}>Alamat</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Alamat lengkap outlet"
                style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4, display: 'block' }}>Telepon</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="08xx"
                  style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4, display: 'block' }}>Email</label>
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@outlet.com"
                  style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button
              onClick={() => setShowForm(false)}
              style={{ flex: 1, height: 40, borderRadius: 10, border: `1.5px solid ${C.n200}`, background: 'white', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, cursor: 'pointer' }}
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ flex: 2, height: 40, borderRadius: 10, border: 'none', background: C.primary, fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: 'white', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? 'Menyimpan…' : editingOutlet ? 'Simpan Perubahan' : 'Buat Outlet'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm toggle modal */}
      {confirmToggle && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setConfirmToggle(null)}
        >
          <div
            style={{ width: '100%', maxWidth: 340, background: 'white', borderRadius: 18, padding: 20, boxShadow: SHADOW.lg }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{confirmToggle.isActive ? '⏸' : '▶'}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: C.n900 }}>
                {confirmToggle.isActive ? 'Nonaktifkan' : 'Aktifkan'} Outlet?
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 4 }}>
                <strong>{confirmToggle.name}</strong>
                {confirmToggle.isActive
                  ? ' tidak akan menerima transaksi baru.'
                  : ' akan kembali aktif dan bisa menerima transaksi.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmToggle(null)}
                style={{ flex: 1, height: 40, borderRadius: 10, border: `1.5px solid ${C.n200}`, background: 'white', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                onClick={() => handleToggle(confirmToggle)}
                style={{
                  flex: 1, height: 40, borderRadius: 10, border: 'none',
                  background: confirmToggle.isActive ? C.danger : C.success,
                  fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: 'white', cursor: 'pointer',
                }}
              >
                {confirmToggle.isActive ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
