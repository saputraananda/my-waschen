import { useState, useEffect } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { TopBar, SearchBar, Avatar, Btn, EmptyState, SkeletonList } from '../../components/ui';
import { useDebounce } from '../../utils/hooks';
import { useApp } from '../../context/AppContext';

export default function NotaStep1Page({ goBack }) {
  const { navigate, setNotaCustomer } = useApp();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 250);
  const [hasActiveSession, setHasActiveSession] = useState(null); // null = checking, true = active, false = not active
  const [sessionCheckError, setSessionCheckError] = useState(null);

  // Check for active shift session on mount
  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        const res = await axios.get('/api/shift/sub-session/current');
        if (res?.data?.success) {
          const { hasActiveSubSession } = res.data.data;
          setHasActiveSession(hasActiveSubSession);
          if (!hasActiveSubSession) {
            setSessionCheckError('Anda belum memiliki shift aktif. Silakan buka shift terlebih dahulu untuk melanjutkan transaksi.');
          }
        } else {
          setHasActiveSession(false);
          setSessionCheckError('Gagal memeriksa status shift. Silakan coba lagi.');
        }
      } catch (error) {
        console.error('Failed to check active session:', error);
        setHasActiveSession(false);
        setSessionCheckError('Tidak dapat memeriksa status shift. Pastikan Anda sudah login.');
      }
    };
    checkActiveSession();
  }, []);

  // Fetch with server-side search & pagination
  useEffect(() => {
    let cancelled = false;
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const url = debouncedQuery.trim()
          ? `/api/customers?search=${encodeURIComponent(debouncedQuery.trim())}&limit=50`
          : `/api/customers?limit=50`;
        const res = await axios.get(url);
        if (!cancelled) {
          setCustomers(res?.data?.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch customers:', error);
        if (!cancelled) setCustomers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchCustomers();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const selectCustomer = (c) => {
    // Prevent transaction creation if no active session
    if (!hasActiveSession) {
      return; // Do nothing if no active session
    }
    setNotaCustomer(c);
    navigate('nota_step2');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Buat Nota" subtitle="Langkah 1 dari 3 — Pilih Customer" onBack={goBack} />

      {/* Warning Banner - No Active Session */}
      {hasActiveSession === false && sessionCheckError && (
        <div style={{
          margin: '12px 16px 0',
          padding: '12px 14px',
          background: C.validationWarningBg,
          border: `1.5px solid ${C.validationWarningBorder}`,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10
        }}>
          <div style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: C.validationWarningBorder,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.validationWarningText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'Poppins',
              fontSize: 13,
              fontWeight: 600,
              color: C.validationWarningText,
              marginBottom: 4
            }}>
              Shift Belum Dibuka
            </div>
            <div style={{
              fontFamily: 'Poppins',
              fontSize: 12,
              color: C.validationWarningText,
              lineHeight: 1.4,
              opacity: 0.85
            }}>
              {sessionCheckError}
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '8px 16px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= 1 ? C.primary : C.n200 }} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Cari nama atau nomor HP..." />

        {loading ? (
          <SkeletonList count={5} avatar lines={3} />
        ) : customers.length === 0 ? (
          <EmptyState title="Customer tidak ditemukan" subtitle="Tambah customer baru?" action={() => navigate('tambah_customer')} actionLabel="+ Tambah Customer" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {customers.map((c) => (
              <div
                key={c.id}
                onClick={() => selectCustomer(c)}
                style={{
                  background: hasActiveSession === false ? C.n100 : C.white,
                  borderRadius: 14,
                  padding: '12px 14px',
                  boxShadow: SHADOW.sm,
                  cursor: hasActiveSession === false ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  opacity: hasActiveSession === false ? 0.6 : 1,
                  pointerEvents: hasActiveSession === false ? 'none' : 'auto'
                }}
              >
                <Avatar initials={c.avatar || c.name.split(' ').map((w) => w[0]).join('').slice(0, 2)} size={44} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{c.name}</div>
                    {/* Membership Badge - Show tier for active members */}
                    {c.membershipStatus === 'active' && c.membershipActiveStatus === 'active' && (
                      <span style={{
                        background: c.membershipExpiringSoon ? C.validationWarningBg : C.badgeDiamondBg,
                        color: c.membershipExpiringSoon ? C.validationWarningText : C.badgeDiamondText,
                        fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                        fontFamily: 'Poppins',
                        display: 'flex', alignItems: 'center', gap: 2
                      }}>
                        {c.membershipDiscountPct >= 25 ? '💎' : '🥇'}
                        {c.membershipDiscountPct >= 25 ? 'DIAMOND' : 'GOLD'}
                      </span>
                    )}
                    {c.isPremium && c.membershipActiveStatus !== 'active' && (
                      <span style={{ background: C.badgeExpiredBg, color: C.badgeExpiredText, fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 999, fontFamily: 'Poppins' }}>
                        Member Expire
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 2 }}>{c.phone}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n900, fontWeight: 600 }}>
                      Deposit: Rp {(c.deposit || 0).toLocaleString('id-ID')}
                    </div>
                    {/* Expiry warning - show if expiring within 7 days */}
                    {c.membershipExpiringSoon && c.membershipActiveStatus === 'active' && (
                      <span style={{
                        background: C.validationWarningBg, color: C.validationWarningText, fontSize: 9, fontWeight: 600,
                        padding: '1px 5px', borderRadius: 999, fontFamily: 'Poppins',
                        display: 'flex', alignItems: 'center', gap: 2
                      }}>
                        ⚠️ Expire: {c.membershipExpiredAt ? new Date(c.membershipExpiredAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : 'soon'}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.primary }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.n100}` }}>
        <Btn 
          variant="secondary" 
          fullWidth 
          onClick={() => navigate('tambah_customer')}
          disabled={hasActiveSession === false}
        >
          + Customer Baru
        </Btn>
      </div>
    </div>
  );
}
