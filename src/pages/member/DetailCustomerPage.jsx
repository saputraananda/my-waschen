import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Divider, Chip, SearchBar, Modal, ProfileAvatar } from '../../components/ui';
import { alertError, alertSuccess, confirmAction } from '../../utils/alert';
import { useResponsive } from '../../utils/hooks';

// Glass card CSS class - injected once
const GLASS_STYLES_DETAIL = `
  :root {
    --purple-deep: #3B0B47;
    --purple-mid: #5C1A6B;
    --magenta: #C0247D;
    --magenta-soft: #E85AA8;
    --mint: #5FD9AE;
    --mint-deep: #1F9E75;
    --coral: #F0466B;
    --coral-deep: #B82848;
    --glass-bg: #F3EEF7;
    --glass: rgba(255, 255, 255, 0.7);
    --glass-strong: rgba(255, 255, 255, 0.85);
    --ink: #2B1130;
    --ink-soft: #7A6584;
  }

  .glass-card-detail {
    background: var(--glass-strong);
    backdrop-filter: blur(18px) saturate(160%);
    -webkit-backdrop-filter: blur(18px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 24px;
    box-shadow:
      0 20px 40px -12px rgba(59, 11, 71, 0.22),
      0 4px 12px rgba(59, 11, 71, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }

  .clay-avatar-detail {
    border-radius: 20px;
    background: linear-gradient(145deg, #FFFFFF, #E9D3F2);
    box-shadow:
      -5px -5px 14px rgba(255, 255, 255, 0.7),
      6px 8px 18px rgba(59, 11, 71, 0.28),
      inset 0 1px 2px rgba(255, 255, 255, 0.6);
    position: relative;
  }

  .clay-btn-primary {
    border-radius: 14px;
    background: linear-gradient(145deg, #6B2D7E, #4A1A59);
    box-shadow:
      -4px -4px 10px rgba(255, 255, 255, 0.4),
      5px 6px 14px rgba(59, 11, 71, 0.35),
      inset 0 1px 1px rgba(255, 255, 255, 0.3);
  }

  .clay-btn-secondary {
    border-radius: 14px;
    background: linear-gradient(145deg, #F5E9FB, #E9D3F2);
    box-shadow:
      -4px -4px 10px rgba(255, 255, 255, 0.6),
      5px 6px 14px rgba(59, 11, 71, 0.2),
      inset 0 1px 1px rgba(255, 255, 255, 0.5);
  }

  .clay-btn-success {
    border-radius: 14px;
    background: linear-gradient(150deg, #7DEFC4 0%, #45C593 100%);
    box-shadow:
      -4px -4px 10px rgba(255, 255, 255, 0.6),
      5px 6px 14px rgba(31, 158, 117, 0.4),
      inset 0 1px 1px rgba(255, 255, 255, 0.5);
  }

  .clay-btn-danger {
    border-radius: 14px;
    background: linear-gradient(150deg, #FF7D93 0%, #E23A5C 100%);
    box-shadow:
      -4px -4px 10px rgba(255, 255, 255, 0.4),
      5px 6px 14px rgba(184, 40, 72, 0.4),
      inset 0 1px 1px rgba(255, 255, 255, 0.35);
  }

  .stat-card {
    border-radius: 18px;
    background: linear-gradient(145deg, rgba(255,255,255,0.9), rgba(233,211,242,0.6));
    box-shadow:
      -4px -4px 12px rgba(255, 255, 255, 0.7),
      4px 6px 14px rgba(59, 11, 71, 0.15),
      inset 0 1px 1px rgba(255, 255, 255, 0.8);
  }

  /* Header gradient with blobs */
  .header {
    background:
      radial-gradient(circle at 85% -10%, rgba(232,90,168,0.55) 0%, transparent 55%),
      radial-gradient(circle at -10% 20%, rgba(95,217,174,0.25) 0%, transparent 45%),
      linear-gradient(155deg, var(--purple-deep) 0%, var(--purple-mid) 55%, #4A1259 100%);
    position: relative;
    overflow: hidden;
  }

  .blob {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(18px);
  }

  .blob-1 {
    width: 180px;
    height: 180px;
    background: radial-gradient(circle, rgba(232,90,168,0.55) 0%, transparent 70%);
    top: -60px;
    right: -40px;
    animation: floatB 11s ease-in-out infinite;
  }

  .blob-2 {
    width: 150px;
    height: 150px;
    background: radial-gradient(circle, rgba(95,217,174,0.35) 0%, transparent 70%);
    bottom: 20px;
    left: -50px;
    animation: floatC 16s ease-in-out infinite;
  }

  .blob-3 {
    width: 90px;
    height: 90px;
    background: radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%);
    top: 40px;
    left: 55%;
    animation: floatA 9s ease-in-out infinite;
  }

  @keyframes floatA { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-14px, 16px) scale(1.08); } }
  @keyframes floatB { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(18px, -12px) scale(1.1); } }
  @keyframes floatC { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(16px, 10px) scale(0.95); } }

  @media (prefers-reduced-motion: reduce) { .blob-1, .blob-2, .blob-3 { animation: none; } }
`;

// Inject styles on mount
function useGlassStylesDetail() {
  useEffect(() => {
    const styleId = 'glass-detail-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = GLASS_STYLES_DETAIL;
      document.head.appendChild(style);
    }
    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, []);
}

// Customer avatar component with clay style + editable
function CustomerAvatar({ customer, size = 80, editable = false, onEdit }) {
  useGlassStylesDetail();
  const fileInputRef = useRef(null);

  const handleAvatarClick = () => {
    if (editable && onEdit) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      className="clay-avatar-detail"
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
        cursor: editable ? 'pointer' : 'default',
      }}
      onClick={handleAvatarClick}
    >
      {customer?.photo ? (
        <img
          src={customer.photo}
          alt={customer?.name || 'avatar'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <ProfileAvatar
          user={{ ...customer, type: 'customer' }}
          size={size}
          showBorder={false}
          style={{ width: size, height: size }}
        />
      )}

      {/* Edit overlay */}
      {editable && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(59, 11, 71, 0.75)',
            backdropFilter: 'blur(4px)',
            padding: '6px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.white }}>Ubah</span>
        </div>
      )}

      {/* Hidden file input for photo upload */}
      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onEdit) {
              onEdit(file);
            }
            e.target.value = '';
          }}
        />
      )}
    </div>
  );
}

export default function DetailCustomerPage({ navigate, goBack, screenParams }) {
  const customerId = screenParams?.id;
  const { isMobile } = useResponsive();
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)', overflow: 'hidden' }}>
      {/* Glass Header */}
      <div className="header" style={{
        position: 'relative',
        padding: isMobile ? '12px 12px 16px' : '16px 16px 20px',
        overflow: 'hidden',
      }}>
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={goBack}
              className="clay-avatar-detail"
              style={{
                width: 40,
                height: 40,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: C.white,
                padding: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 800, color: C.white, textShadow: '0 2px 8px rgba(59,11,71,0.3)' }}>Detail Customer</div>
          </div>
          <button
            onClick={() => setShowExportModal(true)}
            className="clay-avatar-detail"
            style={{
              width: 40,
              height: 40,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: C.white,
              padding: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 16 }}>
        {/* Profile card with glass effect */}
        <div className="glass-card-detail" style={{ padding: isMobile ? '16px 14px' : '24px 20px', marginBottom: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {/* Large avatar with edit capability */}
          <div style={{ position: 'relative' }}>
            <CustomerAvatar customer={customer} size={isMobile ? 70 : 90} />
            <div style={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              width: 28,
              height: 28,
              borderRadius: 14,
              background: 'linear-gradient(145deg, #6B2D7E, #4A1A59)',
              boxShadow: '0 2px 8px rgba(59,11,71,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: '2px solid white',
            }}
            onClick={() => navigate('tambah_customer', customer)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{customer.name}</div>
              {customer.isPremium && (
                <span style={{
                  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                  color: '#5D3A00',
                  fontFamily: 'Poppins',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 999,
                  boxShadow: '0 2px 6px rgba(255,215,0,0.3)',
                }}>PREMIUM</span>
              )}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, color: 'var(--ink-soft)', marginTop: 4 }}>{customer.phone}</div>

            {/* Address info */}
            {(customer.addressHousing || customer.addressDetail || customer.address) && (() => {
              const block = String(customer.addressBlock || '').trim();
              const blockHasPrefix = /^(blok|cluster|blk|kav)\b/i.test(block);
              const blockDisplay = block ? (blockHasPrefix ? block : `Blok ${block}`) : '';
              return (
                <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'var(--ink-soft)', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--magenta)" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  {customer.addressHousing || ''}{blockDisplay ? ` ${blockDisplay}` : ''}{customer.addressNo ? ` No.${customer.addressNo}` : ''}
                  {customer.addressDetail && <span> · {customer.addressDetail}</span>}
                  {!customer.addressHousing && customer.address && <span>{customer.address}</span>}
                </div>
              );
            })()}

            {/* Outlet origin tag */}
            {customer.registeredOutletName && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'linear-gradient(135deg, rgba(232,90,168,0.15), rgba(92,26,107,0.1))',
                padding: '4px 12px',
                borderRadius: 999,
                marginTop: 8,
                border: '1px solid rgba(232,90,168,0.2)',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--magenta)" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'var(--purple-deep)' }}>
                  {customer.registeredOutletName}
                </span>
              </div>
            )}
          </div>

          {/* Stats row with clay cards */}
          <div style={{ display: 'flex', gap: isMobile ? 8 : 12, width: '100%', marginTop: 8, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <div className="stat-card" style={{ flex: 1, padding: isMobile ? '10px 8px' : '14px 10px', textAlign: 'center', minWidth: isMobile ? 'calc(33% - 6px)' : 'auto' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 18 : 22, fontWeight: 800, color: 'var(--magenta)' }}>{customer.totalTx}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 9 : 10, color: 'var(--ink-soft)', marginTop: 2 }}>Transaksi</div>
            </div>
            <div className="stat-card" style={{ flex: 1, padding: isMobile ? '10px 8px' : '14px 10px', textAlign: 'center', minWidth: isMobile ? 'calc(33% - 6px)' : 'auto' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 14 : 18, fontWeight: 800, color: 'var(--mint-deep)' }}>{rp(customer.deposit || 0)}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 9 : 10, color: 'var(--ink-soft)', marginTop: 2 }}>Deposit</div>
            </div>
            <div className="stat-card" style={{ flex: 1, padding: isMobile ? '10px 8px' : '14px 10px', textAlign: 'center', minWidth: isMobile ? 'calc(33% - 6px)' : 'auto' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 18 : 22, fontWeight: 800, color: '#FFA500' }}>
                {(customer.loyaltyPoints ?? customer.poin ?? 0).toLocaleString('id-ID')}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 9 : 10, color: 'var(--ink-soft)', marginTop: 2 }}>Poin</div>
            </div>
          </div>

          {/* Quick action buttons */}
          <div style={{ display: 'flex', gap: isMobile ? 8 : 10, width: '100%', marginTop: 8, flexWrap: 'wrap' }}>
            {/* WhatsApp button */}
            {(() => {
              const raw = String(customer.phone || '').replace(/\D/g, '');
              const waPhone = raw.startsWith('0') ? `62${raw.slice(1)}` : raw;
              const waHref = waPhone ? `https://wa.me/${waPhone}` : null;
              return (
                <a
                  href={waHref || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="clay-btn-success"
                  style={{
                    flex: 1,
                    minWidth: isMobile ? 'calc(50% - 4px)' : 'auto',
                    padding: isMobile ? '10px 12px' : '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    textDecoration: 'none',
                    border: 'none',
                    cursor: waHref ? 'pointer' : 'not-allowed',
                    opacity: waHref ? 1 : 0.5,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.022 6.988 2.824a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.394-5.775c-.14-.05-.677-.334-1.006-.371-.328-.037-.53-.056-.77-.056-.24 0-.48.019-.69.056-.321.074-.752.27-.99.6-.241.335-.396.744-.44.95-.046.208.019.482.21.948.18.436.331.93.357 1.05.037.17.113.33.25.47.135.144.3.306.516.487.22.188.392.342.532.46.143.12.286.23.408.34.135.119.273.24.403.346.13.108.259.216.387.322.128.106.25.212.371.319.123.108.242.217.357.327.15.146.296.298.432.453z"/>
                  </svg>
                  <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.white }}>WhatsApp</span>
                </a>
              );
            })()}
            <button
              onClick={() => navigate('tambah_customer', customer)}
              className="clay-btn-secondary"
              style={{
                flex: 1,
                minWidth: isMobile ? 'calc(50% - 4px)' : 'auto',
                padding: isMobile ? '10px 12px' : '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--purple-mid)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: 'var(--purple-mid)' }}>Edit</span>
            </button>
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
            <button
              onClick={() => navigate('membership_register', customer)}
              className="clay-btn-primary"
              style={{
                width: '100%',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.white }}>🎁 Daftar WPC Membership</span>
            </button>
          </div>
        )}

        {/* Action buttons with glass styling */}
        <div style={{ display: 'flex', gap: isMobile ? 8 : 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('nota_step1', { preCustomer: customer })}
            className="clay-btn-primary"
            style={{
              flex: 1,
              minWidth: isMobile ? 'calc(50% - 4px)' : 'auto',
              padding: isMobile ? '12px 10px' : '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.white }}>Buat Nota</span>
          </button>
          <button
            onClick={() => navigate('topup_deposit', customer)}
            className="clay-btn-secondary"
            style={{
              flex: 1,
              minWidth: isMobile ? 'calc(50% - 4px)' : 'auto',
              padding: isMobile ? '12px 10px' : '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--mint-deep)" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: 'var(--purple-mid)' }}>Top Up</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: isMobile ? 8 : 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('tambah_customer', customer)}
            className="clay-btn-secondary"
            style={{
              flex: 1,
              minWidth: isMobile ? 'calc(50% - 4px)' : 'auto',
              padding: isMobile ? '10px 12px' : '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--purple-mid)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: 'var(--purple-mid)' }}>Edit</span>
          </button>
          <button
            onClick={handleDelete}
            className="clay-btn-danger"
            style={{
              flex: 1,
              minWidth: isMobile ? 'calc(50% - 4px)' : 'auto',
              padding: isMobile ? '10px 12px' : '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.white }}>Hapus</span>
          </button>
        </div>

        {/* ── Transaction history ── */}
        <div className="glass-card-detail" style={{ padding: isMobile ? '14px 12px' : '16px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--magenta)" strokeWidth="2" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Riwayat Transaksi
            </div>
            {customerTx.length > 0 && (
              <div style={{
                fontFamily: 'Poppins', fontSize: 11, fontWeight: 700,
                color: 'var(--ink-soft)', background: 'rgba(59,11,71,0.08)',
                padding: '4px 12px', borderRadius: 999,
              }}>
                {customerTx.length} total
              </div>
            )}
          </div>

          {/* Search + Filter Button */}
          {customerTx.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {/* Glass search bar */}
              <div className="glass-card-detail" style={{
                flex: 1,
                minWidth: isMobile ? '100%' : 200,
                padding: '4px 4px 4px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="Cari nota / catatan..."
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    fontFamily: 'Poppins',
                    fontSize: 12,
                    color: 'var(--ink)',
                    background: 'transparent',
                    padding: '8px 0',
                  }}
                />
              </div>
              <button
                onClick={() => setShowFilterModal(true)}
                className={activeFilterCount > 0 ? 'clay-btn-primary' : 'clay-avatar-detail'}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 14px',
                  color: activeFilterCount > 0 ? '#FFFFFF' : 'var(--purple-mid)',
                  border: 'none',
                  borderRadius: 14,
                  fontFamily: 'Poppins',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                  height: 40,
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
                    background: 'var(--coral)',
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
                  className="stat-card"
                  style={{
                    padding: isMobile ? '10px 12px' : '12px 14px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontFamily: 'Poppins', fontSize: isMobile ? 12 : 13, fontWeight: 700, color: 'var(--ink)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {tx.id}
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 10 : 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                      {tx.date}
                      {tx.paymentStatus === 'unpaid' && <span style={{ color: 'var(--coral)', fontWeight: 600 }}> - belum bayar</span>}
                      {tx.paymentStatus === 'partial' && <span style={{ color: '#FFA500', fontWeight: 600 }}> - partial</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: isMobile ? 8 : 12 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 13, fontWeight: 800, color: 'var(--magenta)' }}>
                      {rp(tx.total)}
                    </div>
                    <span style={{
                      fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
                      padding: '3px 8px', borderRadius: 999,
                      background: tx.status === 'selesai' ? 'linear-gradient(135deg, #C8F7C5, #8DE4B0)'
                        : tx.status === 'diambil' ? 'linear-gradient(135deg, #C8E6FF, #7BA7D4)'
                        : tx.status === 'dibatalkan' ? 'linear-gradient(135deg, #FFE0E0, #FFB8B8)'
                        : 'linear-gradient(135deg, #FFF3CD, #FFE69C)',
                      color: tx.status === 'selesai' ? '#1F6B4A'
                        : tx.status === 'diambil' ? '#2B5797'
                        : tx.status === 'dibatalkan' ? '#8B2020'
                        : '#8B6914',
                    }}>{tx.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer summary — total rupiah & jumlah transaksi yang sedang difilter */}
          {!txLoading && customerTx.length > 0 && filteredTx.length > 0 && (
            <div style={{
              marginTop: 14, padding: '14px 16px',
              background: 'linear-gradient(135deg, #3B0B47, #5C1A6B)',
              borderRadius: 16, color: 'white',
              boxShadow: '0 8px 24px rgba(59,11,71,0.3)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, opacity: 0.85, fontWeight: 600 }}>
                    {activeFilterCount > 0 ? '🔍 SESUAI FILTER' : '📊 SEMUA TRANSAKSI'}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, opacity: 0.85, marginTop: 3 }}>
                    <strong>{txSummary.count}</strong> transaksi
                    {txSummary.completedCount > 0 && ` · ${txSummary.completedCount} selesai`}
                    {txSummary.cancelledCount > 0 && ` · ${txSummary.cancelledCount} batal`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.85 }}>TOTAL NILAI</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 800, color: '#5FD9AE' }}>
                    {rp(txSummary.totalAmount)}
                  </div>
                </div>
              </div>
              <div style={{
                paddingTop: 10,
                borderTop: '1px solid rgba(255,255,255,0.15)',
                display: 'flex', justifyContent: 'space-between',
                fontFamily: 'Poppins', fontSize: 11, opacity: 0.9,
              }}>
                <span>💰 Sudah dibayar: <strong>{rp(txSummary.totalPaid)}</strong></span>
                {txSummary.balance > 0 && (
                  <span style={{ color: '#FF7D93' }}>⚠️ Belum lunas: <strong>{rp(txSummary.balance)}</strong></span>
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
            zIndex: 500, // GlassModal level
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
