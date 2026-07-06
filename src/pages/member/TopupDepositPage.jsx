import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, MoneyInput, Modal } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';

const PRESETS = ['50000', '100000', '200000', '500000'];

const PAY_METHODS = [
  { key: 'cash',     label: '💵 Tunai',          desc: 'Customer bayar di kasir' },
  { key: 'transfer', label: '🏦 Transfer Manual', desc: 'Verifikasi manual oleh finance' },
  { key: 'qris',     label: '📱 QRIS Statis',     desc: 'QR cetak / EDC manual' },
];

// Membership tier configurations for opt-in
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
  },
};

export default function TopupDepositPage({ navigate, goBack, screenParams }) {
  const customer = screenParams;
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [loading, setLoading] = useState(false);

  // Membership opt-in state
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState('gold');
  const [registeringMembership, setRegisteringMembership] = useState(false);

  // Fetch membership status on mount
  useEffect(() => {
    if (!customer?.id) return;
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
  }, [customer?.id]);

  if (!customer) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Btn onClick={() => navigate('customer')}>Kembali</Btn>
    </div>
  );

  const enteredAmount = Number(amount) || 0;

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
      // Register membership with this top-up
      const res = await axios.post('/api/membership/register', {
        customerId: customer.id,
        tier: selectedTier,
        topupAmount: enteredAmount,
      });

      if (res?.data?.success) {
        await alertSuccess(`Membership ${tier.name} berhasil dibuat!`);
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
        await alertSuccess(`Membership berhasil direnew!`);
        navigate('detail_customer', { ...customer });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal merenew membership.';
      alertError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Determine if customer can register membership
  const canRegisterMembership = !membershipStatus?.hasMembership;
  const canRenewMembership = membershipStatus?.hasMembership && !membershipStatus?.isActive && membershipStatus?.canRenew;
  const tier = TIERS[selectedTier];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Top Up Deposit" subtitle={customer.name} onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {/* Current Balance */}
        <div style={{ background: C.white, borderRadius: 16, padding: '16px 20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginBottom: 4 }}>Saldo Deposit Saat Ini</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 24, fontWeight: 700, color: C.success }}>{rp(customer.deposit || 0)}</div>
        </div>

        {/* Membership Status Banner */}
        {membershipStatus?.hasMembership && (
          <div style={{
            background: membershipStatus.isActive
              ? 'linear-gradient(135deg, #5B005F, #4D0051)'
              : 'linear-gradient(135deg, #DC2626, #991B1B)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 16, color: 'white',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            background: C.validationWarningBg, borderRadius: 12, padding: '14px 16px', marginBottom: 16,
            border: `1px solid ${C.validationWarningBorder}`, cursor: 'pointer',
          }} onClick={() => setShowMembershipModal(true)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28 }}>🎁</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.validationWarningText }}>
                  Daftar WPC Membership
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.validationWarningText }}>
                  Nikmati diskon 20-25% + benefit eksklusif
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.validationWarningText} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            </div>
          </div>
        )}

        {/* Amount Selection */}
        <div style={{ background: C.white, borderRadius: 16, padding: '16px 20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, marginBottom: 12 }}>Nominal Top Up</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                style={{
                  padding: '8px 14px', borderRadius: 10,
                  border: `1.5px solid ${amount === p ? C.primary : C.n300}`,
                  background: amount === p ? C.primaryLight : C.white,
                  cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
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
        <div style={{ background: C.white, borderRadius: 16, padding: '16px 20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, marginBottom: 12 }}>Metode Pembayaran</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PAY_METHODS.map((m) => {
              const active = payMethod === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setPayMethod(m.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    border: `1.5px solid ${active ? C.primary : C.n200}`,
                    background: active ? `${C.primary}08` : C.white,
                    cursor: 'pointer', textAlign: 'left',
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
              🔄 Renew Membership + Top Up
            </Btn>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, textAlign: 'center' }}>
              Minimal renew: Rp 100.000
            </div>
          </div>
        ) : (
          <Btn variant="primary" fullWidth size="lg" loading={loading} onClick={handleTopUp} disabled={!amount || enteredAmount < 1000}>
            Top Up {amount ? rp(enteredAmount) : ''}
          </Btn>
        )}
      </div>

      {/* Membership Registration Modal */}
      {showMembershipModal && (
        <Modal visible onClose={() => setShowMembershipModal(false)} title="Daftar WPC Membership">
          <div style={{ padding: '8px 0 0' }}>
            {/* Info Banner */}
            <div style={{
              background: C.primaryTint2, borderRadius: 10, padding: '12px 14px', marginBottom: 16,
              fontFamily: 'Poppins', fontSize: 11, color: C.primary,
            }}>
              🎁 Top-up pertama sekaligus jadi deposit membership. Saldo tetap bisa dipakai untuk pembayaran!
            </div>

            {/* Tier Selection */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>
                Pilih Tier Membership
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {Object.values(TIERS).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTier(t.id)}
                    style={{
                      padding: 14, borderRadius: 12,
                      border: `2px solid ${selectedTier === t.id ? t.color : C.n200}`,
                      background: selectedTier === t.id ? t.bgColor : C.white,
                      cursor: 'pointer', textAlign: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{t.icon}</div>
                    <div style={{
                      fontFamily: 'Poppins', fontSize: 13, fontWeight: 700,
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
                  </button>
                ))}
              </div>
            </div>

            {/* Benefits */}
            <div style={{
              background: C.n50, borderRadius: 10, padding: '12px 14px', marginBottom: 16,
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
              borderRadius: 10, padding: '12px 14px', marginBottom: 16,
              fontFamily: 'Poppins', fontSize: 11,
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
        </Modal>
      )}
    </div>
  );
}
