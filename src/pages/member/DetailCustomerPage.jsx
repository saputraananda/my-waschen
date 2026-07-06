import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Avatar, Divider, Chip, SearchBar, Modal } from '../../components/ui';
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
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [membershipData, setMembershipData] = useState(null);
  const [membershipLoading, setMembershipLoading] = useState(false);

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

  // ─── Fetch Membership Data (WPC) ────────────────────────────────────────────
  useEffect(() => {
    if (!customerId) {
      setMembershipData(null);
      return;
    }
    const fetchMembership = async () => {
      setMembershipLoading(true);
      try {
        const res = await axios.get(`/api/membership/status/${customerId}`);
        if (res?.data?.success && res.data.data?.hasMembership) {
          setMembershipData(res.data.data);
        } else {
          setMembershipData(null);
        }
      } catch {
        setMembershipData(null);
      } finally {
        setMembershipLoading(false);
      }
    };
    fetchMembership();
  }, [customerId]);

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
      <TopBar title="Detail Customer" onBack={goBack} rightAction={() => setShowExportModal(true)} rightIcon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Profile card */}
        <div style={{ background: C.white, borderRadius: 16, padding: '20px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Avatar initials={customerInitials(customer)} size={60} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: C.n900 }}>{customer.name}</div>
              {customer.isPremium && <span style={{ background: C.validationWarningBg, color: C.validationWarningText, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>PREMIUM</span>}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600, marginTop: 2 }}>{customer.phone}</div>
            {/* Outlet origin tag */}
            {customer.registeredOutletName && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.primaryTint2, padding: '3px 10px', borderRadius: 999, marginTop: 6 }}>
                <span style={{ fontSize: 12 }}>🏪</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.primary }}>
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

        {/* Membership Card — WPC Membership dengan Tier Gold/Diamond */}
        {membershipData && (
          <div style={{
            background: membershipData.isActive
              ? 'linear-gradient(135deg, #5B005F, #4D0051)'
              : 'linear-gradient(135deg, #DC2626, #991B1B)',
            borderRadius: 16, padding: '14px 16px', marginBottom: 12,
            boxShadow: '0 4px 16px rgba(110,46,120,0.25)',
            color: 'white',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>{membershipData.tier === 'diamond' ? '💎' : '🥇'}</span>
                <span style={{ fontFamily: 'Poppins', size: 11, fontWeight: 700, letterSpacing: 0.5 }}>
                  WPC {membershipData.tier === 'diamond' ? 'DIAMOND' : 'GOLD'} MEMBER
                </span>
              </div>
              <span style={{ fontFamily: 'Poppins', fontSize: 10, opacity: 0.85 }}>
                {membershipData.memberNo || membershipData.id}
              </span>
            </div>

            {membershipData.isActive ? (
              <>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.7, marginBottom: 2 }}>DISKON</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800 }}>
                      {membershipData.discountPct}%
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.7, marginBottom: 2 }}>BERLAKU SAMPAI</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700 }}>
                      {membershipData.expiredAt
                        ? new Date(membershipData.expiredAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.7, marginBottom: 2 }}>SISA HARI</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800 }}>
                      {membershipData.daysUntilExpiry > 0 ? membershipData.daysUntilExpiry : 0}
                    </div>
                  </div>
                </div>

                {/* Expiry Warning */}
                {membershipData.isExpiringSoon && (
                  <div style={{
                    background: 'rgba(254, 243, 199, 0.2)',
                    borderRadius: 8, padding: '8px 10px', marginTop: 10,
                    fontFamily: 'Poppins', fontSize: 10,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    ⚠️ Membership akan expired dalam {membershipData.daysUntilExpiry} hari. Segera renew!
                  </div>
                )}

                {/* Benefits */}
                {membershipData.benefits && membershipData.benefits.length > 0 && (
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, opacity: 0.75, marginTop: 8, lineHeight: 1.4 }}>
                    ✨ {membershipData.benefits.join(' • ')}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, opacity: 0.9, marginBottom: 8 }}>
                  {membershipData.status === 'expired'
                    ? '⚠️ Membership sudah expired'
                    : '❌ Membership tidak aktif'}
                </div>
                {membershipData.canRenew && (
                  <Btn
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('membership_register', customer)}
                    style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                  >
                    🔄 Renew Membership
                  </Btn>
                )}
              </>
            )}
          </div>
        )}

        {/* Tombol untuk customer non-member */}
        {!membershipLoading && !membershipData && (
          <div style={{ marginBottom: 12 }}>
            <Btn
              variant="secondary"
              onClick={() => navigate('membership_register', customer)}
              fullWidth
              style={{ background: C.validationWarningBg, color: C.validationWarningText, border: 'none', fontWeight: 700 }}
            >
              🎁 Daftar WPC Membership
            </Btn>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <Btn variant="primary" onClick={() => navigate('nota_step1', { preCustomer: customer })} style={{ flex: 1 }}>Buat Nota</Btn>
          <Btn variant="secondary" onClick={() => navigate('topup_deposit', customer)} style={{ flex: 1 }}>Top Up Deposit</Btn>
        </div>

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
                color: C.n600, background: C.n50,
                padding: '3px 10px', borderRadius: 999,
              }}>
                {customerTx.length} total
              </div>
            )}
          </div>

          {/* Search + Filter Button */}
          {customerTx.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <SearchBar value={txSearch} onChange={setTxSearch} placeholder="Cari nota / catatan..." />
              </div>
              <button
                onClick={() => setShowFilterModal(true)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 14px',
                  background: activeFilterCount > 0 ? C.primary : C.n50,
                  color: activeFilterCount > 0 ? 'white' : C.n700,
                  border: activeFilterCount > 0 ? 'none' : `1px solid ${C.n200}`,
                  borderRadius: 10,
                  fontFamily: 'Poppins',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                Filter
                {activeFilterCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    minWidth: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: C.danger,
                    color: 'white',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '0 6px',
                  }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* List */}
          {txLoading ? (
            <div style={{ textAlign: 'center', padding: 30, color: C.n600, fontFamily: 'Poppins', fontSize: 13 }}>
              Memuat transaksi...
            </div>
          ) : customerTx.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: C.n600, fontFamily: 'Poppins', fontSize: 13 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🧾</div>
              Customer ini belum punya transaksi
            </div>
          ) : filteredTx.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: C.n600, fontFamily: 'Poppins', fontSize: 12 }}>
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
                      {tx.paymentStatus === 'unpaid' && <span style={{ color: C.danger, fontWeight: 600 }}> · belum bayar</span>}
                      {tx.paymentStatus === 'partial' && <span style={{ color: C.warning, fontWeight: 600 }}> · partial</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.primary }}>
                      {rp(tx.total)}
                    </div>
                    <span style={{
                      fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
                      padding: '2px 7px', borderRadius: 999,
                      background: tx.status === 'selesai' ? C.selesaiBg
                        : tx.status === 'diambil' ? C.infoBg
                        : tx.status === 'dibatalkan' ? C.batalBg
                        : C.prosesBg,
                      color: tx.status === 'selesai' ? C.selesaiText
                        : tx.status === 'diambil' ? C.infoText
                        : tx.status === 'dibatalkan' ? C.batalText
                        : C.prosesText,
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
              background: 'linear-gradient(135deg, #4F46E5, #6e2e78)',
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

      {/* Export Modal */}
      {showExportModal && (
        <Modal visible onClose={() => setShowExportModal(false)} title="Export Riwayat Transaksi">
          <div style={{ padding: '8px 18px 18px' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginBottom: 12 }}>
              Export riwayat transaksi {customer?.name} ke format Excel atau PDF.
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>📅 Dari Tanggal (opsional)</div>
              <input
                type="date"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
                style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n200}`, padding: '0 12px', fontFamily: 'Poppins', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>📅 Sampai Tanggal (opsional)</div>
              <input
                type="date"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
                style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n200}`, padding: '0 12px', fontFamily: 'Poppins', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" onClick={() => setShowExportModal(false)} style={{ flex: 1 }}>Batal</Btn>
              <Btn
                variant="primary"
                onClick={async () => {
                  if (!customer?.id) return;
                  setExporting(true);
                  try {
                    const params = {};
                    if (exportFrom) params.from = exportFrom;
                    if (exportTo) params.to = exportTo;
                    // Use axios with responseType blob
                    const res = await axios.get(`/api/customers/${customer.id}/transactions/export?format=xlsx`, { params, responseType: 'blob' });
                    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `transaksi_${customer.name}_${new Date().toISOString().slice(0, 10)}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    await alertSuccess('Export Excel berhasil diunduh.');
                    setShowExportModal(false);
                  } catch (err) {
                    alertError(err?.response?.data?.message || 'Gagal export Excel.');
                  } finally {
                    setExporting(false);
                  }
                }}
                loading={exporting}
                style={{ flex: 1 }}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
              >
                📊 Excel
              </Btn>
              <Btn
                variant="primary"
                onClick={async () => {
                  if (!customer?.id) return;
                  setExporting(true);
                  try {
                    const params = { format: 'pdf' };
                    if (exportFrom) params.from = exportFrom;
                    if (exportTo) params.to = exportTo;
                    const res = await axios.get(`/api/customers/${customer.id}/transactions/export`, { params, responseType: 'blob' });
                    const blob = new Blob([res.data], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `transaksi_${customer.name}_${new Date().toISOString().slice(0, 10)}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    await alertSuccess('Export PDF berhasil diunduh.');
                    setShowExportModal(false);
                  } catch (err) {
                    alertError(err?.response?.data?.message || 'Gagal export PDF.');
                  } finally {
                    setExporting(false);
                  }
                }}
                loading={exporting}
                style={{ flex: 1 }}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
              >
                📄 PDF
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div
          onClick={() => setShowFilterModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '80vh',
              background: 'white',
              borderRadius: '20px 20px 0 0',
              padding: '20px 16px 24px',
              animation: 'slideUp 0.25s ease-out',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: `2px solid ${C.n100}`,
            }}>
              <div style={{
                fontFamily: 'Poppins',
                fontSize: 16,
                fontWeight: 700,
                color: C.n900,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                Filter Transaksi
              </div>
              <button
                onClick={() => setShowFilterModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 8,
                  cursor: 'pointer',
                  color: C.n600,
                  display: 'flex',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Period Filter */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontFamily: 'Poppins',
                fontSize: 12,
                fontWeight: 600,
                color: C.n700,
                marginBottom: 8,
              }}>
                📅 Periode Waktu
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { v: 'all', l: 'Semua waktu' },
                  { v: '30d', l: '30 hari terakhir' },
                  { v: '90d', l: '3 bulan terakhir' },
                  { v: '1y',  l: '1 tahun terakhir' },
                ].map(p => (
                  <Chip
                    key={p.v}
                    label={p.l}
                    active={txPeriodFilter === p.v}
                    onClick={() => setTxPeriodFilter(p.v)}
                  />
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontFamily: 'Poppins',
                fontSize: 12,
                fontWeight: 600,
                color: C.n700,
                marginBottom: 8,
              }}>
                📊 Status Transaksi
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { v: 'all', l: 'Semua status' },
                  { v: 'proses', l: '⏳ Proses' },
                  { v: 'selesai', l: '✅ Selesai' },
                  { v: 'diambil', l: '📦 Diambil' },
                  { v: 'dibatalkan', l: '❌ Dibatalkan' },
                ].map(p => (
                  <Chip
                    key={p.v}
                    label={p.l}
                    active={txStatusFilter === p.v}
                    onClick={() => setTxStatusFilter(p.v)}
                  />
                ))}
              </div>
            </div>

            {/* Payment Filter */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontFamily: 'Poppins',
                fontSize: 12,
                fontWeight: 600,
                color: C.n700,
                marginBottom: 8,
              }}>
                💰 Status Pembayaran
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { v: 'all', l: 'Semua' },
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
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              {activeFilterCount > 0 && (
                <Btn
                  variant="secondary"
                  onClick={() => {
                    setTxStatusFilter('all');
                    setTxPaymentFilter('all');
                    setTxPeriodFilter('all');
                  }}
                  style={{ flex: 1, border: `1px solid ${C.n300}`, color: C.n700 }}
                >
                  Reset
                </Btn>
              )}
              <Btn
                variant="primary"
                onClick={() => setShowFilterModal(false)}
                style={{ flex: activeFilterCount > 0 ? 1 : 'auto', minWidth: 120 }}
              >
                {activeFilterCount > 0 ? `Terapkan (${activeFilterCount})` : 'Tutup'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
