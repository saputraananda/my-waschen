import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, MoneyInput } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { useResponsive } from '../../utils/hooks';

const PRESETS = ['50000', '100000', '200000', '500000'];

const PAY_METHODS = [
  { key: 'cash',     label: '💵 Tunai',          desc: 'Customer bayar di kasir' },
  { key: 'transfer', label: '🏦 Transfer Manual', desc: 'Verifikasi manual oleh finance' },
  { key: 'qris',     label: '📱 QRIS Statis',     desc: 'QR cetak / EDC manual' },
];

// Membership tier configurations
const TIERS = {
  gold: {
    id: 'gold',
    name: 'Gold',
    icon: '🥇',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    minTopup: 500000,
    duration: '6 bulan',
    discount: '20%',
    benefits: ['Diskon 20%', 'Prioritas antrian'],
    bonusAmount: 25000,
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond',
    icon: '💎',
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    minTopup: 1000000,
    duration: '12 bulan',
    discount: '25%',
    benefits: ['Diskon 25%', 'Priority support', 'Free pickup'],
    bonusAmount: 50000,
  },
};

export default function TopupDepositPage({ navigate, goBack, screenParams }) {
  const customer = screenParams;
  const { isMobile } = useResponsive();

  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [loading, setLoading] = useState(false);

  // Membership opt-in state
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState('gold');
  const [registeringMembership, setRegisteringMembership] = useState(false);
  const [bonusEnabled, setBonusEnabled] = useState(true);

  // If no customer provided, show error state
  if (!customer?.id) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.n50, padding: 24 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>😕</div>
        <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n800, marginBottom: 8 }}>
          Customer tidak ditemukan
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600, textAlign: 'center', marginBottom: 20 }}>
          Silakan pilih customer dari menu Top Up Deposit
        </div>
        <Btn variant="primary" onClick={goBack}>
          Kembali
        </Btn>
      </div>
    );
  }

  const enteredAmount = Number(amount) || 0;

  // Fetch membership status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await axios.get(`/api/membership/status/${customer.id}`);
        if (res?.data?.success) {
          setMembershipStatus(res.data.data);
        }
      } catch {
        // Silent fail
      }
    };
    fetchStatus();
  }, [customer.id]);

  // Fetch bonus status
  useEffect(() => {
    const fetchTierInfo = async () => {
      try {
        const res = await axios.get('/api/membership/tiers');
        if (res?.data?.success) {
          setBonusEnabled(res.data.data.bonusEnabled !== false);
        }
      } catch {
        // Silent fail
      }
    };
    fetchTierInfo();
  }, []);

  const handleTopUp = async () => {
    if (enteredAmount < 1000) {
      alertWarning('Nominal top up minimal Rp 1.000.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`/api/customers/${customer.id}/topup`, {
        amount: enteredAmount,
        payMethod,
      });
      const newBalance = res?.data?.data?.newBalance ?? (customer.deposit || 0) + enteredAmount;
      await alertSuccess(`Top up ${rp(enteredAmount)} berhasil!`);
      navigate('detail_customer', { ...customer, deposit: newBalance });
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal melakukan top up.';
      alertError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterMembership = async () => {
    const tier = TIERS[selectedTier];
    if (enteredAmount < tier.minTopup) {
      alertWarning(`Minimal top-up untuk ${tier.name} Membership adalah ${rp(tier.minTopup)}.`);
      return;
    }

    setRegisteringMembership(true);
    try {
      const res = await axios.post('/api/membership/register', {
        customerId: customer.id,
        tier: selectedTier,
        topupAmount: enteredAmount,
      });

      if (res?.data?.success) {
        const bonusMsg = res.data.data?.bonusApplied > 0
          ? ` Bonus Rp ${rp(res.data.data.bonusApplied)} ditambahkan!`
          : '';
        await alertSuccess(`Membership ${tier.name} berhasil dibuat!${bonusMsg}`);
        setShowMembershipModal(false);
        navigate('detail_customer', {
          ...customer,
          isMember: true,
          memberNo: res.data.data.memberNo,
          membershipTier: res.data.data.tier,
        });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal membuat membership.';
      alertError(msg);
    } finally {
      setRegisteringMembership(false);
    }
  };

  const handleRenewMembership = async () => {
    if (enteredAmount < 100000) {
      alertWarning('Minimal top-up untuk renew adalah Rp 100.000.');
      return;
    }

    if (!membershipStatus?.id) {
      alertError('Membership tidak ditemukan.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`/api/membership/${membershipStatus.id}/renew`, {
        topupAmount: enteredAmount,
      });

      if (res?.data?.success) {
        const bonusMsg = res.data.data?.bonusApplied > 0
          ? ` Bonus Rp ${rp(res.data.data.bonusApplied)} ditambahkan!`
          : '';
        await alertSuccess(`Membership berhasil direnew!${bonusMsg}`);
        navigate('detail_customer', { ...customer });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal merenew membership.';
      alertError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Membership logic
  const canRegisterMembership = !membershipStatus?.hasMembership;
  const canRenewMembership = membershipStatus?.hasMembership && !membershipStatus?.isActive && membershipStatus?.canRenew;
  const tier = TIERS[selectedTier];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Top Up Deposit"
        subtitle={customer.name}
        onBack={goBack}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 20 }}>

        {/* Current Balance */}
        <div style={{
          background: C.white,
          borderRadius: isMobile ? 12 : 16,
          padding: isMobile ? '14px 16px' : '16px 20px',
          marginBottom: 16,
          boxShadow: '0 2px 8px rgba(15,23,42,0.06)'
        }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginBottom: 4 }}>
            Saldo Deposit Saat Ini
          </div>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: isMobile ? 20 : 24,
            fontWeight: 700,
            color: C.success
          }}>
            {rp(customer.deposit || 0)}
          </div>
        </div>

        {/* Membership Status Banner */}
        {membershipStatus?.hasMembership && (
          <div style={{
            background: membershipStatus.isActive
              ? 'linear-gradient(135deg, #5B005F, #4D0051)'
              : 'linear-gradient(135deg, #DC2626, #991B1B)',
            borderRadius: isMobile ? 10 : 12,
            padding: isMobile ? '10px 14px' : '12px 16px',
            marginBottom: 16,
            color: 'white',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 28 }}>{membershipStatus.tier === 'diamond' ? '💎' : '🥇'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700 }}>
                  WPC {membershipStatus.tier === 'diamond' ? 'Diamond' : 'Gold'} Member
                </div>
                {membershipStatus.isActive ? (
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, opacity: 0.9 }}>
                    {membershipStatus.discountPct}% Diskon • Expires: {membershipStatus.expiredAt
                      ? new Date(membershipStatus.expiredAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '-'}
                  </div>
                ) : (
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, opacity: 0.9 }}>
                    ⚠️ Membership expired. Renew sekarang!
                  </div>
                )}
              </div>
              {membershipStatus.isExpiringSoon && membershipStatus.isActive && (
                <div style={{ background: 'rgba(254,243,199,0.3)', borderRadius: 8, padding: '6px 10px' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700 }}>{membershipStatus.daysUntilExpiry}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 9 }}>hari lagi</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Membership Registration Banner (for non-members) */}
        {canRegisterMembership && (
          <div style={{
            background: C.validationWarningBg,
            borderRadius: isMobile ? 10 : 12,
            padding: isMobile ? '12px 14px' : '14px 16px',
            marginBottom: 16,
            border: `1px solid ${C.validationWarningBorder}`,
            cursor: 'pointer',
          }} onClick={() => setShowMembershipModal(true)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 28 }}>🎁</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.validationWarningText }}>
                  Daftar WPC Membership
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.validationWarningText }}>
                  Nikmati diskon 20-25% + benefit eksklusif
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.validationWarningText} strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </div>
        )}

        {/* Amount Selection */}
        <div style={{
          background: C.white,
          borderRadius: isMobile ? 12 : 16,
          padding: isMobile ? '14px 16px' : '16px 20px',
          marginBottom: 16,
          boxShadow: '0 2px 8px rgba(15,23,42,0.06)'
        }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, marginBottom: 12 }}>
            Nominal Top Up
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                style={{
                  padding: isMobile ? '8px 10px' : '8px 14px',
                  borderRadius: 10,
                  border: `1.5px solid ${amount === p ? C.primary : C.n300}`,
                  background: amount === p ? C.primaryLight : C.white,
                  cursor: 'pointer',
                  fontFamily: 'Poppins',
                  fontSize: isMobile ? 11 : 12,
                  fontWeight: 600,
                  color: amount === p ? C.primary : C.n600,
                }}
              >
                {rp(Number(p))}
              </button>
            ))}
          </div>
          <MoneyInput
            label="Nominal Top Up"
            value={amount}
            onChange={(v) => setAmount(v)}
            placeholder="0"
          />
        </div>

        {/* Payment Method */}
        <div style={{
          background: C.white,
          borderRadius: isMobile ? 12 : 16,
          padding: isMobile ? '14px 16px' : '16px 20px',
          marginBottom: 16,
          boxShadow: '0 2px 8px rgba(15,23,42,0.06)'
        }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, marginBottom: 12 }}>
            Metode Pembayaran
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PAY_METHODS.map((m) => {
              const active = payMethod === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setPayMethod(m.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: isMobile ? '10px' : '10px 12px',
                    borderRadius: 10,
                    border: `1.5px solid ${active ? C.primary : C.n200}`,
                    background: active ? `${C.primary}08` : C.white,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: active ? C.primary : C.n900 }}>
                      {m.label}
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 1 }}>
                      {m.desc}
                    </div>
                  </div>
                  {active && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons based on membership status */}
        {canRenewMembership ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Btn
              variant="primary"
              fullWidth
              size="lg"
              loading={loading}
              onClick={handleRenewMembership}
              disabled={!amount || enteredAmount < 100000}
            >
              Renew Membership + Top Up
            </Btn>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, textAlign: 'center' }}>
              Minimal renew: Rp 100.000
            </div>
          </div>
        ) : (
          <Btn
            variant="primary"
            fullWidth
            size="lg"
            loading={loading}
            onClick={handleTopUp}
            disabled={!amount || enteredAmount < 1000}
          >
            Top Up {amount ? rp(enteredAmount) : ''}
          </Btn>
        )}
      </div>

      {/* Membership Registration Modal */}
      {showMembershipModal && (
        <div
          onClick={() => setShowMembershipModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.55)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 400,
              background: 'white',
              borderRadius: 18,
              padding: 22,
              boxShadow: '0 12px 36px rgba(15,23,42,0.25)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n800 }}>
                Daftar WPC Membership
              </div>
              <button
                onClick={() => setShowMembershipModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  border: 'none',
                  background: C.n100,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  color: C.n600,
                }}
              >
                ×
              </button>
            </div>

            {/* Info Banner */}
            <div style={{
              background: C.primaryTint2,
              borderRadius: isMobile ? 8 : 10,
              padding: isMobile ? '10px 12px' : '12px 14px',
              marginBottom: 16,
              fontFamily: 'Poppins',
              fontSize: isMobile ? 10 : 11,
              color: C.primary,
            }}>
              Top-up pertama sekaligus jadi deposit membership. Saldo tetap bisa dipakai untuk pembayaran!
              {bonusEnabled && (
                <div style={{ marginTop: 6, fontWeight: 600 }}>
                  Bonus aktif! {tier.name}: +{rp(tier.bonusAmount)}
                </div>
              )}
            </div>

            {/* Tier Selection */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 11 : 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>
                Pilih Tier Membership
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {Object.values(TIERS).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTier(t.id)}
                    style={{
                      padding: isMobile ? 12 : 14,
                      borderRadius: 12,
                      border: `2px solid ${selectedTier === t.id ? t.color : C.n200}`,
                      background: selectedTier === t.id ? t.bgColor : C.white,
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: isMobile ? 24 : 28, marginBottom: 4 }}>{t.icon}</div>
                    <div style={{
                      fontFamily: 'Poppins',
                      fontSize: 13,
                      fontWeight: 700,
                      color: selectedTier === t.id ? t.color : C.n900,
                    }}>
                      {t.name}
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, color: selectedTier === t.id ? t.color : C.n600 }}>
                      {t.discount} Diskon
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600, marginTop: 2 }}>
                      {t.duration}
                    </div>
                    {bonusEnabled && (
                      <div style={{
                        fontFamily: 'Poppins',
                        fontSize: 9,
                        fontWeight: 600,
                        color: C.success,
                        marginTop: 4,
                      }}>
                        +Bonus {rp(t.bonusAmount)}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Benefits */}
            <div style={{
              background: C.n50,
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 16,
            }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 8 }}>
                ✨ Benefit {tier.name}
              </div>
              {tier.benefits.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tier.color} strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n900 }}>{b}</span>
                </div>
              ))}
            </div>

            {/* Amount Check */}
            <div style={{
              background: enteredAmount >= tier.minTopup ? C.successBg : C.validationErrorBg,
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 16,
              fontFamily: 'Poppins',
              fontSize: 11,
              color: enteredAmount >= tier.minTopup ? C.successDark : C.validationErrorText,
            }}>
              {enteredAmount >= tier.minTopup ? (
                <>✅ Nominal {rp(enteredAmount)} memenuhi minimum untuk {tier.name}</>
              ) : (
                <>⚠️ Minimum untuk {tier.name} adalah {rp(tier.minTopup)}</>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="secondary" onClick={() => setShowMembershipModal(false)} style={{ flex: 1 }}>
                Batal
              </Btn>
              <Btn
                variant="primary"
                onClick={handleRegisterMembership}
                loading={registeringMembership}
                disabled={enteredAmount < tier.minTopup}
                style={{ flex: 1, ...(enteredAmount >= tier.minTopup && { background: tier.color }) }}
              >
                Daftar {tier.name}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
