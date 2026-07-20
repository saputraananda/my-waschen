import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../utils/theme';
import { useResponsive } from '../utils/hooks';
import { TopBar, Btn } from '../components/ui';
import { useRealtime } from '../utils/realtime';
import { checkLowBalance } from '../utils/outletCashApi';
import { useAuth } from '../context/AuthContext';

const TYPE_ICONS = {
  selesai:  { icon: '✅', bg: C.successBg, color: C.success },
  info:     { icon: 'ℹ️', bg: C.primaryTint, color: C.primary },
  payment:  { icon: '💳', bg: C.validationWarningBg, color: C.validationWarningText },
  warning:  { icon: '⚠️', bg: C.validationErrorBg, color: C.danger },
  pickup:   { icon: '🚗', bg: C.infoBg, color: C.infoDark },
  promo:    { icon: '🎉', bg: C.validationWarningBg, color: C.validationWarningText },
};

export default function NotifikasiPage({ navigate, goBack }) {
  const { isMobile } = useResponsive();
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodAlerts, setPeriodAlerts] = useState([]);
  const [lowBalanceAlert, setLowBalanceAlert] = useState(null);
  const [poolData, setPoolData] = useState([]);

  // Helper: check if user is admin (global role)
  const isGlobalRole = ['admin'].includes(user?.roleCode);
  // Helper: check if user is frontliner
  const isKasir = ['frontline'].includes(user?.roleCode);
  // Helper: check if user is produksi
  const isProduksi = user?.roleCode === 'produksi';

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await axios.get('/api/notifications');
      setNotifications(res?.data?.data || []);
    } catch (err) {
      setError('Gagal memuat data. Tap untuk coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchDashboardAlerts = useCallback(async () => {
    if (!token) return;
    try {
      // For admin (global role), show all outlets
      // For outlet-scoped roles (frontliner/produksi), only show their outlet
      let outletsToFetch = [];

      if (isGlobalRole) {
        // Admin: get all outlets
        const outletsRes = await axios.get('/api/master/outlets');
        outletsToFetch = outletsRes?.data?.data || [];
      } else if (user?.outletId) {
        // Kasir/produksi: only their outlet
        outletsToFetch = [{ id: user.outletId, name: user.outlet?.name || 'Outlet Saya' }];
      }

      // Get period alerts for relevant outlets only
      const periodResults = await Promise.all(
        outletsToFetch.map(o => axios.get(`/api/periods/current?outletId=${o.id}`).then(r => ({ outlet: o, data: r?.data?.data })).catch(() => null))
      );
      setPeriodAlerts(periodResults.filter(r => r && r.data && !r.data.alreadyClosed && r.data.daysLeft <= 3));

      // Get low balance alert - scoped by backend based on user role
      const lowBalance = await checkLowBalance();
      setLowBalanceAlert(lowBalance);

      // Get pool data - only for admin roles
      if (isGlobalRole) {
        try {
          const poolRes = await axios.get('/api/cash-deposits/pool-summary');
          setPoolData(poolRes?.data?.data || []);
        } catch {
          setPoolData([]);
        }
      } else {
        setPoolData([]);
      }
    } catch (err) {
      // Silent fail for dashboard alerts
    }
  }, [token, user?.roleCode, user?.outletId, isGlobalRole]);

  useEffect(() => {
    if (token) {
      fetchNotifications();
      fetchDashboardAlerts();
    } else {
      setLoading(false);
    }
  }, [token, fetchNotifications, fetchDashboardAlerts]);

  const handleRefresh = () => {
    if (token) {
      fetchNotifications();
      fetchDashboardAlerts();
    }
  };

  // Realtime: refresh saat ada notif baru
  useRealtime('notification:new', () => {
    handleRefresh();
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Generate alert items from periodAlerts, lowBalanceAlert, poolData
  const getAlertItems = () => {
    const items = [];

    // Period alerts
    periodAlerts.forEach(({ outlet, data }) => {
      items.push({
        id: `period-${outlet.id}`,
        type: 'warning',
        title: `${outlet.name} - Tutup Buku`,
        message: data.daysLeft <= 1 
          ? `Segera tutup buku untuk outlet ini!` 
          : `Tutup buku ${data.daysLeft} hari lagi`,
        time: 'Baru saja',
        read: false
      });
    });

    // Low balance alert
    if (lowBalanceAlert?.isLow) {
      items.push({
        id: 'low-balance',
        type: 'warning',
        title: 'Saldo Kas Rendah',
        message: `${lowBalanceAlert.lowOutlets.length} outlet memiliki saldo kas di bawah ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(lowBalanceAlert.minBalance)}`,
        time: 'Baru saja',
        read: false
      });
    }

    // Pool data alerts
    poolData.filter(o => o.alerts.length > 0).forEach((outlet) => {
      outlet.alerts.forEach((alert, idx) => {
        items.push({
          id: `pool-${outlet.outletId}-${idx}`,
          type: 'warning',
          title: `${outlet.outletName} - Pool Kas`,
          message: alert.message,
          time: 'Baru saja',
          read: false
        });
      });
    });

    return items;
  };

  const alertItems = getAlertItems();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Notifikasi"
        subtitle={unreadCount > 0 || alertItems.length > 0 
          ? `${unreadCount + alertItems.length} belum dibaca` 
          : `${notifications.length} notifikasi`}
        onBack={goBack}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px 12px' : '12px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0' }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ background: C.white, borderRadius: 14, padding: '14px 14px', height: 72, animation: 'pulse 1.5s infinite', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }} />
            ))}
          </div>
        ) : error ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: C.validationErrorBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>Gagal Memuat Data</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>{error}</div>
            <Btn variant="primary" onClick={handleRefresh} style={{ marginTop: 8 }}>Coba Lagi</Btn>
          </div>
        ) : (notifications.length === 0 && alertItems.length === 0) ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: 40, background: C.primaryTint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 36 }}>🔔</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900 }}>Belum ada notifikasi</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Notifikasi akan muncul saat ada aktivitas baru</div>
          </div>
        ) : (
          <>
            {/* Alert section (dashboard alerts) */}
            {alertItems.length > 0 && (
              <>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.primary, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>
                  Peringatan
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {alertItems.map((n) => {
                    const t = TYPE_ICONS[n.type] || TYPE_ICONS.info;
                    return (
                      <div key={n.id} style={{
                        background: `linear-gradient(135deg, ${t.bg}80, ${C.white})`,
                        borderRadius: 14, padding: isMobile ? '10px 12px' : '12px 14px',
                        boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
                        display: 'flex', gap: 12, alignItems: 'flex-start',
                        borderLeft: `3px solid ${t.color}`,
                        transition: 'transform 0.2s',
                        flexWrap: 'wrap',
                      }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{t.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{n.title}</div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 2, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.message}</div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 4 }}>{n.time}</div>
                        </div>
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: t.color, flexShrink: 0, marginTop: 6 }} />
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Unread section */}
            {notifications.filter((n) => !n.read).length > 0 && (
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>
                Belum Dibaca ({notifications.filter((n) => !n.read).length})
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notifications.filter((n) => !n.read).map((n) => {
                const t = TYPE_ICONS[n.type] || TYPE_ICONS.info;
                return (
                  <div key={n.id} style={{
                    background: `linear-gradient(135deg, ${t.bg}80, ${C.white})`,
                    borderRadius: 14, padding: isMobile ? '10px 12px' : '12px 14px',
                    boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    borderLeft: `3px solid ${t.color}`,
                    transition: 'transform 0.2s',
                    flexWrap: 'wrap',
                  }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{t.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{n.title}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 2, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.message}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 4 }}>{n.time}</div>
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: t.color, flexShrink: 0, marginTop: 6 }} />
                  </div>
                );
              })}
            </div>

            {/* Read section */}
            {notifications.filter((n) => n.read).length > 0 && (
              <>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, letterSpacing: 0.5, marginTop: 20, marginBottom: 8, textTransform: 'uppercase' }}>
                  Sebelumnya
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
                  {notifications.filter((n) => n.read).map((n) => {
                    const t = TYPE_ICONS[n.type] || TYPE_ICONS.info;
                    return (
                      <div key={n.id} style={{
                        background: C.white, borderRadius: 14, padding: isMobile ? '10px 12px' : '12px 14px',
                        boxShadow: '0 1px 4px rgba(15,23,42,0.04)',
                        display: 'flex', gap: 12, alignItems: 'flex-start', opacity: 0.85,
                        flexWrap: 'wrap',
                      }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{t.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 500, color: C.n900 }}>{n.title}</div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 2, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.message}</div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 4 }}>{n.time}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
