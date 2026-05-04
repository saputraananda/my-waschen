import { useState } from 'react';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { MOCK_DATA } from '../../utils/mockData';
import { TopBar, Avatar, Btn, Divider } from '../../components/ui';

export default function ApprovalPage({ navigate }) {
  const [approvals, setApprovals] = useState(MOCK_DATA.approvals || []);

  const TYPE_LABELS = {
    topup_deposit: 'Top Up Deposit',
    reschedule: 'Reschedule',
    diskon: 'Diskon',
    pembatalan: 'Pembatalan',
  };

  const handleApprove = (id) => {
    setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'approved' } : a)));
  };

  const handleReject = (id) => {
    setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'rejected' } : a)));
  };

  const pending = approvals.filter((a) => a.status === 'pending');
  const done = approvals.filter((a) => a.status !== 'pending');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Approval Center" subtitle={`${pending.length} menunggu`} onBack={() => navigate('dashboard')} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px' }}>
        {pending.length > 0 && (
          <>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n600, marginBottom: 12 }}>MENUNGGU PERSETUJUAN</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {pending.map((a) => (
                <div key={a.id} style={{ background: C.white, borderRadius: 16, padding: '14px 16px', boxShadow: '0 2px 8px rgba(15,23,42,0.07)', borderLeft: `4px solid ${C.warning}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <Avatar initials={a.requester?.split(' ').map((w) => w[0]).join('').slice(0, 2) || 'US'} size={36} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{a.requester}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{a.date}</div>
                    </div>
                    <span style={{ background: '#FEF3C7', color: C.warning, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{TYPE_LABELS[a.type] || a.type}</span>
                  </div>
                  <div style={{ background: C.n50, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n900 }}>{a.description}</div>
                    {a.amount && <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary, marginTop: 4 }}>{rp(a.amount)}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Btn variant="danger" onClick={() => handleReject(a.id)} style={{ flex: 1 }} size="sm">Tolak</Btn>
                    <Btn variant="success" onClick={() => handleApprove(a.id)} style={{ flex: 1 }} size="sm">Setujui</Btn>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {done.length > 0 && (
          <>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n600, marginBottom: 12 }}>SUDAH DIPROSES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {done.map((a) => (
                <div key={a.id} style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', opacity: 0.7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{a.requester}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{TYPE_LABELS[a.type] || a.type} · {a.date}</div>
                    </div>
                    <span style={{
                      background: a.status === 'approved' ? '#DCFCE7' : '#FEE2E2',
                      color: a.status === 'approved' ? C.success : C.danger,
                      fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999
                    }}>
                      {a.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {approvals.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12 }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900 }}>Semua beres!</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600, textAlign: 'center' }}>Tidak ada permintaan yang perlu disetujui</div>
          </div>
        )}
      </div>
    </div>
  );
}
