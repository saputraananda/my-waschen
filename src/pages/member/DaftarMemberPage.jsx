import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, SearchBar, Avatar, Chip, Btn } from '../../components/ui';
import { useResponsive } from '../../utils/hooks';

// ─── Premium Animation Assets ───────────────────────────────────────────────
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp'
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp'
import soapBubble from '../../assets/Decorative icon/soap-bubble.webp'

// ─── Premium Animation Components ──────────────────────────────────────────────
const FloatingBubble = ({ src, size, top, left, right, bottom, delay = 0, duration = 5, opacity = 0.35 }) => (
  <motion.div
    animate={{ y: [0, -12, 0], scale: [1, 1.06, 1], opacity: [opacity * 0.5, opacity, opacity * 0.5] }}
    transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
    style={{ position: 'absolute', top, left, right, bottom, width: size, height: size, pointerEvents: 'none', zIndex: 0 }}
  >
    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.08))' }} loading="lazy" />
  </motion.div>
);

// Tier configurations
const TIERS = {
  gold: {
    name: 'Gold',
    icon: '🥇',
    color: '#F59E0B',
  },
  diamond: {
    name: 'Diamond',
    icon: '💎',
    color: '#8B5CF6',
  },
};

export default function DaftarMemberPage({ navigate, goBack }) {
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | active | expired | gold | diamond
  const [refreshing, setRefreshing] = useState(false);
  const { isMobile } = useResponsive();

  const fetchMemberships = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      // Fetch active memberships
      const [activeRes, expiredRes] = await Promise.all([
        axios.get('/api/membership?status=active&limit=500'),
        axios.get('/api/membership?status=expired&limit=100'),
      ]);

      const activeList = activeRes?.data?.data || [];
      const expiredList = expiredRes?.data?.data || [];

      // Combine with status
      const combined = [
        ...activeList.map(m => ({ ...m, membershipStatus: 'active' })),
        ...expiredList.map(m => ({ ...m, membershipStatus: 'expired' })),
      ];

      setMemberships(combined);
    } catch (err) {
      setMemberships([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMemberships();
  }, []);

  const filtered = memberships.filter((m) => {
    const name = m.customer_name || '';
    const phone = m.customer_phone || '';
    const memberNo = m.member_no || '';
    const matchQuery = name.toLowerCase().includes(query.toLowerCase()) ||
                       phone.includes(query) ||
                       memberNo.toLowerCase().includes(query.toLowerCase());

    let matchFilter = true;
    if (filter === 'active') matchFilter = m.membershipStatus === 'active' || !isExpired(m.expired_at);
    else if (filter === 'expired') matchFilter = m.membershipStatus === 'expired' || isExpired(m.expired_at);
    else if (filter === 'gold') matchFilter = (m.tier || 'gold') === 'gold';
    else if (filter === 'diamond') matchFilter = m.tier === 'diamond';

    return matchQuery && matchFilter;
  });

  // Helper: check if membership is expired
  const isExpired = (expiredAt) => {
    if (!expiredAt) return false;
    return new Date(expiredAt) < new Date();
  };

  // Stats
  const activeCount = memberships.filter(m => m.membershipStatus === 'active' && !isExpired(m.expired_at)).length;
  const expiredCount = memberships.filter(m => m.membershipStatus === 'expired' || isExpired(m.expired_at)).length;
  const goldCount = memberships.filter(m => (m.tier || 'gold') === 'gold' && m.membershipStatus === 'active' && !isExpired(m.expired_at)).length;
  const diamondCount = memberships.filter(m => m.tier === 'diamond' && m.membershipStatus === 'active' && !isExpired(m.expired_at)).length;
  const totalDeposit = memberships.reduce((s, m) => s + (Number(m.wallet_balance) || 0), 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="WPC Membership"
        subtitle={`${activeCount} member aktif`}
        onBack={goBack}
        rightAction={() => fetchMemberships(true)}
        rightIcon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '10px 12px' : '12px 16px' }}>

        {/* ── Stats Banner ────────────────────────────────────────── */}
        {!loading && memberships.length > 0 && (
          <div style={{
            background: `linear-gradient(135deg, ${C.primaryStrong}, ${C.primaryDark})`,
            borderRadius: isMobile ? 12 : 16, padding: isMobile ? '12px 10px' : '16px 18px', marginBottom: 14, color: 'white',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: 12, flexWrap: 'wrap', gap: isMobile ? 8 : 0 }}>
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 18 : 22, fontWeight: 700 }}>{activeCount}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 9 : 10, opacity: 0.85 }}>Aktif</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.15)', display: isMobile ? 'none' : 'block' }} />
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#FDE68A' }}>{goldCount}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 9 : 10, opacity: 0.85 }}>Gold</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.15)', display: isMobile ? 'none' : 'block' }} />
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#C4B5FD' }}>{diamondCount}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 9 : 10, opacity: 0.85 }}>Diamond</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.15)', display: isMobile ? 'none' : 'block' }} />
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 14, fontWeight: 700, color: '#FCA5A5' }}>{expiredCount}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 9 : 10, opacity: 0.85 }}>Expired</div>
              </div>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 10 : 11, textAlign: 'center', opacity: 0.85 }}>
              Total Deposit: {rp(totalDeposit)}
            </div>
          </div>
        )}

        <SearchBar value={query} onChange={setQuery} placeholder="Cari nama / no HP / no member..." />

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Chip label={`Semua (${memberships.length})`} active={filter === 'all'} onClick={() => setFilter('all')} />
          <Chip label={`Aktif (${activeCount})`} active={filter === 'active'} onClick={() => setFilter('active')} color={C.success} />
          <Chip label={`Expired (${expiredCount})`} active={filter === 'expired'} onClick={() => setFilter('expired')} color={C.danger} />
          <Chip label={`Gold (${goldCount})`} active={filter === 'gold'} onClick={() => setFilter('gold')} color="#F59E0B" />
          <Chip label={`Diamond (${diamondCount})`} active={filter === 'diamond'} onClick={() => setFilter('diamond')} color="#8B5CF6" />
        </div>

        {/* Info Banner */}
        <div style={{
          background: C.primaryTint2, borderRadius: 10, padding: '10px 14px', marginBottom: 12,
          fontFamily: 'Poppins', fontSize: 11, color: C.primary,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>ℹ️</span>
          <span>Klik member untuk melihat detail dan manage membership</span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ background: C.white, borderRadius: 14, padding: 14, height: 80, animation: 'pulse 1.5s infinite', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 24px', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 36, background: C.primaryTint2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 32 }}>👑</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: C.n900 }}>
              {query ? 'Tidak ada hasil pencarian' : 'Belum ada member WPC'}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, maxWidth: 260, lineHeight: 1.5 }}>
              {query ? 'Coba kata kunci lain'
                : 'Daftarkan customer sebagai member WPC untuk menikmati diskon eksklusif'}
            </div>
            {!query && (
              <Btn variant="primary" onClick={() => navigate('customer')} style={{ marginTop: 8 }}>
                Lihat Customer
              </Btn>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
            {filtered.map((m) => {
              const tier = m.tier || 'gold';
              const tierInfo = TIERS[tier];
              const expired = isExpired(m.expired_at);
              const daysUntil = m.expired_at
                ? Math.ceil((new Date(m.expired_at) - new Date()) / (1000 * 60 * 60 * 24))
                : null;
              const isExpiringSoon = daysUntil !== null && daysUntil <= 7 && daysUntil > 0;

              return (
                <div
                  key={m.id}
                  onClick={() => navigate('detail_customer', { id: m.customer_id, name: m.customer_name })}
                  style={{
                    background: C.white, borderRadius: isMobile ? 10 : 14, padding: isMobile ? '10px 12px' : '12px 14px',
                    boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 12,
                    borderLeft: `4px solid ${expired ? C.danger : tierInfo.color}`,
                    transition: 'transform 0.15s',
                  }}
                >
                  {/* Tier Badge */}
                  <div style={{
                    width: isMobile ? 40 : 48, height: isMobile ? 40 : 48, borderRadius: isMobile ? 10 : 12,
                    background: expired ? C.validationErrorBg : `${tierInfo.color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isMobile ? 20 : 24, flexShrink: 0,
                  }}>
                    {tierInfo.icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                      <div style={{
                        fontFamily: 'Poppins', fontSize: isMobile ? 13 : 14, fontWeight: 600, color: C.n900,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        {m.customer_name}
                      </div>
                      {expired ? (
                        <span style={{
                          background: C.validationErrorBg, color: C.validationErrorText,
                          fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
                          padding: '2px 6px', borderRadius: 999,
                        }}>
                          EXPIRED
                        </span>
                      ) : isExpiringSoon ? (
                        <span style={{
                          background: C.validationWarningBg, color: C.validationWarningText,
                          fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
                          padding: '2px 6px', borderRadius: 999,
                        }}>
                          EXPIRY SOON
                        </span>
                      ) : (
                        <span style={{
                          background: `${tierInfo.color}20`, color: tierInfo.color,
                          fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
                          padding: '2px 6px', borderRadius: 999,
                        }}>
                          {tierInfo.name.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 10 : 11, color: C.n600, marginBottom: isMobile ? 2 : 4 }}>
                      {m.customer_phone} - {m.member_no}
                    </div>

                    <div style={{ display: 'flex', gap: isMobile ? 8 : 12, flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                        color: C.success, display: 'flex', alignItems: 'center', gap: 2,
                      }}>
                        🏷️ {m.discount_pct}% DISKON
                      </span>

                      {!expired && daysUntil !== null && (
                        <span style={{
                          fontFamily: 'Poppins', fontSize: 10,
                          color: isExpiringSoon ? C.validationWarningText : C.n600,
                          display: 'flex', alignItems: 'center', gap: 2,
                        }}>
                          📅 {daysUntil > 0 ? `${daysUntil} hari lagi` : 'Hari ini'}
                        </span>
                      )}

                      {expired && (
                        <span style={{
                          fontFamily: 'Poppins', fontSize: 10, color: C.validationErrorText,
                        }}>
                          ❌ Expired {m.expired_at ? new Date(m.expired_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                        </span>
                      )}

                      {m.wallet_balance > 0 && (
                        <span style={{
                          fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                          color: C.success, display: 'flex', alignItems: 'center', gap: 2,
                        }}>
                          💰 {rp(Number(m.wallet_balance))}
                        </span>
                      )}
                    </div>
                  </div>

                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n300} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
