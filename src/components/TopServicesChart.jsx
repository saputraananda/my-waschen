// ─────────────────────────────────────────────────────────────────────────────
// TopServicesChart.jsx — Top 5 Services Horizontal Bar Chart
// Features: Horizontal bars, ranking badges, service names, transaction counts
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../utils/theme';
import { rp } from '../utils/helpers';

export default function TopServicesChart({ className }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [period, setPeriod] = useState('7d');

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/transactions/dashboard/top-services', {
          params: { days: period === '7d' ? 7 : period === '14d' ? 14 : 30, limit: 5 }
        });
        if (res?.data?.success) {
          setData(res.data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch top services:', err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period]);

  // Rank badge config
  const rankBadgeStyle = (rank) => {
    const configs = {
      1: { bg: '#8B5CF6', label: '#1' },
      2: { bg: '#3B82F6', label: '#2' },
      3: { bg: '#10B981', label: '#3' },
      4: { bg: '#F59E0B', label: '#4' },
      5: { bg: '#6B7280', label: '#5' },
    };
    return configs[rank] || { bg: '#9CA3AF', label: `#${rank}` };
  };

  return (
    <div className={className}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.n800 }}>Top Layanan</div>
          <div style={{ fontSize: 10, color: C.n500 }}>Paling sering dipesan</div>
        </div>

        {/* Filter buttons */}
        <div style={{
          display: 'flex', gap: 4,
          background: C.n100, borderRadius: 8, padding: 2,
        }}>
          {[
            { value: '7d', label: '7H' },
            { value: '14d', label: '14H' },
            { value: '30d', label: '30H' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              style={{
                padding: '4px 10px', borderRadius: 6,
                border: 'none',
                background: period === opt.value ? C.primary : 'transparent',
                color: period === opt.value ? 'white' : C.n600,
                fontSize: 10, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height: 36, borderRadius: 8,
              background: `linear-gradient(90deg, ${C.n100} 25%, ${C.n200} 50%, ${C.n100} 75%)`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && data.length === 0 && (
        <div style={{
          height: 140, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 24 }}>📋</span>
          <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n400 }}>
            Belum ada data layanan
          </span>
        </div>
      )}

      {/* Chart bars */}
      {!loading && data.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((item, index) => {
            const rankConfig = rankBadgeStyle(item.rank);
            return (
              <div key={item.rank || index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Rank badge */}
                <div style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: rankConfig.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 9, fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {item.rank}
                </div>

                {/* Service info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 4,
                  }}>
                    <span style={{
                      fontFamily: 'Poppins', fontSize: 11, fontWeight: 500,
                      color: C.n800,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: '70%',
                    }}>
                      {item.name}
                    </span>
                    <span style={{
                      fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                      color: C.n600,
                    }}>
                      {item.count}x
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{
                    height: 6, borderRadius: 3,
                    background: C.n100, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: rankConfig.bg,
                      width: `${item.percentage}%`,
                      transition: 'width 0.5s ease-out',
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
