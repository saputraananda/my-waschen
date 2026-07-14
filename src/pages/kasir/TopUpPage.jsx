// ─────────────────────────────────────────────────────────────────────────────
// TopUpPage — Select Customer + Top Up
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { C } from '../../utils/theme';
import { useDebounce, useResponsive, useWindowSize } from '../../utils/hooks';
import { SkeletonList } from '../../components/ui';
import { Users, CreditCard, ChevronRight, Search } from 'lucide-react';

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

  const clayCard = {
    background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
    borderRadius: 16,
    boxShadow: '8px 8px 20px rgba(60, 10, 99, 0.08), -4px -4px 12px rgba(255, 255, 255, 0.95)',
    border: '1px solid rgba(139, 92, 246, 0.08)',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #F8F4FF 0%, #F1F5F9 100%)' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        padding: '18px 20px 32px',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 8 }}>
          <motion.button
            onClick={goBack}
            whileTap={{ scale: 0.9 }}
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white',
            }}
          >
            <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
          </motion.button>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Pilih Customer</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: 'white' }}>Top Up Deposit 💰</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 100px', marginTop: -16 }}>

        {/* Search */}
        <div style={{ ...clayCard, padding: 16, marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.n400 }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau nomor HP..."
              style={{
                width: '100%', height: 48, borderRadius: 12,
                border: '1.5px solid rgba(139, 92, 246, 0.15)',
                background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
                fontFamily: 'Poppins', fontSize: 13,
                paddingLeft: 44, paddingRight: 14, outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Customer List */}
        {loading ? (
          <SkeletonList count={5} avatar lines={2} />
        ) : customers.length === 0 ? (
          <div style={{ ...clayCard, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n500 }}>Customer tidak ditemukan</div>
          </div>
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
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
                  border: '1.5px solid rgba(139, 92, 246, 0.08)',
                  borderRadius: 16, cursor: 'pointer',
                  boxShadow: '6px 6px 16px rgba(60, 10, 99, 0.08), -3px -3px 10px rgba(255, 255, 255, 0.95)',
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: c.membershipStatus === 'active'
                    ? 'linear-gradient(145deg, #5B005F, #8C4C8F)'
                    : 'linear-gradient(145deg, #F4EDF4, #E6D9E7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontFamily: 'Poppins',
                  fontSize: 14, fontWeight: 700, flexShrink: 0,
                }}>
                  {c.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n800 }}>{c.name}</span>
                    {c.membershipStatus === 'active' && (
                      <span style={{
                        fontFamily: 'Poppins', fontSize: 7, fontWeight: 700, padding: '1px 5px',
                        borderRadius: 4, background: '#F59E0B', color: 'white'
                      }}>
                        MEMBER
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>{c.phone}</span>
                    {c.deposit > 0 && (
                      <span style={{
                        fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, padding: '2px 6px',
                        borderRadius: 6, background: '#D1FAE5', color: '#059669'
                      }}>
                        💰 {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(c.deposit)}
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
