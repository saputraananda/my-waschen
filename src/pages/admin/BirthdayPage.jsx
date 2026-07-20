// ─────────────────────────────────────────────────────────────────────────────
// BirthdayPage.jsx — Birthday Campaign Management
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { TopBar, Btn, Chip, Input, Modal, SkeletonBar } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { alertError, alertSuccess, alertWarning, confirmAction } from '../../utils/alert';
import { useResponsive } from '../../utils/hooks';
import { FloatingBubble, Sparkle, GlowOrb } from '../../components/ui/PremiumAnimations';
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp';
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp';

const F = { fontFamily: 'Poppins' };

const cardStyle = {
  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
  boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
  borderRadius: 18,
};

const shimmerKeyframes = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

const tabs = [
  { id: 'today', label: '🎂 Hari Ini' },
  { id: 'upcoming', label: '📅 Mendatang' },
  { id: 'stats', label: '📊 Statistik' },
];

const titles = {
  today: { title: '🎂 Ulang Tahun Hari Ini', subtitle: 'Kirim ucapan & promo spesial' },
  upcoming: { title: '📅 Ulang Tahun Mendatang', subtitle: '7 hari ke depan' },
  stats: { title: '📊 Statistik Birthday', subtitle: 'Performa campaign' },
};

const Card = ({ children, style = {}, accent }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    style={{
      background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
      borderRadius: 16,
      padding: 14,
      boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
      borderLeft: accent ? `4px solid ${accent}` : undefined,
      ...style,
    }}>{children}</motion.div>
);

const Pill = ({ children, color = '#F3EEF7', textColor = '#5B005F' }) => (
  <span style={{
    ...F, fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
    background: color, color: textColor, letterSpacing: 0.3, whiteSpace: 'nowrap',
  }}>{children}</span>
);

const StatBox = ({ value, label, color = '#5B005F', bg }) => (
  <motion.div
    initial={{ scale: 0.9 }}
    animate={{ scale: 1 }}
    style={{
      background: bg || '#F3EEF7', padding: '12px 14px', borderRadius: 12,
      textAlign: 'center', flex: 1, minWidth: 100,
      boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
    }}>
    <div style={{ ...F, fontSize: 24, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
    <div style={{ ...F, fontSize: 10, color: '#9E9E9E', fontWeight: 600, marginTop: 4 }}>{label}</div>
  </motion.div>
);

const CustomerRow = ({ customer, onSendGreeting, onOfferBonus, sending, idx }) => {
  const isMale = customer.gender === 'male';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04 }}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
        borderRadius: 12, padding: 14, marginBottom: 10,
        boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
        border: '1px solid #E8DDF0',
        transition: 'all 0.2s',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...F, fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
            🎂 {customer.name}
          </div>
          <div style={{ ...F, fontSize: 11, color: '#757575', marginTop: 2 }}>
            {customer.phone}
          </div>
          <div style={{ ...F, fontSize: 11, color: '#9E9E9E' }}>
            Outlet: {customer.outletName || '-'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {customer.notified && (
            <Pill color="#E8F5E9" textColor="#2E7D32">✓ Terkirim</Pill>
          )}
          {customer.depositBalance > 0 && (
            <Pill color="rgba(91, 0, 95, 0.1)" textColor="#5B005F">
              💰 Rp {customer.depositBalance.toLocaleString('id-ID')}
            </Pill>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ ...F, fontSize: 10, color: '#757575' }}>
          📝 {customer.transactionCount || 0} transaksi
        </div>
        <div style={{ ...F, fontSize: 10, color: '#757575' }}>
          💵 Rp {(customer.totalSpending || 0).toLocaleString('id-ID')}
        </div>
        {customer.lastTransactionDate && (
          <div style={{ ...F, fontSize: 10, color: '#9E9E9E' }}>
            🕐 {new Date(customer.lastTransactionDate).toLocaleDateString('id-ID')}
          </div>
        )}
      </div>
      {!customer.notified ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onSendGreeting(customer)}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #5B005F 0%, #7B0078 100%)',
              color: '#FFFFFF', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            🎉 Kirim Ucapan
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onOfferBonus(customer)}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 12,
              border: '1.5px solid #5B005F', background: '#FFFFFF',
              color: '#5B005F', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            🎁 Bonus Deposit
          </motion.button>
        </div>
      ) : (
        <div style={{ ...F, fontSize: 12, color: '#2E7D32', textAlign: 'center', padding: '8px 0', background: '#E8F5E9', borderRadius: 8 }}>
          ✓ Sudah dikirim ucapan hari ini
        </div>
      )}
    </motion.div>
  );
};

const UpcomingRow = ({ customer, search, idx }) => {
  const highlight = (text) => {
    if (!search || !text) return text;
    const regex = new RegExp(`(${search})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} style={{ background: '#FFF3E0', fontWeight: 600 }}>{part}</span>
      ) : part
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04 }}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
        borderRadius: 12, padding: 12, marginBottom: 8,
        boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
        border: '1px solid #E8DDF0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
      <div>
        <div style={{ ...F, fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
          🎂 {highlight(customer.name)}
        </div>
        <div style={{ ...F, fontSize: 11, color: '#757575' }}>
          {highlight(customer.phone)} • {customer.formattedDate}
        </div>
      </div>
      <Pill color="rgba(91, 0, 95, 0.1)" textColor="#5B005F">
        {customer.daysUntil === 1 ? 'Besok' : `${customer.daysUntil} hari`}
      </Pill>
    </motion.div>
  );
};

export function BirthdayPageContent({ navigate, goBack }) {
  const { isMobile } = useResponsive();
  const [activeTab, setActiveTab] = useState('today');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(null);
  const [todayData, setTodayData] = useState({ customers: [], toNotify: [], alreadyNotified: [] });
  const [upcomingData, setUpcomingData] = useState([]);
  const [statsData, setStatsData] = useState(null);
  const [search, setSearch] = useState('');

  const [showGreetingModal, setShowGreetingModal] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customMessage, setCustomMessage] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');

  const { userRole } = useApp();
  const isAdmin = ['admin'].includes(userRole);

  const fetchTodayBirthdays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/birthday/today');
      if (res?.data?.success) {
        setTodayData(res.data.data);
      }
    } catch (err) {
      alertError('Gagal memuat data ulang tahun hari ini');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUpcomingBirthdays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/birthday/upcoming?days=7&search=${encodeURIComponent(search)}`);
      if (res?.data?.success) {
        setUpcomingData(res.data.data);
      }
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/birthday/stats');
      if (res?.data?.success) {
        setStatsData(res.data.data);
      }
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'today') fetchTodayBirthdays();
    if (activeTab === 'upcoming') fetchUpcomingBirthdays();
    if (activeTab === 'stats') fetchStats();
  }, [activeTab, fetchTodayBirthdays, fetchUpcomingBirthdays, fetchStats]);

  const handleSendGreeting = async (customer) => {
    setSelectedCustomer(customer);
    setCustomMessage('');
    setShowGreetingModal(true);
  };

  const confirmSendGreeting = async () => {
    if (!selectedCustomer) return;
    setSending(selectedCustomer.id);
    try {
      const res = await axios.post('/api/birthday/send', {
        customerId: selectedCustomer.id,
        messageType: 'greeting',
        customMessage: customMessage || null,
      });
      if (res?.data?.success) {
        alertSuccess(res.data.message || 'Ucapan berhasil dikirim!');
        setShowGreetingModal(false);
        setSelectedCustomer(null);
        fetchTodayBirthdays();
      } else {
        alertError(res?.data?.message || 'Gagal mengirim ucapan');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal mengirim ucapan';
      if (err?.response?.status === 409) {
        alertWarning(msg);
      } else {
        alertError(msg);
      }
    } finally {
      setSending(null);
    }
  };

  const handleOfferBonus = async (customer) => {
    setSelectedCustomer(customer);
    setBonusAmount('');
    setShowBonusModal(true);
  };

  const confirmOfferBonus = async () => {
    if (!selectedCustomer) return;
    setSending(selectedCustomer.id);
    try {
      const res = await axios.post('/api/birthday/offer-deposit-bonus', {
        customerId: selectedCustomer.id,
        bonusAmount: parseInt(bonusAmount) || 50000,
        message: null,
      });
      if (res?.data?.success) {
        alertSuccess(res.data.message || 'Bonus deposit berhasil di-offer!');
        setShowBonusModal(false);
        setSelectedCustomer(null);
        fetchTodayBirthdays();
      } else {
        alertError(res?.data?.message || 'Gagal membuat offer');
      }
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal membuat offer bonus');
    } finally {
      setSending(null);
    }
  };

  const handleBulkSend = async () => {
    const toNotify = todayData.toNotify || [];
    if (toNotify.length === 0) {
      alertWarning('Tidak ada customer yang perlu dikirimi ucapan');
      return;
    }
    const confirmed = await confirmAction(`Kirim ucapan ke ${toNotify.length} customer?`, 'Ya, Kirim Semua');
    if (!confirmed) return;
    setLoading(true);
    try {
      const res = await axios.post('/api/birthday/send-bulk', {
        customerIds: toNotify.map(c => c.id),
        messageType: 'greeting',
      });
      if (res?.data?.success) {
        alertSuccess(res.data.message || 'Bulk sending complete!');
        fetchTodayBirthdays();
      } else {
        alertError(res?.data?.message || 'Gagal mengirim bulk');
      }
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal mengirim bulk');
    } finally {
      setLoading(false);
    }
  };

  const renderToday = () => {
    const { customers = [], toNotify = [], alreadyNotified = [] } = todayData;
    if (loading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              style={{
                ...cardStyle, padding: 16,
                background: `linear-gradient(90deg, #F0E6F5 25%, #FFFFFF 50%, #F0E6F5 75%)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                height: 160,
              }}
            />
          ))}
        </div>
      );
    }
    if (customers.length === 0) {
      return (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎂</div>
            <div style={{ ...F, fontSize: 14, fontWeight: 600, color: '#5B005F' }}>
              Tidak Ada Ultah Hari Ini
            </div>
            <div style={{ ...F, fontSize: 12, color: '#9E9E9E', marginTop: 4 }}>
              Cek kembali di hari lain atau lihat jadwal mendatang
            </div>
          </div>
        </Card>
      );
    }
    return (
      <>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{ flexShrink: 0, minWidth: 100 }}>
            <StatBox value={toNotify.length} label="BELUM TERKIRIM" color="#E65100" bg="rgba(230, 81, 0, 0.1)" />
          </div>
          <div style={{ flexShrink: 0, minWidth: 100 }}>
            <StatBox value={alreadyNotified.length} label="SUDAH TERKIRIM" color="#2E7D32" bg="rgba(46, 125, 50, 0.1)" />
          </div>
          <div style={{ flexShrink: 0, minWidth: 100 }}>
            <StatBox value={customers.length} label="TOTAL" color="#5B005F" bg="rgba(91, 0, 95, 0.1)" />
          </div>
        </div>
        {toNotify.length > 0 && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleBulkSend}
            style={{
              marginBottom: 16, width: '100%', padding: '12px 20px',
              borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #5B005F 0%, #7B0078 100%)',
              color: '#FFFFFF', fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            🎉 Kirim Semua ({toNotify.length} customer)
          </motion.button>
        )}
        {customers.map((customer, idx) => (
          <CustomerRow
            key={customer.id}
            customer={customer}
            onSendGreeting={handleSendGreeting}
            onOfferBonus={handleOfferBonus}
            sending={sending}
            idx={idx}
          />
        ))}
      </>
    );
  };

  const renderUpcoming = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4].map(i => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              style={{
                ...cardStyle, padding: 12,
                background: `linear-gradient(90deg, #F0E6F5 25%, #FFFFFF 50%, #F0E6F5 75%)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                height: 60,
              }}
            />
          ))}
        </div>
      );
    }
    return (
      <>
        <Input
          placeholder="Cari nama atau nomor HP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 14 }}
        />
        {upcomingData.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '30px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
              <div style={{ ...F, fontSize: 13, color: '#9E9E9E' }}>
                Tidak ada ultah dalam 7 hari ke depan
              </div>
            </div>
          </Card>
        ) : (
          upcomingData.map((customer, idx) => (
            <UpcomingRow key={customer.id} customer={customer} search={search} idx={idx} />
          ))
        )}
      </>
    );
  };

  const renderStats = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              ...cardStyle, padding: 16,
              background: `linear-gradient(90deg, #F0E6F5 25%, #FFFFFF 50%, #F0E6F5 75%)`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              height: 80,
            }}
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{
              ...cardStyle, padding: 16,
              background: `linear-gradient(90deg, #F0E6F5 25%, #FFFFFF 50%, #F0E6F5 75%)`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              height: 200,
            }}
          />
        </div>
      );
    }
    const { totalCustomersWithBirthday = 0, dailyStats = [], pendingOffers = [] } = statsData || {};
    return (
      <>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ ...F, fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 12 }}>
            📊 Ringkasan Bulan Ini
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            <div style={{ flexShrink: 0, minWidth: 120 }}>
              <StatBox value={totalCustomersWithBirthday} label="Customer Ultah" color="#5B005F" bg="rgba(91, 0, 95, 0.1)" />
            </div>
            <div style={{ flexShrink: 0, minWidth: 120 }}>
              <StatBox value={pendingOffers.length} label="Offer Pending" color="#E65100" bg="rgba(230, 81, 0, 0.1)" />
            </div>
          </div>
        </Card>
        {pendingOffers.length > 0 && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ ...F, fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 12 }}>
              🎁 Offer Pending
            </div>
            {pendingOffers.map((offer, idx) => (
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid #E8DDF0',
                }}>
                <div>
                  <div style={{ ...F, fontSize: 12, fontWeight: 600 }}>{offer.customerName}</div>
                  <div style={{ ...F, fontSize: 10, color: '#9E9E9E' }}>
                    {new Date(offer.createdAt).toLocaleDateString('id-ID')}
                  </div>
                </div>
                <Pill color="rgba(230, 81, 0, 0.1)" textColor="#E65100">
                  Rp {offer.bonusAmount.toLocaleString('id-ID')}
                </Pill>
              </motion.div>
            ))}
          </Card>
        )}
        <Card>
          <div style={{ ...F, fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 12 }}>
            📈 Statistik Harian
          </div>
          {dailyStats.length === 0 ? (
            <div style={{ ...F, fontSize: 12, color: '#9E9E9E', textAlign: 'center', padding: '20px 0' }}>
              Belum ada data statistik
            </div>
          ) : (
            dailyStats.map((day, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid #E8DDF0',
                }}>
                <div style={{ ...F, fontSize: 12, color: '#5B005F' }}>
                  {new Date(day.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Pill color="rgba(46, 125, 50, 0.1)" textColor="#2E7D32">✓ {day.sent}</Pill>
                  {day.failed > 0 && (
                    <Pill color="rgba(211, 47, 47, 0.1)" textColor="#D32F2F">✗ {day.failed}</Pill>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </Card>
      </>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F3EEF7', overflow: 'hidden' }}>
      <style>{shimmerKeyframes}</style>

      {/* Premium Header */}
      <div style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: 8,
        paddingBottom: 16,
      }}>
        <GlowOrb color="#E040FB" size={120} opacity={0.15} top="-20px" right="-20px" />
        <GlowOrb color="#FF6D00" size={80} opacity={0.1} bottom="-10px" left="20%" />
        <FloatingBubble src={bubbleIcon} size={28} top="12px" right="60px" />
        <FloatingBubble src={bubble2Icon} size={22} top="28px" right="20px" delay={0.5} />
        <Sparkle color="#FFD700" size={16} top="8px" left="40%" delay={0.2} />
        <Sparkle color="#FFFFFF" size={12} top="32px" left="25%" delay={0.8} />

        <TopBar title={titles[activeTab]?.title || '🎂 Birthday'} subtitle={titles[activeTab]?.subtitle} onBack={goBack} isPremium />
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 16px',
        background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
        borderBottom: '1px solid #E8DDF0',
        overflowX: 'auto',
      }}>
        {tabs.map(tab => (
          <motion.button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            whileTap={{ scale: 0.97 }}
            style={{
              ...F, fontSize: 11, fontWeight: 600,
              padding: '8px 16px', borderRadius: 999,
              border: 'none', cursor: 'pointer',
              background: activeTab === tab.id ? 'linear-gradient(135deg, #5B005F 0%, #7B0078 100%)' : '#F3EEF7',
              color: activeTab === tab.id ? '#FFFFFF' : '#5B005F',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </motion.button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, overflowX: 'hidden' }}>
        {activeTab === 'today' && renderToday()}
        {activeTab === 'upcoming' && renderUpcoming()}
        {activeTab === 'stats' && renderStats()}
      </div>

      {/* Greeting Modal */}
      {showGreetingModal && selectedCustomer && (
        <Modal onClose={() => setShowGreetingModal(false)} title="🎉 Kirim Ucapan Ulang Tahun">
          <div style={{ padding: '0 4px 8px' }}>
            <div style={{ ...F, fontSize: 13, color: '#5B005F', marginBottom: 16 }}>
              Kirim ucapan ke <strong>{selectedCustomer.name}</strong> ({selectedCustomer.phone})?
            </div>
            <Input
              label="Pesan Kustom (opsional)"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Kosongkan untuk pakai template default..."
              multiline
              rows={4}
              style={{ marginBottom: 16 }}
            />
            <div style={{
              background: '#F3EEF7', borderRadius: 12, padding: 14,
              border: '1px dashed #E8DDF0',
            }}>
              <div style={{ ...F, fontSize: 11, fontWeight: 600, color: '#5B005F', marginBottom: 8 }}>
                📝 Preview Pesan:
              </div>
              <div style={{ ...F, fontSize: 12, color: '#1A1A1A', whiteSpace: 'pre-wrap' }}>
                {customMessage || `Selamat ulang tahun, ${selectedCustomer.gender === 'male' ? 'Bapak' : 'Ibu'} ${selectedCustomer.name}! 🎂\n\nSemoga tahun ini penuh kebahagiaan dan keberkahan. Terima kasih sudah menjadi bagian dari keluarga Waschen!`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowGreetingModal(false)} style={{ flex: 1, padding: '10px 16px', borderRadius: 12, border: '1.5px solid #E8DDF0', background: '#FFFFFF', fontFamily: 'Poppins', fontSize: 13, cursor: 'pointer' }}>
                Batal
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={confirmSendGreeting} style={{ flex: 1, padding: '10px 16px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #5B005F 0%, #7B0078 100%)', color: '#FFFFFF', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                🎉 Kirim
              </motion.button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bonus Modal */}
      {showBonusModal && selectedCustomer && (
        <Modal onClose={() => setShowBonusModal(false)} title="🎁 Offer Bonus Deposit">
          <div style={{ padding: '0 4px 8px' }}>
            <div style={{ ...F, fontSize: 13, color: '#5B005F', marginBottom: 16 }}>
              Berikan bonus deposit ke <strong>{selectedCustomer.name}</strong>?
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ ...F, fontSize: 12, fontWeight: 600, color: '#5B005F', marginBottom: 6 }}>
                Jumlah Bonus (Rp)
              </div>
              <input
                type="number"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(e.target.value)}
                placeholder="50000"
                style={{
                  ...F, fontSize: 14, width: '100%', padding: '12px 14px',
                  border: '1.5px solid #E8DDF0', borderRadius: 10, outline: 'none', background: '#FAFAFA',
                }}
              />
              <div style={{ ...F, fontSize: 10, color: '#9E9E9E', marginTop: 4 }}>
                Default: Rp 50.000
              </div>
            </div>
            <div style={{
              background: 'rgba(91, 0, 95, 0.1)', borderRadius: 12, padding: 14,
              border: '1px solid rgba(91, 0, 95, 0.2)',
            }}>
              <div style={{ ...F, fontSize: 11, color: '#5B005F' }}>
                💡 <strong>Info:</strong> Bonus deposit akan masuk ke wallet customer dan bisa digunakan kapan saja. Offer berlaku 30 hari.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowBonusModal(false)} style={{ flex: 1, padding: '10px 16px', borderRadius: 12, border: '1.5px solid #E8DDF0', background: '#FFFFFF', fontFamily: 'Poppins', fontSize: 13, cursor: 'pointer' }}>
                Batal
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={confirmOfferBonus} style={{ flex: 1, padding: '10px 16px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #5B005F 0%, #7B0078 100%)', color: '#FFFFFF', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                🎁 Kirim Offer
              </motion.button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default BirthdayPageContent;
