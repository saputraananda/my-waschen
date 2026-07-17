// ─────────────────────────────────────────────────────────────────────────────
// TopUpPage — Select Customer + Top Up
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { C } from '../../utils/theme';
import { useDebounce, useResponsive } from '../../utils/hooks';
import { SkeletonList, ProfileAvatar } from '../../components/ui';
import { CreditCard, ChevronRight, Search } from 'lucide-react';
import { TopBar } from '../../components/ui';

export default function TopUpPage({ navigate, goBack }) {
  const { isMobile } = useResponsive();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 250);

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
        if (!cancelled) setCustomers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchCustomers();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const ClayCard = ({ children, style, padding = 16 }) => (
    <div style={{
      background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
      borderRadius: 16,
      padding: padding,
      boxShadow: '8px 8px 20px rgba(110, 46, 120, 0.1), -4px -4px 12px rgba(255, 255, 255, 0.95)',
      border: '1px solid rgba(139, 92, 246, 0.08)',
      ...style,
    }}>
      {children}
    </div>
  );

  const fmtDeposit = (deposit) => {
    if (!deposit) return null;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(deposit);
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--glass-bg, #F3EEF7)',
    }}>
      <TopBar
        title="Top Up Deposit"
        subtitle="Pilih customer untuk top up"
        onBack={goBack}
      />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? 12 : 16,
        paddingBottom: isMobile ? 100 : 16,
      }}>
        {/* Search */}
        <ClayCard padding={16} style={{ marginBottom: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: C.n400,
            }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau nomor HP..."
              style={{
                width: '100%',
                height: 48,
                borderRadius: 12,
                border: `1.5px solid ${C.n200}`,
                background: C.white,
                fontFamily: "'Poppins'",
                fontSize: 13,
                color: C.n900,
                paddingLeft: 44,
                paddingRight: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </ClayCard>

        {/* Customer List */}
        {loading ? (
          <SkeletonList count={5} avatar lines={2} />
        ) : customers.length === 0 ? (
          <ClayCard padding={32} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <div style={{ fontFamily: "'Poppins'", fontSize: 13, fontWeight: 600, color: C.n500 }}>
              Customer tidak ditemukan
            </div>
          </ClayCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {customers.map((c, i) => (
              <motion.button
                key={c.id}
                onClick={() => navigate('topup_deposit', c)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
                  border: `1.5px solid ${C.n100}`,
                  borderRadius: 16,
                  cursor: 'pointer',
                  boxShadow: '6px 6px 16px rgba(110, 46, 120, 0.08), -3px -3px 10px rgba(255, 255, 255, 0.95)',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  overflow: 'hidden',
                  flexShrink: 0,
                }}>
                  {c.photo ? (
                    <img src={c.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <ProfileAvatar user={{ ...c, type: 'customer' }} size={48} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: "'Poppins'", fontSize: 13, fontWeight: 600, color: C.n800 }}>
                      {c.name}
                    </span>
                    {c.membershipStatus === 'active' && (
                      <span style={{
                        fontFamily: "'Poppins'",
                        fontSize: 7,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: C.warning,
                        color: C.white,
                      }}>
                        MEMBER
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.n500 }}>{c.phone}</span>
                    {c.deposit > 0 && (
                      <span style={{
                        fontFamily: "'Poppins'",
                        fontSize: 9,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 6,
                        background: C.success + '20',
                        color: C.success,
                      }}>
                        {fmtDeposit(c.deposit)}
                      </span>
                    )}
                  </div>
                </div>
                <CreditCard size={20} color={C.primary} />
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
