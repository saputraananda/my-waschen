import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, MoneyInput, Select } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { useResponsive } from '../../utils/hooks';

// Tier configurations
const TIERS = {
  gold: {
    id: 'gold',
    name: 'Gold',
    icon: '🥇',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    borderColor: '#FCD34D',
    minTopup: 500000,
    duration: '6 bulan',
    discount: '20%',
    benefits: ['Diskon 20% per transaksi', 'Prioritas antrian', 'Akses promo eksklusif'],
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond',
    icon: '💎',
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    borderColor: '#A78BFA',
    minTopup: 1000000,
    duration: '12 bulan',
    discount: '25%',
    benefits: ['Diskon 25% per transaksi', 'Prioritas antrian tinggi', 'Free pickup/delivery', 'Akses promo eksklusif'],
  },
};

export default function MembershipRegistrationPage({ navigate, goBack, screenParams }) {
  const customer = screenParams;
  const { isMobile } = useResponsive();
  const [selectedTier, setSelectedTier] = useState('gold');
  const [topupAmount, setTopupAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentMembership, setCurrentMembership] = useState(null);
  const [membershipLoading, setMembershipLoading] = useState(true);

  // Fetch current membership status
  useEffect(() => {
    const fetchMembership = async () => {
      if (!customer?.id) {
        setMembershipLoading(false);
        return;
      }

      try {
        const res = await axios.get(`/api/membership/status/${customer.id}`);
        if (res?.data?.success) {
          setCurrentMembership(res.data.data);
        }
      } catch {
        // Silent fail for optional membership status
      } finally {
        setMembershipLoading(false);
      }
    };

    fetchMembership();
  }, [customer?.id]);

  const tier = TIERS[selectedTier];
  const minAmount = tier.minTopup;
  const enteredAmount = Number(topupAmount) || 0;
  const meetsMinimum = enteredAmount >= minAmount;

  const handleRegister = async () => {
    if (!meetsMinimum) {
      alertWarning(`Minimal top-up untuk ${tier.name} Membership adalah ${rp(minAmount)}.`);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/membership/register', {
        customerId: customer.id,
        tier: selectedTier,
        topupAmount: Number(topupAmount),
      });

      if (res?.data?.success) {
        const data = res.data.data;
        await alertSuccess(`Membership ${data.tierName} berhasil dibuat!`);
        navigate('detail_customer', {
          ...customer,
          isMember: true,
          memberNo: data.memberNo,
          membershipTier: data.tier,
        });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal membuat membership.';
      alertError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Show if already has active membership
  if (!membershipLoading && currentMembership?.hasMembership) {
    if (currentMembership.isActive) {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50 }}>
          <TopBar title="WPC Membership" subtitle={customer?.name} onBack={goBack} />

          <div style={{ flex: 1, padding: isMobile ? 12 : 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 12 : 16 }}>
            <div style={{ fontSize: isMobile ? 48 : 64 }}>✅</div>
            <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 15 : 18, fontWeight: 700, color: C.n900, textAlign: 'center' }}>
              Anda Sudah Menjadi Member
            </div>
            <div style={{
              background: C.white, borderRadius: isMobile ? 12 : 16, padding: isMobile ? 14 : 20, width: '100%',
              boxShadow: '0 2px 8px rgba(15,23,42,0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 12, marginBottom: isMobile ? 12 : 16 }}>
                <span style={{ fontSize: isMobile ? 32 : 40 }}>{TIERS[currentMembership.tier]?.icon}</span>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: TIERS[currentMembership.tier]?.color }}>
                    WPC {currentMembership.tier === 'diamond' ? 'Diamond' : 'Gold'} Member
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>
                    No. {currentMembership.memberNo || 'N/A'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Diskon</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.success }}>
                  {currentMembership.discountPct}%
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Berlaku sampai</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>
                  {currentMembership.expiredAt ? new Date(currentMembership.expiredAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}
                </span>
              </div>

              {currentMembership.isExpiringSoon && (
                <div style={{
                  background: C.validationWarningBg, borderRadius: 8, padding: '8px 12px',
                  marginTop: 12, fontFamily: 'Poppins', fontSize: 11, color: C.validationWarningText
                }}>
                  ⚠️ Membership akan expired dalam {currentMembership.daysUntilExpiry} hari. Segera renew!
                </div>
              )}
            </div>

            <Btn variant="secondary" fullWidth onClick={goBack}>
              Kembali
            </Btn>
          </div>
        </div>
      );
    } else if (currentMembership.canRenew) {
      // Expired but can renew
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50 }}>
          <TopBar title="Renew Membership" subtitle={customer?.name} onBack={goBack} />

          <div style={{ flex: 1, padding: 20 }}>
            <div style={{
              background: C.validationWarningBg, borderRadius: 12, padding: 16, marginBottom: 16,
              border: `1px solid ${C.validationWarningBorder}`
            }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.validationWarningText, marginBottom: 4 }}>
                ⚠️ Membership Expired
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.validationWarningText }}>
                Membership Anda sudah expired. Renew sekarang untuk tetap menikmati benefit member.
              </div>
            </div>

            <RenewMembershipForm customer={customer} navigate={navigate} goBack={goBack} />
          </div>
        </div>
      );
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50 }}>
      <TopBar title="WPC Membership" subtitle={customer?.name} onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 16 }}>
        {/* Header Info */}
        <div style={{
          background: `linear-gradient(135deg, ${tier.bgColor}, white)`,
          border: `2px solid ${tier.borderColor}`,
          borderRadius: isMobile ? 12 : 16, padding: isMobile ? 14 : 16, marginBottom: 16, textAlign: 'center'
        }}>
          <div style={{ fontSize: isMobile ? 36 : 48, marginBottom: isMobile ? 4 : 8 }}>🎉</div>
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 14 : 16, fontWeight: 700, color: C.n900, marginBottom: 4 }}>
            Bergabung dengan WPC
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 11 : 12, color: C.n600 }}>
            Waschen Priority Club - Nikmati benefit eksklusif sebagai member
          </div>
        </div>

        {/* Tier Selection */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 13, fontWeight: 600, color: C.n600, marginBottom: 8 }}>
            Pilih Tier Membership
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            {Object.values(TIERS).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTier(t.id);
                  // Reset amount if below new tier minimum
                  if (enteredAmount < t.minTopup) {
                    setTopupAmount(String(t.minTopup));
                  }
                }}
                style={{
                  padding: isMobile ? 14 : 16,
                  borderRadius: 12,
                  border: `2px solid ${selectedTier === t.id ? t.color : C.n200}`,
                  background: selectedTier === t.id ? t.bgColor : C.white,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  boxShadow: selectedTier === t.id ? `0 4px 12px ${t.color}30` : 'none',
                }}
              >
                <div style={{ fontSize: isMobile ? 28 : 32, marginBottom: 4 }}>{t.icon}</div>
                <div style={{
                  fontFamily: 'Poppins', fontSize: 14, fontWeight: 700,
                  color: selectedTier === t.id ? t.color : C.n900,
                  marginBottom: 4
                }}>
                  {t.name}
                </div>
                <div style={{
                  fontFamily: 'Poppins', fontSize: 11, color: selectedTier === t.id ? t.color : C.n600
                }}>
                  {t.discount} Diskon
                </div>
                <div style={{
                  fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 4
                }}>
                  {t.duration}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div style={{
          background: C.white, borderRadius: isMobile ? 10 : 12, padding: isMobile ? 14 : 16, marginBottom: 16,
          boxShadow: '0 2px 8px rgba(15,23,42,0.06)'
        }}>
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 13, fontWeight: 600, color: C.n600, marginBottom: 10 }}>
            ✨ Benefit {tier.name} Membership
          </div>
          {tier.benefits.map((benefit, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8
            }}>
              <svg width={isMobile ? 14 : 16} height={isMobile ? 14 : 16} viewBox="0 0 24 24" fill="none" stroke={tier.color} strokeWidth="3" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={{ fontFamily: 'Poppins', fontSize: isMobile ? 11 : 12, color: C.n900 }}>{benefit}</span>
            </div>
          ))}
        </div>

        {/* Top-up Amount */}
        <div style={{
          background: C.white, borderRadius: isMobile ? 10 : 12, padding: isMobile ? 14 : 16, marginBottom: 16,
          boxShadow: '0 2px 8px rgba(15,23,42,0.06)'
        }}>
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 13, fontWeight: 600, color: C.n600, marginBottom: 12 }}>
            Top-up Deposit (Minimum {rp(minAmount)})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
            {[250000, 500000, 1000000, 2000000].map((preset) => (
              <button
                key={preset}
                onClick={() => setTopupAmount(String(preset))}
                style={{
                  padding: isMobile ? '10px 4px' : '8px 4px',
                  borderRadius: 8,
                  border: `1.5px solid ${topupAmount === String(preset) ? tier.color : C.n200}`,
                  background: topupAmount === String(preset) ? tier.bgColor : C.white,
                  cursor: 'pointer',
                  fontFamily: 'Poppins', fontSize: isMobile ? 10 : 10, fontWeight: 600,
                  color: topupAmount === String(preset) ? tier.color : C.n900,
                }}
              >
                {preset >= 1000000 ? `${preset / 1000000}jt` : `${preset / 1000}rb`}
              </button>
            ))}
          </div>
          <MoneyInput
            label="Atau masukkan nominal lain"
            value={topupAmount}
            onChange={(v) => setTopupAmount(v)}
            placeholder="0"
          />

          {!meetsMinimum && topupAmount && (
            <div style={{
              background: C.validationErrorBg, borderRadius: 8, padding: '8px 12px', marginTop: 8,
              fontFamily: 'Poppins', fontSize: 11, color: C.validationErrorText
            }}>
              ⚠️ Minimal top-up untuk {tier.name} adalah {rp(minAmount)}
            </div>
          )}

          <div style={{
            marginTop: 12, padding: 12, background: tier.bgColor, borderRadius: 8,
            fontFamily: 'Poppins', fontSize: 11, color: tier.color
          }}>
            💡 Top-up akan masuk ke deposit customer dan bisa digunakan untuk pembayaran laundry.
          </div>
        </div>

        {/* Summary */}
        <div style={{
          background: C.white, borderRadius: isMobile ? 10 : 12, padding: isMobile ? 14 : 16,
          boxShadow: '0 2px 8px rgba(15,23,42,0.06)'
        }}>
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 13, fontWeight: 600, color: C.n600, marginBottom: 12 }}>
            Ringkasan
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Tier</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: tier.color }}>
              {tier.icon} {tier.name}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Diskon</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.success }}>
              {tier.discount}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Berlaku</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>
              {tier.duration}
            </span>
          </div>
          <div style={{ height: 1, background: C.n200, margin: '12px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>
              Top-up Deposit
            </span>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: tier.color }}>
              {topupAmount ? rp(enteredAmount) : '-'}
            </span>
          </div>
        </div>
      </div>

      <div style={{
        padding: '12px 16px',
        background: C.white,
        borderTop: `1px solid ${C.n100}`,
        position: isMobile ? 'sticky' : 'relative',
        bottom: isMobile ? 0 : 'auto',
        left: 0,
        right: 0,
        zIndex: isMobile ? 10 : 'auto',
        boxShadow: isMobile ? '0 -2px 10px rgba(0,0,0,0.1)' : 'none',
      }}>
        <Btn
          variant="primary"
          fullWidth
          size="lg"
          loading={loading}
          onClick={handleRegister}
          disabled={!meetsMinimum || loading}
          style={meetsMinimum ? {
            background: `linear-gradient(135deg, ${tier.color}, ${tier.color}CC)`,
          } : {}}
        >
          {!meetsMinimum
            ? `Minimal Top-up ${rp(minAmount)}`
            : `Daftar ${tier.name} Membership`}
        </Btn>
      </div>
    </div>
  );
}

// ── Renew Membership Form ────────────────────────────────────────────────────
function RenewMembershipForm({ customer, navigate, goBack }) {
  const { isMobile } = useResponsive();
  const [topupAmount, setTopupAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRenew = async () => {
    if (!topupAmount || Number(topupAmount) < 100000) {
      alertWarning('Minimal top-up untuk renew adalah Rp 100.000.');
      return;
    }

    setLoading(true);
    try {
      // First register new membership
      const res = await axios.post('/api/membership/register', {
        customerId: customer.id,
        tier: 'gold', // Default to gold for renewal
        topupAmount: Number(topupAmount),
      });

      if (res?.data?.success) {
        await alertSuccess('Membership berhasil direnew!');
        navigate('detail_customer', {
          ...customer,
          isMember: true,
          memberNo: res.data.data.memberNo,
          membershipTier: res.data.data.tier,
        });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal merenew membership.';
      alertError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{
        background: C.white, borderRadius: isMobile ? 10 : 12, padding: isMobile ? 14 : 16, marginBottom: 16,
        boxShadow: '0 2px 8px rgba(15,23,42,0.06)'
      }}>
        <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 13, fontWeight: 600, color: C.n600, marginBottom: 12 }}>
          Top-up untuk Renew
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          {[100000, 250000, 500000].map((preset) => (
            <button
              key={preset}
              onClick={() => setTopupAmount(String(preset))}
              style={{
                padding: '10px 4px',
                borderRadius: 8,
                border: `1.5px solid ${topupAmount === String(preset) ? C.primary : C.n200}`,
                background: topupAmount === String(preset) ? C.primaryLight : C.white,
                cursor: 'pointer',
                fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                color: topupAmount === String(preset) ? C.primary : C.n900,
              }}
            >
              {rp(preset)}
            </button>
          ))}
        </div>
        <MoneyInput
          label="Atau masukkan nominal lain"
          value={topupAmount}
          onChange={(v) => setTopupAmount(v)}
          placeholder="0"
        />
      </div>

      <Btn
        variant="primary"
        fullWidth
        size="lg"
        loading={loading}
        onClick={handleRenew}
        disabled={!topupAmount || Number(topupAmount) < 100000 || loading}
      >
        Renew Membership
      </Btn>
    </>
  );
}
