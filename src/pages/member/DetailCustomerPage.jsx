import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Avatar, Divider, Chip, SearchBar } from '../../components/ui';
import { alertError, alertSuccess, confirmAction } from '../../utils/alert';

const customerInitials = (c) => {
  if (c?.avatar) return c.avatar;
  const name = c?.name || '';
  return name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
};

export default function DetailCustomerPage({ navigate, goBack, screenParams }) {
  const customerId = screenParams?.id;
  const [customer, setCustomer] = useState(screenParams?.name ? screenParams : null);
  const [customerLoading, setCustomerLoading] = useState(!!customerId && !screenParams?.name);
  const [customerTx, setCustomerTx] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txSearch, setTxSearch] = useState('');
  const [txStatusFilter, setTxStatusFilter] = useState('all'); // all | selesai | proses | diambil | dibatalkan
  const [txPeriodFilter, setTxPeriodFilter] = useState('all'); // all | 30d | 90d | 1y
  const [txPaymentFilter, setTxPaymentFilter] = useState('all'); // all | paid | unpaid | partial
  const [deleting, setDeleting] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [downgrading, setDowngrading] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setCustomer(null);
      setCustomerLoading(false);
      return;
    }
    if (screenParams?.name) {
      setCustomer(screenParams);
      setCustomerLoading(false);
      return;
    }
    const fetchCustomer = async () => {
      setCustomerLoading(true);
      try {
        const res = await axios.get(`/api/customers/${customerId}`);
        setCustomer(res?.data?.data || null);
      } catch {
        setCustomer(null);
      } finally {
        setCustomerLoading(false);
      }
    };
    fetchCustomer();
  }, [customerId, screenParams?.name]);

  const handleUpgrade = async () => {
    const ok = await confirmAction({ text: `Upgrade ${customer.name} menjadi Member Premium? (Otomatis aktif 6 bulan)` });
    if (!ok) return;
    setUpgrading(true);
    try {
      await axios.post(`/api/customers/${customer.id}/upgrade`);
      await alertSuccess('Berhasil! Customer sekarang adalah Member Premium.');
      // Update data di lokal sementara, atau arahkan kembali ke customer list
      navigate('customer');
    } catch (error) {
      console.error('Failed to upgrade:', error);
      alertError(error?.response?.data?.message || 'Gagal melakukan upgrade member.');
    } finally {
      setUpgrading(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirmAction({ text: 'Yakin ingin menghapus customer ini?' });
    if (!ok) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/customers/${customer.id}`);
      await alertSuccess('Customer berhasil dihapus');
      navigate('customer');
    } catch (error) {
      console.error('Failed to delete customer:', error);
      alertError(error?.response?.data?.message || 'Gagal menghapus customer.');
      setDeleting(false);
    }
  };

  const handleDowngrade = async () => {
    const ok = await confirmAction({ text: `Turunkan ${customer.name} menjadi member biasa? Benefit premium akan berhenti.` });
    if (!ok) return;
    setDowngrading(true);
    try {
      await axios.post(`/api/customers/${customer.id}/downgrade`);
      await alertSuccess('Customer berhasil diturunkan menjadi member biasa.');
      navigate('customer');
    } catch (error) {
      console.error('Failed to downgrade:', error);
      alertError(error?.response?.data?.message || 'Gagal menurunkan status member.');
    } finally {
      setDowngrading(false);
    }
  };

  useEffect(() => {
    if (!customer?.id) return;
    const fetch = async () => {
      setTxLoading(true);
      try {
        // Limit lebih tinggi karena ini list per-customer (biasanya tidak akan ratusan)
        const res = await axios.get(`/api/transactions?customerId=${customer.id}&limit=200`);
        setCustomerTx(res?.data?.data || []);
      } catch {
        setCustomerTx([]);
      } finally {
        setTxLoading(false);
      }
    };
    fetch();
  }, [customer?.id]);

  // ─── Filter & summary computation ──────────────────────────────────────────
  const filteredTx = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    const now = Date.now();
    const periodMs = txPeriodFilter === '30d' ? 30 * 86400000
      : txPeriodFilter === '90d' ? 90 * 86400000
      : txPeriodFilter === '1y'  ? 365 * 86400000
      : null;

    return customerTx.filter((tx) => {
      // Status filter
      if (txStatusFilter !== 'all' && tx.status !== txStatusFilter) return false;
      // Payment status filter
      if (txPaymentFilter !== 'all' && tx.paymentStatus !== txPaymentFilter) return false;
      // Period filter
      if (periodMs && tx.date) {
        const txTime = new Date(tx.date).getTime();
        if (now - txTime > periodMs) return false;
      }
      // Search (nota number / catatan)
      if (q) {
        const hay = `${tx.id || ''} ${tx.transactionNo || ''} ${tx.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [customerTx, txStatusFilter, txPaymentFilter, txPeriodFilter, txSearch]);

  const txSummary = useMemo(() => {
    const totalAmount = filteredTx.reduce((s, t) => s + Number(t.total || 0), 0);
    const totalPaid = filteredTx.reduce((s, t) => s + Number(t.paidAmount || 0), 0);
    const cancelledCount = filteredTx.filter(t => t.status === 'dibatalkan').length;
    const completedCount = filteredTx.filter(t => t.status === 'selesai' || t.status === 'diambil').length;
    return {
      count: filteredTx.length,
      totalAmount,
      totalPaid,
      balance: totalAmount - totalPaid,
      cancelledCount,
      completedCount,
    };
  }, [filteredTx]);

  const activeFilterCount = (txStatusFilter !== 'all' ? 1 : 0)
    + (txPaymentFilter !== 'all' ? 1 : 0)
    + (txPeriodFilter !== 'all' ? 1 : 0)
    + (txSearch.trim() ? 1 : 0);

  if (customerLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Poppins', fontSize: 14, color: C.n600 }}>
        Memuat data customer...
      </div>
    );
  }

  if (!customer) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Btn onClick={() => navigate('customer')}>Kembali</Btn></div>;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Detail Customer" onBack={goBack} rightAction={() => navigate('topup_deposit', customer)} rightIcon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Profile card */}
        <div style={{ background: C.white, borderRadius: 16, padding: '20px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Avatar initials={customerInitials(customer)} size={60} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: C.n900 }}>{customer.name}</div>
              {customer.isPremium && <span style={{ background: '#FEF3C7', color: '#B45309', fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>PREMIUM</span>}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600, marginTop: 2 }}>{customer.phone}</div>
            {/* Outlet origin tag */}
            {customer.registeredOutletName && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EDE9FE', padding: '3px 10px', borderRadius: 999, marginTop: 6 }}>
                <span style={{ fontSize: 12 }}>🏪</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#6D28D9' }}>
                  Terdaftar di: {customer.registeredOutletName}
                </span>
              </div>
            )}
            {/* Address info — smart Blok prefix (jangan dobel kalau cascading sudah punya) */}
            {(customer.addressHousing || customer.addressDetail || customer.address) && (() => {
              const block = String(customer.addressBlock || '').trim();
              const blockHasPrefix = /^(blok|cluster|blk|kav)\b/i.test(block);
              const blockDisplay = block ? (blockHasPrefix ? block : `Blk ${block}`) : '';
              return (
                <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  📍 {customer.addressHousing || ''}{blockDisplay ? ` ${blockDisplay}` : ''}{customer.addressNo ? ` No.${customer.addressNo}` : ''}
                  {customer.addressDetail && <span> · {customer.addressDetail}</span>}
                  {!customer.addressHousing && customer.address && <span>{customer.address}</span>}
                </div>
              );
            })()}
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: C.primary }}>{customer.totalTx}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>Transaksi</div>
            </div>
            <div style={{ width: 1, background: C.n100 }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.success }}>{rp(customer.deposit || 0)}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>Deposit</div>
            </div>
            <div style={{ width: 1, background: C.n100 }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: C.warning }}>
                {(customer.loyaltyPoints ?? customer.poin ?? 0).toLocaleString('id-ID')}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>Poin</div>
            </div>
          </div>
        </div>

        {/* Membership Card — kalau aktif */}
        {customer.membership && customer.isPremium && !customer.membership.isExpired && (
          <div style={{
            background: 'linear-gradient(135deg, #5B21B6, #7C3AED)',
            borderRadius: 16, padding: '14px 16px', marginBottom: 12,
            boxShadow: '0 4px 16px rgba(124,58,237,0.25)',
            color: 'white',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>👑</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>MEMBER PREMIUM</span>
              </div>
              <span style={{ fontFamily: 'Poppins', fontSize: 10, opacity: 0.85 }}>
                {customer.membership.memberNo}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.7, marginBottom: 2 }}>DISKON</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800 }}>
                  {Number(customer.membership.discountPct).toFixed(0)}%
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.7, marginBottom: 2 }}>BERLAKU SAMPAI</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700 }}>
                  {customer.membership.expiredAt
                    ? new Date(customer.membership.expiredAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.7, marginBottom: 2 }}>TOP-UP</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700 }}>
                  {customer.membership.topupCount}×
                </div>
              </div>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, opacity: 0.75, marginTop: 8, lineHeight: 1.4 }}>
              💡 Setiap top-up Rp 500.000+, masa berlaku otomatis +6 bulan
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <Btn variant="primary" onClick={() => navigate('nota_step1', { preCustomer: customer })} style={{ flex: 1 }}>Buat Nota</Btn>
          <Btn variant="secondary" onClick={() => navigate('topup_deposit', customer)} style={{ flex: 1 }}>Top Up Deposit</Btn>
        </div>
        
        {!customer.isPremium && (
          <div style={{ marginBottom: 12 }}>
            <Btn variant="secondary" onClick={handleUpgrade} loading={upgrading} fullWidth style={{ background: '#FEF3C7', color: '#B45309', border: 'none', fontWeight: 700 }}>
              ⭐ Upgrade ke Member Premium
            </Btn>
          </div>
        )}

        {customer.isPremium && (
          <div style={{ marginBottom: 12 }}>
            <Btn variant="secondary" onClick={handleDowngrade} loading={downgrading} fullWidth style={{ background: '#FEF2F2', color: C.danger, border: 'none', fontWeight: 700 }}>
              ↩️ Turunkan ke Member Biasa
            </Btn>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <Btn variant="secondary" onClick={() => navigate('tambah_customer', customer)} style={{ flex: 1, border: `1px solid ${C.primary}`, color: C.primary }}>✏️ Edit Customer</Btn>
          <Btn variant="secondary" onClick={handleDelete} loading={deleting} style={{ flex: 1, border: `1px solid ${C.error}`, color: C.error }}>🗑️ Hapus</Btn>
        </div>

        {/* ── Transaction history ── */}
        <div style={{
          background: 'white', borderRadius: 14, padding: '12px 14px', marginBottom: 12,
          boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>
              📜 Riwayat Transaksi
            </div>
            {customerTx.length > 0 && (
              <div style={{
                fontFamily: 'Poppins', fontSize: 10, fontWeight: 700,
                color: C.n500, background: C.n50,
                padding: '3px 10px', borderRadius: 999,
              }}>
                {customerTx.length} total
              </div>
            )}
          </div>

          {/* Filter & Search */}
          {customerTx.length > 0 && (
            <>
              <div style={{ marginBottom: 8 }}>
                <SearchBar value={txSearch} onChange={setTxSearch} placeholder="Cari nota / catatan..." />
              </div>

              {/* Period filter */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {[
                  { v: 'all', l: 'Semua waktu' },
                  { v: '30d', l: '30 hari' },
                  { v: '90d', l: '3 bulan' },
                  { v: '1y',  l: '1 tahun' },
                ].map(p => (
                  <Chip
                    key={p.v}
                    label={p.l}
                    active={txPeriodFilter === p.v}
                    onClick={() => setTxPeriodFilter(p.v)}
                  />
                ))}
              </div>

              {/* Status filter */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {[
                  { v: 'all', l: 'Semua status' },
                  { v: 'proses', l: '⏳ Proses' },
                  { v: 'selesai', l: '✅ Selesai' },
                  { v: 'diambil', l: '📦 Diambil' },
                  { v: 'dibatalkan', l: '❌ Batal' },
                ].map(p => (
                  <Chip
                    key={p.v}
                    label={p.l}
                    active={txStatusFilter === p.v}
                    onClick={() => setTxStatusFilter(p.v)}
                  />
                ))}
              </div>

              {/* Payment filter */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {[
                  { v: 'all', l: 'Semua bayar' },
                  { v: 'paid', l: '💰 Lunas' },
                  { v: 'partial', l: '🔸 Sebagian' },
                  { v: 'unpaid', l: '⚠️ Belum bayar' },
                ].map(p => (
                  <Chip
                    key={p.v}
                    label={p.l}
                    active={txPaymentFilter === p.v}
                    onClick={() => setTxPaymentFilter(p.v)}
                  />
                ))}
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setTxSearch(''); setTxStatusFilter('all');
                    setTxPaymentFilter('all'); setTxPeriodFilter('all');
                  }}
                  style={{
                    width: '100%', padding: '6px 10px', marginBottom: 10,
                    background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8,
                    color: '#92400E', fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hapus {activeFilterCount} filter
                </button>
              )}
            </>
          )}

          {/* List */}
          {txLoading ? (
            <div style={{ textAlign: 'center', padding: 30, color: C.n500, fontFamily: 'Poppins', fontSize: 13 }}>
              Memuat transaksi...
            </div>
          ) : customerTx.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: C.n500, fontFamily: 'Poppins', fontSize: 13 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🧾</div>
              Customer ini belum punya transaksi
            </div>
          ) : filteredTx.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: C.n500, fontFamily: 'Poppins', fontSize: 12 }}>
              Tidak ada transaksi sesuai filter
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredTx.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => navigate('detail_transaksi', tx)}
                  style={{
                    background: C.n50, borderRadius: 10,
                    padding: '10px 12px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n900,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {tx.id}
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 1 }}>
                      {tx.date}
                      {tx.paymentStatus === 'unpaid' && <span style={{ color: '#DC2626', fontWeight: 600 }}> · belum bayar</span>}
                      {tx.paymentStatus === 'partial' && <span style={{ color: '#F59E0B', fontWeight: 600 }}> · partial</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.primary }}>
                      {rp(tx.total)}
                    </div>
                    <span style={{
                      fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
                      padding: '2px 7px', borderRadius: 999,
                      background: tx.status === 'selesai' ? '#DCFCE7'
                        : tx.status === 'diambil' ? '#DBEAFE'
                        : tx.status === 'dibatalkan' ? '#FEE2E2'
                        : '#FEF3C7',
                      color: tx.status === 'selesai' ? '#15803D'
                        : tx.status === 'diambil' ? '#1E40AF'
                        : tx.status === 'dibatalkan' ? '#991B1B'
                        : '#92400E',
                    }}>{tx.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer summary — total rupiah & jumlah transaksi yang sedang difilter */}
          {!txLoading && customerTx.length > 0 && filteredTx.length > 0 && (
            <div style={{
              marginTop: 12, padding: '12px 14px',
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              borderRadius: 12, color: 'white',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, opacity: 0.85, fontWeight: 600 }}>
                    {activeFilterCount > 0 ? '🔍 SESUAI FILTER' : '📊 SEMUA TRANSAKSI'}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                    <strong>{txSummary.count}</strong> transaksi
                    {txSummary.completedCount > 0 && ` · ${txSummary.completedCount} selesai`}
                    {txSummary.cancelledCount > 0 && ` · ${txSummary.cancelledCount} batal`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.85 }}>TOTAL NILAI</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800 }}>
                    {rp(txSummary.totalAmount)}
                  </div>
                </div>
              </div>
              <div style={{
                paddingTop: 8,
                borderTop: '1px solid rgba(255,255,255,0.18)',
                display: 'flex', justifyContent: 'space-between',
                fontFamily: 'Poppins', fontSize: 10, opacity: 0.9,
              }}>
                <span>💰 Sudah dibayar: <strong>{rp(txSummary.totalPaid)}</strong></span>
                {txSummary.balance > 0 && (
                  <span>⚠️ Belum lunas: <strong>{rp(txSummary.balance)}</strong></span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
