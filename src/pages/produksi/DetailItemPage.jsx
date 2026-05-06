import { useState } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp, STAGES } from '../../utils/helpers';
import { TopBar, Btn, Badge, Avatar, ProgressTimeline } from '../../components/ui';

export default function DetailItemProduksiPage({ navigate, screenParams, user }) {
  const tx = screenParams;
  const [updating, setUpdating] = useState(false);
  const [localProgress, setLocalProgress] = useState(tx?.progress || []);

  if (!tx) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Btn onClick={() => navigate('antrian')}>Kembali</Btn></div>;

  const doneStages = localProgress.map((p) => p.stage);
  const nextStage = STAGES.find((s) => !doneStages.includes(s));

  const [stageError, setStageError] = useState('');

  const handleUpdateStage = async () => {
    if (!nextStage) return;
    setUpdating(true);
    setStageError('');
    try {
      const res = await axios.patch(`/api/transactions/${tx.id}/production-stage`, { stage: nextStage });
      const updatedProgress = res?.data?.data?.progress || [
        ...localProgress,
        { stage: nextStage, timestamp: new Date().toISOString() },
      ];
      setLocalProgress(updatedProgress);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal mencatat stage.';
      setStageError(msg);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Detail Produksi" onBack={() => navigate('antrian')} rightAction={() => navigate('foto_kondisi', tx)} rightIcon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Header */}
        <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.primary }}>{tx.id}</span>
            <Badge status={tx.status} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar initials={tx.customerName.split(' ').map((w) => w[0]).join('').slice(0, 2)} size={42} />
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{tx.customerName}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{tx.date}</span>
                {tx.dueDate && <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.warning, fontWeight: 600 }}>⏰ {tx.dueDate}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Items */}
        <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 10 }}>ITEM LAUNDRY</div>
          {tx.items?.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{item.name}</span>
                {item.express && <span style={{ background: '#FEF3C7', color: C.warning, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>⚡</span>}
              </div>
              <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>{item.qty} {item.unit}</span>
            </div>
          ))}
          {tx.notes && (
            <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '8px 10px', marginTop: 8 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 11, color: '#92400E' }}>📝 {tx.notes}</span>
            </div>
          )}
        </div>

        {/* Progress */}
        <div style={{ background: C.white, borderRadius: 16, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 12 }}>PROGRESS PRODUKSI</div>
          <ProgressTimeline progress={localProgress} />
        </div>
      </div>

      {nextStage && (
        <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.n100}` }}>
          {stageError && (
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#991B1B', background: '#FEE2E2', borderRadius: 8, padding: '8px 12px', marginBottom: 8, textAlign: 'center' }}>
              ⚠ {stageError}
            </div>
          )}
          <Btn variant="primary" fullWidth size="lg" loading={updating} onClick={handleUpdateStage}>
            ✅ Selesaikan: {nextStage}
          </Btn>
        </div>
      )}
    </div>
  );
}
