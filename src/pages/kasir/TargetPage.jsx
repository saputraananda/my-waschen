/**
 * TargetPage.jsx
 * Halaman Capaian Saya - Untuk KASIR saja (view-only)
 * Tidak ada fitur admin/CUD target
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { rp } from '../../utils/helpers';
import { C, SHADOW } from '../../utils/theme';
import { useResponsive, useWindowSize } from '../../utils/hooks';
import { EmptyState } from '../../components/ui';
import {
  ChevronRight,
  RefreshCw,
  Target,
  Calendar,
} from 'lucide-react';

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function TargetPage() {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [monthlyProgress, setMonthlyProgress] = useState(null);
  const [dailyProgress, setDailyProgress] = useState([]);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const progressRes = await axios.get('/api/targets/progress');
      if (progressRes.data.success) {
        setMonthlyProgress(progressRes.data.data);
      }
      const dailyRes = await axios.get('/api/targets/daily-progress');
      if (dailyRes.data.success) {
        setDailyProgress(dailyRes.data.data || []);
      }
    } catch (err) {
      setError('Tidak dapat memuat data capaian');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getProgressColor = (pct) => {
    if (pct >= 100) return '#10B981';
    if (pct >= 75) return '#F59E0B';
    if (pct >= 50) return '#F97316';
    return '#EF4444';
  };

  const getProgressBg = (pct) => {
    if (pct >= 100) return '#D1FAE5';
    if (pct >= 75) return '#FEF3C7';
    if (pct >= 50) return '#FFF7ED';
    return '#FEE2E2';
  };

  const getProgressIcon = (pct) => {
    if (pct >= 100) return '🎯';
    if (pct >= 75) return '📈';
    if (pct >= 50) return '⚡';
    return '💪';
  };

  const today = new Date();
  const todayStr = `${DAY_NAMES[today.getDay()]}, ${today.getDate()} ${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;

  // Loading state
  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8F4FF' }}>
        <div style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)', padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Capaian Saya</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Target & Capaian</div>
            </div>
            <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', color: '#9CA3AF' }} />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8F4FF' }}>
        <div style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)', padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Capaian Saya</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Target & Capaian</div>
            </div>
            <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, padding: 20 }}>
          <EmptyState type="error" title="Gagal Memuat" description={error} action={{ label: 'Coba Lagi', onClick: loadData }} />
        </div>
      </div>
    );
  }

  // No target state
  if (!monthlyProgress) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8F4FF' }}>
        <div style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)', padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Capaian Saya</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Target & Capaian</div>
            </div>
            <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, padding: 20 }}>
          <EmptyState type="transactions" title="Belum Ada Target" description="Target bulanan untuk outlet Anda belum tersedia" />
        </div>
      </div>
    );
  }

  // Main content
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8F4FF', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)', padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Capaian Saya</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Target & Capaian</div>
          </div>
          <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 8 : 12 }}>
        {/* Main Progress Card */}
        <div style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', marginBottom: 12, borderRadius: isMobile ? 16 : 20, padding: isMobile ? 12 : 16, textAlign: 'center' }}>
          <div style={{ fontSize: isMobile ? 10 : 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
            {MONTH_NAMES[monthlyProgress.month - 1]} {monthlyProgress.year}
          </div>
          <div style={{ fontSize: isMobile ? 12 : 14, color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>
            {todayStr}
          </div>
          <div style={{ fontSize: isMobile ? 48 : 64, fontWeight: 800, color: 'white', lineHeight: 1, marginBottom: 4 }}>
            {monthlyProgress.pct}%
          </div>
          <div style={{ fontSize: isMobile ? 14 : 16, color: 'rgba(255,255,255,0.8)', marginBottom: 20 }}>
            {getProgressIcon(monthlyProgress.pct)} {monthlyProgress.pct >= 100 ? 'Target Terpenuhi!' : monthlyProgress.pct >= 75 ? 'Hampir Sampai!' : 'Terus Semangat!'}
          </div>
          <div style={{ height: isMobile ? 10 : 12, background: 'rgba(255,255,255,0.3)', borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ width: `${Math.min(100, monthlyProgress.pct)}%`, height: '100%', background: C.white, borderRadius: 6, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <div>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: 'white' }}>{rp(monthlyProgress.actualAmount || 0)}</div>
              <div style={{ fontSize: isMobile ? 10 : 11, opacity: 0.7 }}>Actual</div>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.3)' }} />
            <div>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: 'white' }}>{rp(monthlyProgress.targetAmount || 0)}</div>
              <div style={{ fontSize: isMobile ? 10 : 11, opacity: 0.7 }}>Target</div>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.3)' }} />
            <div>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: monthlyProgress.pct >= 100 ? '#BBF7D0' : '#FCA5A5' }}>
                {monthlyProgress.pct >= 100 ? '+' : ''}{rp(Math.abs((monthlyProgress.actualAmount || 0) - (monthlyProgress.targetAmount || 0)))}
              </div>
              <div style={{ fontSize: isMobile ? 10 : 11, opacity: 0.7 }}>{monthlyProgress.pct >= 100 ? 'Lebih' : 'Kurang'}</div>
            </div>
          </div>
        </div>

        {/* Today's Progress */}
        {dailyProgress.length > 0 && (
          <div style={{ background: C.white, borderRadius: isMobile ? 12 : 16, padding: isMobile ? 12 : 16, boxShadow: SHADOW.sm, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Calendar size={18} color="#7C3AED" />
              <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 600, color: '#1F2937' }}>Capaian Harian</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? 4 : 6, marginBottom: 12 }}>
              {dailyProgress.slice(-7).map((day, i) => {
                const pct = day.pct || 0;
                const isToday = day.isToday;
                return (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ height: isMobile ? 40 : 60, background: isToday ? getProgressBg(pct) : '#F3F4F6', borderRadius: 8, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 4, border: isToday ? `2px solid ${getProgressColor(pct)}` : 'none' }}>
                      <div style={{ width: '100%', height: `${Math.min(100, pct)}%`, background: isToday ? getProgressColor(pct) : '#D1D5DB', borderRadius: 4, transition: 'height 0.3s ease' }} />
                    </div>
                    <div style={{ fontSize: isMobile ? 9 : 10, color: isToday ? '#7C3AED' : '#9CA3AF', marginTop: 4, fontWeight: isToday ? 600 : 400 }}>{day.day}</div>
                    <div style={{ fontSize: isMobile ? 8 : 9, color: '#6B7280' }}>{pct}%</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? 8 : 16, fontSize: isMobile ? 10 : 11, color: '#6B7280', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#10B981' }} /><span>≥100%</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#F59E0B' }} /><span>≥75%</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#EF4444' }} /><span>&lt;50%</span></div>
            </div>
          </div>
        )}

        {/* Weekly Summary */}
        <div style={{ background: C.white, borderRadius: isMobile ? 12 : 16, padding: isMobile ? 12 : 16, boxShadow: SHADOW.sm, marginBottom: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Target size={18} color="#7C3AED" />
            <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 600, color: '#1F2937' }}>Ringkasan Minggu Ini</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: isMobile ? 8 : 12 }}>
            <div style={{ background: '#F3F4F6', borderRadius: 12, padding: isMobile ? 10 : 12, textAlign: 'center' }}>
              <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#7C3AED' }}>{monthlyProgress.transactionCount || 0}</div>
              <div style={{ fontSize: isMobile ? 10 : 11, color: '#6B7280' }}>Transaksi</div>
            </div>
            <div style={{ background: '#F3F4F6', borderRadius: 12, padding: isMobile ? 10 : 12, textAlign: 'center' }}>
              <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#059669' }}>{rp(Math.round((monthlyProgress.actualAmount || 0) / Math.max(1, new Date().getDate())))}</div>
              <div style={{ fontSize: isMobile ? 10 : 11, color: '#6B7280' }}>Rata-rata/Hari</div>
            </div>
            <div style={{ background: '#FEF3C7', borderRadius: 12, padding: isMobile ? 10 : 12, textAlign: 'center' }}>
              <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#D97706' }}>{new Date(monthlyProgress.year, monthlyProgress.month, 0).getDate() - new Date().getDate()}</div>
              <div style={{ fontSize: isMobile ? 10 : 11, color: '#92400E' }}>Hari Tersisa</div>
            </div>
            <div style={{ background: '#FEE2E2', borderRadius: 12, padding: isMobile ? 10 : 12, textAlign: 'center' }}>
              <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#DC2626' }}>{rp(Math.max(0, Math.round(((monthlyProgress.targetAmount || 0) - (monthlyProgress.actualAmount || 0)) / Math.max(1, new Date(monthlyProgress.year, monthlyProgress.month, 0).getDate() - new Date().getDate()))))}</div>
              <div style={{ fontSize: isMobile ? 10 : 11, color: '#991B1B' }}>Target/Hari</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
