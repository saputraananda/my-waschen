// ─────────────────────────────────────────────────────────────────────────────
// CustomerAnalyticsPage.jsx — Customer Analytics untuk Kasir
// Pisahkan dari Transaksi!
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp, formatDate } from '../../utils/helpers';
import { Btn, EmptyState } from '../../components/ui';
import { useResponsive, useWindowSize } from '../../utils/hooks';
import {
  Users, TrendingUp, TrendingDown, Star, Gift, Calendar,
  Download, Search, Filter, ChevronRight, Award, Percent
} from 'lucide-react';

const SEGMENT_CONFIG = {
  loyal: { label: 'Loyal', color: C.success, bg: C.successBg, emoji: '🟢' },
  regular: { label: 'Regular', color: C.info, bg: C.infoBg, emoji: '🔵' },
  one_time: { label: 'One Time', color: C.n500, bg: C.n100, emoji: '⚪' },
  at_risk: { label: 'At Risk', color: C.danger, bg: C.dangerBg, emoji: '🔴' },
};

const TIER_CONFIG = {
  none: { label: 'Non Member', color: C.n500, bg: C.n100 },
  silver: { label: 'Silver', color: C.n400, bg: C.n50 },
  gold: { label: 'Gold', color: C.goldDark, bg: C.goldTint },
  diamond: { label: 'Diamond', color: C.info, bg: C.infoBg },
};

export default function CustomerAnalyticsPage({ navigate }) {
  const { isMobile } = useResponsive();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    newThisMonth: 0,
    loyal: 0,
    avgSpending: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent'); // recent, spending, transactions

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (segmentFilter !== 'all') params.append('segment', segmentFilter);
      if (tierFilter !== 'all') params.append('membership', tierFilter);
      params.append('limit', 50);

      const res = await axios.get(`/api/customers?${params}`);
      const data = res.data.data || res.data.customers || [];
      setCustomers(data);

      // Calculate stats
      const total = data.length;
      const now = new Date();
      const thisMonth = data.filter(c => {
        if (!c.first_transaction_at) return false;
        return new Date(c.first_transaction_at).getMonth() === now.getMonth() &&
               new Date(c.first_transaction_at).getFullYear() === now.getFullYear();
      }).length;
      const loyal = data.filter(c => c.segment === 'loyal').length;
      const totalSpending = data.reduce((sum, c) => sum + (c.total_spending || 0), 0);
      const avg = total > 0 ? totalSpending / total : 0;

      setStats({ total, newThisMonth: thisMonth, loyal, avgSpending: avg });
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, segmentFilter, tierFilter]);

  // Sort customers
  const sortedCustomers = useMemo(() => {
    const sorted = [...customers];
    switch (sortBy) {
      case 'spending':
        return sorted.sort((a, b) => (b.total_spending || 0) - (a.total_spending || 0));
      case 'transactions':
        return sorted.sort((a, b) => (b.total_transactions || 0) - (a.total_transactions || 0));
      case 'recent':
      default:
        return sorted.sort((a, b) => {
          const aDate = a.last_transaction_at ? new Date(a.last_transaction_at) : new Date(0);
          const bDate = b.last_transaction_at ? new Date(b.last_transaction_at) : new Date(0);
          return bDate - aDate;
        });
    }
  }, [customers, sortBy]);

  // Export CSV
  const handleExport = () => {
    const csv = [
      ['Nama', 'HP', 'Segment', 'Membership', 'Total Transaksi', 'Total Spending', 'Terakhir Transaksi'].join(','),
      ...sortedCustomers.map(c => [
        c.name,
        c.phone,
        c.segment || 'one_time',
        c.membership_tier || 'none',
        c.total_transactions || 0,
        c.total_spending || 0,
        c.last_transaction_at ? formatDate(c.last_transaction_at) : '-',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-analytics-${formatDate(new Date())}.csv`;
    a.click();
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.surface2, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: 12 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h1 style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n900, margin: 0 }}>
            👥 Customer Analytics
          </h1>
          <Btn variant="secondary" size="sm" onClick={handleExport}>
            <Download size={14} style={{ marginRight: 4 }} />
            Export
          </Btn>
        </div>
        <p style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, margin: 0 }}>
          Data & analytics customer per outlet
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        <div style={{ background: C.white, borderRadius: 14, padding: 14, boxShadow: SHADOW.sm }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${C.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} color={C.primary} />
            </div>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 700, color: C.n900 }}>{stats.total}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Total Customer</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
            <span style={{ color: C.success, fontWeight: 600 }}>+{stats.newThisMonth} bulan ini</span>
          </div>
        </div>

        <div style={{ background: C.white, borderRadius: 14, padding: 14, boxShadow: SHADOW.sm }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Star size={18} color={C.success} />
            </div>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 700, color: C.n900 }}>{stats.loyal}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Customer Loyal</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
            <span style={{ color: C.success, fontWeight: 600 }}>🟢 Loyal</span>
          </div>
        </div>

        <div style={{ background: C.white, borderRadius: 14, padding: 14, boxShadow: SHADOW.sm }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.goldTint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Gift size={18} color={C.goldDark} />
            </div>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 700, color: C.n900 }}>{rp(stats.avgSpending)}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Rata-rata Spending</div>
            </div>
          </div>
        </div>

        <div style={{ background: C.white, borderRadius: 14, padding: 14, boxShadow: SHADOW.sm }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.infoBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={18} color={C.info} />
            </div>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 700, color: C.n900 }}>
                {customers.filter(c => c.membership_tier && c.membership_tier !== 'none').length}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Total Member</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: C.white, borderRadius: 14, padding: 14, marginBottom: 16, boxShadow: SHADOW.sm }}>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.n400 }} />
          <input
            type="text"
            placeholder="Cari nama atau HP customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', height: 40, paddingLeft: 38, paddingRight: 12,
              border: `1px solid ${C.n200}`, borderRadius: 10,
              fontSize: 13, fontFamily: 'Poppins', outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
            style={{
              height: 36, padding: '0 10px', border: `1px solid ${C.n200}`,
              borderRadius: 8, fontSize: 12, fontFamily: 'Poppins', cursor: 'pointer',
              background: C.white,
            }}
          >
            <option value="all">Semua Segment</option>
            <option value="loyal">🟢 Loyal</option>
            <option value="regular">🔵 Regular</option>
            <option value="one_time">⚪ One Time</option>
            <option value="at_risk">🔴 At Risk</option>
          </select>

          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            style={{
              height: 36, padding: '0 10px', border: `1px solid ${C.n200}`,
              borderRadius: 8, fontSize: 12, fontFamily: 'Poppins', cursor: 'pointer',
              background: C.white,
            }}
          >
            <option value="all">Semua Tier</option>
            <option value="gold">Gold 💎</option>
            <option value="diamond">Diamond 💠</option>
            <option value="silver">Silver</option>
            <option value="none">Non Member</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              height: 36, padding: '0 10px', border: `1px solid ${C.n200}`,
              borderRadius: 8, fontSize: 12, fontFamily: 'Poppins', cursor: 'pointer',
              background: C.white,
            }}
          >
            <option value="recent">Terbaru</option>
            <option value="spending">Spending Tertinggi</option>
            <option value="transactions">Transaksi Terbanyak</option>
          </select>
        </div>
      </div>

      {/* Customer List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.n500 }}>Memuat...</div>
      ) : sortedCustomers.length === 0 ? (
        <EmptyState
          type="customers"
          title="Tidak ada customer"
          subtitle="Customer akan muncul di sini"
        />
      ) : (
        sortedCustomers.map((customer) => {
          const segment = SEGMENT_CONFIG[customer.segment] || SEGMENT_CONFIG.one_time;
          const tier = TIER_CONFIG[customer.membership_tier] || TIER_CONFIG.none;
          const daysSince = customer.last_transaction_at
            ? Math.floor((Date.now() - new Date(customer.last_transaction_at).getTime()) / (1000 * 60 * 60 * 24))
            : null;

          return (
            <div
              key={customer.id}
              onClick={() => navigate('detail_customer', { customerId: customer.id })}
              style={{
                background: C.white,
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                boxShadow: SHADOW.sm,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>
                    {customer.name}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, marginTop: 2 }}>
                    {customer.phone}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {tier.tier !== 'none' && (
                    <span style={{
                      padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                      background: tier.bg, color: tier.color,
                    }}>
                      {tier.label}
                    </span>
                  )}
                  <span style={{
                    padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                    background: segment.bg, color: segment.color,
                  }}>
                    {segment.emoji} {segment.label}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 8 }}>
                <div style={{ textAlign: 'center', background: C.surface3, borderRadius: 8, padding: 8 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n900 }}>
                    {customer.total_transactions || 0}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>Transaksi</div>
                </div>
                <div style={{ textAlign: 'center', background: C.surface3, borderRadius: 8, padding: 8 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n900 }}>
                    {rp(customer.total_spending || 0)}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>Total Spending</div>
                </div>
                <div style={{ textAlign: 'center', background: C.surface3, borderRadius: 8, padding: 8 }}>
                  <div style={{
                    fontFamily: 'Poppins', fontSize: 16, fontWeight: 700,
                    color: daysSince !== null && daysSince <= 7 ? C.success : daysSince !== null && daysSince <= 30 ? C.warning : C.danger
                  }}>
                    {daysSince !== null ? `${daysSince}h` : '-'}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>Terakhir</div>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Show count */}
      {!loading && sortedCustomers.length > 0 && (
        <div style={{ textAlign: 'center', padding: 16, color: C.n500, fontSize: 12, marginBottom: isMobile ? 80 : 0 }}>
          Menampilkan {sortedCustomers.length} customer
        </div>
      )}
    </div>
  );
}
