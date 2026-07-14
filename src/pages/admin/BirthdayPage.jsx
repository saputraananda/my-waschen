// ─────────────────────────────────────────────────────────────────────────────
// BirthdayPage.jsx — Birthday Campaign Management
// Phase 7: Customer Segmentation & Birthday Program
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { TopBar, Btn, Chip, Input, Modal, SkeletonBar } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { alertError, alertSuccess, alertWarning, confirmAction } from '../../utils/alert';
import { useResponsive } from '../../utils/hooks';

const F = { fontFamily: 'Poppins' };

// ─── Tab Configuration ────────────────────────────────────────────────────────
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

// ─── Reusable Components ───────────────────────────────────────────────────────
const Card = ({ children, style = {}, accent }) => (
  <div style={{
    background: C.white, borderRadius: 16, padding: 14,
    boxShadow: SHADOW.md,
    borderLeft: accent ? `4px solid ${accent}` : undefined,
    ...style,
  }}>{children}</div>
);

const Pill = ({ children, color = C.n100, textColor = C.n700 }) => (
  <span style={{
    ...F, fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
    background: color, color: textColor, letterSpacing: 0.3, whiteSpace: 'nowrap',
  }}>{children}</span>
);

const StatBox = ({ value, label, color = C.n900, bg }) => (
  <div style={{
    background: bg || C.n50, padding: '12px 14px', borderRadius: 12,
    textAlign: 'center', flex: 1, minWidth: 100,
    boxShadow: SHADOW.sm,
  }}>
    <div style={{ ...F, fontSize: 24, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
    <div style={{ ...F, fontSize: 10, color: C.n500, fontWeight: 600, marginTop: 4 }}>{label}</div>
  </div>
);

const CustomerRow = ({ customer, onSendGreeting, onOfferBonus, sending }) => {
  const isMale = customer.gender === 'male';
  const greeting = isMale ? 'Bapak' : 'Ibu';

  return (
    <div style={{
      background: C.white, borderRadius: 12, padding: 14, marginBottom: 10,
      boxShadow: SHADOW.sm, border: `1px solid ${C.n200}`,
      transition: 'all 0.2s',
    }}>
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...F, fontSize: 14, fontWeight: 600, color: C.n900 }}>
            🎂 {customer.name}
          </div>
          <div style={{ ...F, fontSize: 11, color: C.n500, marginTop: 2 }}>
            {customer.phone}
          </div>
          <div style={{ ...F, fontSize: 11, color: C.n500 }}>
            Outlet: {customer.outletName || '-'}
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {customer.notified && (
            <Pill color={C.success + '20'} textColor={C.success}>✓ Terkirim</Pill>
          )}
          {customer.depositBalance > 0 && (
            <Pill color={C.primary + '20'} textColor={C.primary}>
              💰 Rp {customer.depositBalance.toLocaleString('id-ID')}
            </Pill>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ ...F, fontSize: 10, color: C.n500 }}>
          📝 {customer.transactionCount || 0} transaksi
        </div>
        <div style={{ ...F, fontSize: 10, color: C.n500 }}>
          💵 Rp {(customer.totalSpending || 0).toLocaleString('id-ID')}
        </div>
        {customer.lastTransactionDate && (
          <div style={{ ...F, fontSize: 10, color: C.n500 }}>
            🕐 {new Date(customer.lastTransactionDate).toLocaleDateString('id-ID')}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {!customer.notified ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn
            size="sm"
            variant="primary"
            loading={sending === customer.id}
            onClick={() => onSendGreeting(customer)}
            style={{ flex: 1 }}
          >
            🎉 Kirim Ucapan
          </Btn>
          <Btn
            size="sm"
            variant="outline"
            onClick={() => onOfferBonus(customer)}
            style={{ flex: 1 }}
          >
            🎁 Bonus Deposit
          </Btn>
        </div>
      ) : (
        <div style={{ ...F, fontSize: 12, color: C.success, textAlign: 'center', padding: '8px 0' }}>
          ✓ Sudah dikirim ucapan hari ini
        </div>
      )}
    </div>
  );
};

const UpcomingRow = ({ customer, search }) => {
  const highlight = (text) => {
    if (!search || !text) return text;
    const regex = new RegExp(`(${search})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} style={{ background: C.warning + '40', fontWeight: 600 }}>{part}</span>
      ) : part
    );
  };

  return (
    <div style={{
      background: C.white, borderRadius: 12, padding: 12, marginBottom: 8,
      boxShadow: SHADOW.sm, border: `1px solid ${C.n200}`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <div style={{ ...F, fontSize: 13, fontWeight: 600, color: C.n900 }}>
          🎂 {highlight(customer.name)}
        </div>
        <div style={{ ...F, fontSize: 11, color: C.n500 }}>
          {highlight(customer.phone)} • {customer.formattedDate}
        </div>
      </div>
      <Pill color={C.primary + '20'} textColor={C.primary}>
        {customer.daysUntil === 1 ? 'Besok' : `${customer.daysUntil} hari`}
      </Pill>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export function BirthdayPageContent({ navigate, goBack }) {
  const { isMobile } = useResponsive();
  const [activeTab, setActiveTab] = useState('today');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(null);
  const [todayData, setTodayData] = useState({ customers: [], toNotify: [], alreadyNotified: [] });
  const [upcomingData, setUpcomingData] = useState([]);
  const [statsData, setStatsData] = useState(null);
  const [search, setSearch] = useState('');

  // Modal states
  const [showGreetingModal, setShowGreetingModal] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customMessage, setCustomMessage] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');

  const { userRole } = useApp();
  const isAdmin = ['admin', 'superadmin', 'owner', 'finance'].includes(userRole);

  // ─── Data Fetching ─────────────────────────────────────────────────────────
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

  // ─── Actions ────────────────────────────────────────────────────────────────
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

    const confirmed = await confirmAction(
      `Kirim ucapan ke ${toNotify.length} customer?`,
      'Ya, Kirim Semua'
    );

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

  // ─── Render Helpers ────────────────────────────────────────────────────────
  const renderToday = () => {
    const { customers = [], toNotify = [], alreadyNotified = [] } = todayData;

    if (loading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <SkeletonBar key={i} height={160} radius={12} />
          ))}
        </div>
      );
    }

    if (customers.length === 0) {
      return (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎂</div>
            <div style={{ ...F, fontSize: 14, fontWeight: 600, color: C.n700 }}>
              Tidak Ada Ultah Hari Ini
            </div>
            <div style={{ ...F, fontSize: 12, color: C.n500, marginTop: 4 }}>
              Cek kembali di hari lain atau lihat jadwal mendatang
            </div>
          </div>
        </Card>
      );
    }

    return (
      <>
        {/* Summary Stats */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{ flexShrink: 0, minWidth: 100 }}>
            <StatBox value={toNotify.length} label="BELUM TERKIRIM" color={C.warning} bg={C.warning + '15'} />
          </div>
          <div style={{ flexShrink: 0, minWidth: 100 }}>
            <StatBox value={alreadyNotified.length} label="SUDAH TERKIRIM" color={C.success} bg={C.success + '15'} />
          </div>
          <div style={{ flexShrink: 0, minWidth: 100 }}>
            <StatBox value={customers.length} label="TOTAL" color={C.primary} bg={C.primary + '15'} />
          </div>
        </div>

        {/* Bulk Action */}
        {toNotify.length > 0 && (
          <Btn
            variant="primary"
            onClick={handleBulkSend}
            style={{ marginBottom: 16, width: '100%' }}
          >
            🎉 Kirim Semua ({toNotify.length} customer)
          </Btn>
        )}

        {/* Customer List */}
        {customers.map(customer => (
          <CustomerRow
            key={customer.id}
            customer={customer}
            onSendGreeting={handleSendGreeting}
            onOfferBonus={handleOfferBonus}
            sending={sending}
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
            <SkeletonBar key={i} height={60} radius={12} />
          ))}
        </div>
      );
    }

    return (
      <>
        {/* Search */}
        <Input
          placeholder="Cari nama atau nomor HP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        {/* List */}
        {upcomingData.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '30px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
              <div style={{ ...F, fontSize: 13, color: C.n500 }}>
                Tidak ada ultah dalam 7 hari ke depan
              </div>
            </div>
          </Card>
        ) : (
          upcomingData.map(customer => (
            <UpcomingRow key={customer.id} customer={customer} search={search} />
          ))
        )}
      </>
    );
  };

  const renderStats = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SkeletonBar height={80} radius={12} />
          <SkeletonBar height={200} radius={12} />
        </div>
      );
    }

    const { totalCustomersWithBirthday = 0, dailyStats = [], pendingOffers = [] } = statsData || {};

    return (
      <>
        {/* Summary */}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ ...F, fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 12 }}>
            📊 Ringkasan Bulan Ini
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            <div style={{ flexShrink: 0, minWidth: 120 }}>
              <StatBox
                value={totalCustomersWithBirthday}
                label="Customer Ultah"
                color={C.primary}
                bg={C.primary + '15'}
              />
            </div>
            <div style={{ flexShrink: 0, minWidth: 120 }}>
              <StatBox
                value={pendingOffers.length}
                label="Offer Pending"
                color={C.warning}
                bg={C.warning + '15'}
              />
            </div>
          </div>
        </Card>

        {/* Pending Offers */}
        {pendingOffers.length > 0 && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ ...F, fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 12 }}>
              🎁 Offer Pending
            </div>
            {pendingOffers.map(offer => (
              <div key={offer.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: `1px solid ${C.n200}`,
              }}>
                <div>
                  <div style={{ ...F, fontSize: 12, fontWeight: 600 }}>{offer.customerName}</div>
                  <div style={{ ...F, fontSize: 10, color: C.n500 }}>
                    {new Date(offer.createdAt).toLocaleDateString('id-ID')}
                  </div>
                </div>
                <Pill color={C.warning + '20'} textColor={C.warning}>
                  Rp {offer.bonusAmount.toLocaleString('id-ID')}
                </Pill>
              </div>
            ))}
          </Card>
        )}

        {/* Daily Stats */}
        <Card>
          <div style={{ ...F, fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 12 }}>
            📈 Statistik Harian
          </div>
          {dailyStats.length === 0 ? (
            <div style={{ ...F, fontSize: 12, color: C.n500, textAlign: 'center', padding: '20px 0' }}>
              Belum ada data statistik
            </div>
          ) : (
            dailyStats.map((day, idx) => (
              <div key={idx} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: `1px solid ${C.n200}`,
              }}>
                <div style={{ ...F, fontSize: 12, color: C.n700 }}>
                  {new Date(day.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Pill color={C.success + '20'} textColor={C.success}>
                    ✓ {day.sent}
                  </Pill>
                  {day.failed > 0 && (
                    <Pill color={C.error + '20'} textColor={C.error}>
                      ✗ {day.failed}
                    </Pill>
                  )}
                </div>
              </div>
            ))
          )}
        </Card>
      </>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title={titles[activeTab]?.title || '🎂 Birthday'}
        subtitle={titles[activeTab]?.subtitle}
        onBack={goBack}
      />

      {/* Tab Bar */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 16px',
        background: C.white, borderBottom: `1px solid ${C.n200}`,
        overflowX: 'auto',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...F, fontSize: 11, fontWeight: 600,
              padding: '8px 16px', borderRadius: 999,
              border: 'none', cursor: 'pointer',
              background: activeTab === tab.id ? C.primary : C.n100,
              color: activeTab === tab.id ? C.white : C.n700,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
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
            <div style={{ ...F, fontSize: 13, color: C.n700, marginBottom: 16 }}>
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

            {/* Preview */}
            <div style={{
              background: C.n50, borderRadius: 12, padding: 14,
              border: `1px dashed ${C.n300}`,
            }}>
              <div style={{ ...F, fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 8 }}>
                📝 Preview Pesan:
              </div>
              <div style={{ ...F, fontSize: 12, color: C.n800, whiteSpace: 'pre-wrap' }}>
                {customMessage || `Selamat ulang tahun, ${selectedCustomer.gender === 'male' ? 'Bapak' : 'Ibu'} ${selectedCustomer.name}! 🎂\n\nSemoga tahun ini penuh kebahagiaan dan keberkahan. Terima kasih sudah menjadi bagian dari keluarga Waschen!`}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Btn variant="outline" onClick={() => setShowGreetingModal(false)} style={{ flex: 1 }}>
                Batal
              </Btn>
              <Btn
                variant="primary"
                loading={sending === selectedCustomer.id}
                onClick={confirmSendGreeting}
                style={{ flex: 1 }}
              >
                🎉 Kirim
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Bonus Modal */}
      {showBonusModal && selectedCustomer && (
        <Modal onClose={() => setShowBonusModal(false)} title="🎁 Offer Bonus Deposit">
          <div style={{ padding: '0 4px 8px' }}>
            <div style={{ ...F, fontSize: 13, color: C.n700, marginBottom: 16 }}>
              Berikan bonus deposit ke <strong>{selectedCustomer.name}</strong>?
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ ...F, fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 6 }}>
                Jumlah Bonus (Rp)
              </div>
              <input
                type="number"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(e.target.value)}
                placeholder="50000"
                style={{
                  ...F, fontSize: 14, width: '100%', padding: '12px 14px',
                  border: `1.5px solid ${C.n300}`, borderRadius: 10, outline: 'none',
                }}
              />
              <div style={{ ...F, fontSize: 10, color: C.n500, marginTop: 4 }}>
                Default: Rp 50.000
              </div>
            </div>

            <div style={{
              background: C.primary + '15', borderRadius: 12, padding: 14,
              border: `1px solid ${C.primary}30`,
            }}>
              <div style={{ ...F, fontSize: 11, color: C.n700 }}>
                💡 <strong>Info:</strong> Bonus deposit akan masuk ke wallet customer dan bisa digunakan kapan saja. Offer berlaku 30 hari.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Btn variant="outline" onClick={() => setShowBonusModal(false)} style={{ flex: 1 }}>
                Batal
              </Btn>
              <Btn
                variant="primary"
                loading={sending === selectedCustomer.id}
                onClick={confirmOfferBonus}
                style={{ flex: 1 }}
              >
                🎁 Kirim Offer
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default BirthdayPageContent;
