import { useState } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { STAGES } from '../../utils/helpers';
import { TopBar, Btn, Badge, Avatar } from '../../components/ui';

const STAGE_ICONS = {
  'Diterima': '📥', 'Cuci': '🫧', 'Pengeringan': '💨',
  'Setrika': '♨️', 'Packing': '📦', 'Selesai': '✅',
};

const STAGE_COLORS = {
  'Diterima': '#3B82F6', 'Cuci': '#06B6D4', 'Pengeringan': '#8B5CF6',
  'Setrika': '#F59E0B', 'Packing': '#10B981', 'Selesai': '#10B981',
};

const PROBLEM_PRESETS = [
  '🔴 Ada kerusakan / noda permanen',
  '📦 Item kurang dari yang tercatat',
  '⏰ Butuh waktu lebih lama',
  '❓ Perlu konfirmasi ke kasir',
  '✍️ Tulis sendiri...',
];

function getSLAStatus(estimatedDoneAt) {
  if (!estimatedDoneAt) return null;
  const diffMin = (new Date(estimatedDoneAt) - Date.now()) / 60000;
  if (diffMin < 0) return { text: `Telat ${Math.abs(Math.round(diffMin))} menit!`, bg: '#FEE2E2', color: '#991B1B', icon: '🔴' };
  if (diffMin < 60) return { text: `Hanya ${Math.round(diffMin)} menit lagi!`, bg: '#FEF3C7', color: '#92400E', icon: '⚠️' };
  if (diffMin < 180) return { text: `${Math.round(diffMin / 60)} jam ${Math.round(diffMin % 60)} menit lagi`, bg: '#EFF6FF', color: '#1E40AF', icon: '🕐' };
  return null;
}

export default function DetailItemProduksiPage({ navigate, goBack, screenParams, user }) {
  const tx = screenParams;
  const [updating, setUpdating] = useState(false);
  const [localProgress, setLocalProgress] = useState(tx?.progress || []);
  const [stageError, setStageError] = useState('');
  const [showProblem, setShowProblem] = useState(false);
  const [problemText, setProblemText] = useState('');
  const [customProblem, setCustomProblem] = useState('');
  const [reportingProblem, setReportingProblem] = useState(false);
  const [problemSent, setProblemSent] = useState(false);

  if (!tx) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
      <div style={{ fontSize: 48 }}>😕</div>
      <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n900 }}>Order tidak ditemukan</div>
      <Btn variant="secondary" onClick={goBack}>← Kembali</Btn>
    </div>
  );

  const doneStages = localProgress.map(p => p.stage);
  const nextStage = STAGES.find(s => !doneStages.includes(s));
  const allDone = !nextStage;
  const progressPct = Math.round((doneStages.length / STAGES.length) * 100);
  const sla = getSLAStatus(tx.estimatedDoneAt);
  
  const workstation = localStorage.getItem('produksi_workstation') || 'Semua';
  const canUpdateStage = workstation === 'Semua' || workstation === nextStage || (nextStage === 'Diterima' && workstation === 'Cuci');

  const handleUpdateStage = async () => {
    if (!nextStage || !canUpdateStage) return;
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
      setStageError(err?.response?.data?.message || 'Gagal mencatat. Coba lagi.');
    } finally {
      setUpdating(false);
    }
  };

  const handleReportProblem = async () => {
    const text = problemText === '✍️ Tulis sendiri...' ? customProblem : problemText;
    if (!text?.trim()) return;
    setReportingProblem(true);
    try {
      await axios.post(`/api/transactions/${tx.id}/condition`, {
        photos: [],
        notes: `[LAPORAN MASALAH] ${text.trim()}`,
        isDamage: text.includes('kerusakan'),
      });
      setProblemSent(true);
      setShowProblem(false);
    } catch (err) {
      console.error(err);
    } finally {
      setReportingProblem(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Detail Order" onBack={goBack}
        rightAction={() => navigate('foto_kondisi', tx)}
        rightIcon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* SLA Warning */}
        {sla && (
          <div style={{ background: sla.bg, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{sla.icon}</span>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: sla.color }}>{sla.text}</div>
          </div>
        )}

        {/* Customer + ID */}
        <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <Avatar initials={tx.customerName?.split(' ').map(w => w[0]).join('').slice(0, 2)} size={46} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: C.n900 }}>{tx.customerName}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                {tx.isExpress && <span style={{ background: '#FEF3C7', color: '#92400E', fontFamily: 'Poppins', fontSize: 10, fontWeight: 800, padding: '1px 8px', borderRadius: 999 }}>⚡ EXPRESS</span>}
                {tx.pickupType === 'delivery' && <span style={{ background: '#EDE9FE', color: '#5B21B6', fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 999 }}>🚗 Antar</span>}
                <Badge status={tx.status === 'selesai' ? 'selesai' : 'proses'} small />
              </div>
            </div>
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>
            📋 {tx.id} · 📅 Masuk: {tx.date}
          </div>
          {tx.estimatedDoneAt && (
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n700, marginTop: 2 }}>
              🏁 Target: {new Date(tx.estimatedDoneAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        {/* CURRENT STAGE — PALING PROMINENT */}
        <div style={{
          background: allDone ? 'linear-gradient(135deg, #ECFDF5, #D1FAE5)' : `linear-gradient(135deg, ${C.primaryLight}, white)`,
          borderRadius: 20, padding: '20px 20px', boxShadow: '0 4px 16px rgba(15,23,42,0.10)',
          border: `2px solid ${allDone ? '#10B981' : C.primary + '40'}`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>{STAGE_ICONS[nextStage || 'Selesai']}</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: allDone ? '#065F46' : C.n500, fontWeight: 600, letterSpacing: 1 }}>
            {allDone ? 'STATUS' : 'TAHAP SELANJUTNYA'}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 24, fontWeight: 900, color: allDone ? '#065F46' : STAGE_COLORS[nextStage] || C.primary, marginTop: 4 }}>
            {allDone ? 'SELESAI SEMUA! 🎉' : nextStage}
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>Progress</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: allDone ? '#065F46' : C.primary }}>{progressPct}%</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.6)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: allDone ? '#10B981' : C.primary, borderRadius: 4, transition: 'width 0.6s ease' }} />
            </div>
          </div>
        </div>

        {/* Stage checklist */}
        <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, letterSpacing: 0.5, marginBottom: 10 }}>ALUR PRODUKSI</div>
          {STAGES.map((s, i) => {
            const isDone = doneStages.includes(s);
            const isCurrent = s === nextStage;
            const log = localProgress.find(p => p.stage === s);
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < STAGES.length - 1 ? `1px solid ${C.n100}` : 'none' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 16, flexShrink: 0,
                  background: isDone ? C.primary : isCurrent ? C.primaryLight : C.n100,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: isCurrent ? `2px solid ${C.primary}` : 'none',
                }}>
                  {isDone
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    : <span style={{ fontFamily: 'Poppins', fontSize: 11, color: isCurrent ? C.primary : C.n400, fontWeight: 700 }}>{i + 1}</span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: isDone || isCurrent ? 700 : 400, color: isDone ? C.n900 : isCurrent ? C.primary : C.n500 }}>
                    {STAGE_ICONS[s]} {s}
                  </div>
                  {isDone && log?.timestamp && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n400, marginTop: 1 }}>
                      {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
                {isDone && <span style={{ color: '#10B981', fontSize: 16 }}>✔</span>}
                {isCurrent && <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: C.primary, background: C.primaryLight, padding: '2px 8px', borderRadius: 999 }}>SEKARANG</span>}
              </div>
            );
          })}
        </div>

        {/* Items laundry */}
        <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, letterSpacing: 0.5, marginBottom: 10 }}>ITEM CUCIAN</div>
          {tx.items?.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < tx.items.length - 1 ? `1px solid ${C.n100}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{item.name || item.serviceName}</span>
                {item.express && <span style={{ background: '#FEF3C7', color: '#92400E', fontFamily: 'Poppins', fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999 }}>⚡</span>}
              </div>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n700 }}>{item.qty} {item.unit}</span>
            </div>
          ))}
          {tx.notes && (
            <div style={{ marginTop: 10, padding: '8px 10px', background: '#FEF3C7', borderRadius: 8 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 11, color: '#92400E' }}>📝 Catatan: {tx.notes}</span>
            </div>
          )}
          {problemSent && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#ECFDF5', borderRadius: 8 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 11, color: '#065F46', fontWeight: 600 }}>✅ Laporan masalah berhasil dikirim</span>
            </div>
          )}
        </div>

      </div>

      {/* Bottom action area */}
      <div style={{ padding: '12px 16px', background: 'white', borderTop: `1px solid ${C.n100}`, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stageError && (
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#991B1B', background: '#FEE2E2', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
            ⚠️ {stageError}
          </div>
        )}

        {/* Problem modal */}
        {showProblem && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 8 }}>Pilih jenis masalah:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PROBLEM_PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => setProblemText(p)}
                  style={{
                    padding: '10px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                    border: `1.5px solid ${problemText === p ? '#EF4444' : C.n200}`,
                    background: problemText === p ? '#FEE2E2' : 'white',
                    fontFamily: 'Poppins', fontSize: 12, color: problemText === p ? '#991B1B' : C.n800,
                  }}
                >{p}</button>
              ))}
            </div>
            {problemText === '✍️ Tulis sendiri...' && (
              <textarea
                value={customProblem}
                onChange={e => setCustomProblem(e.target.value)}
                placeholder="Tulis masalah di sini..."
                rows={2}
                style={{ width: '100%', marginTop: 8, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 12, padding: 10, boxSizing: 'border-box', resize: 'none' }}
              />
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => setShowProblem(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid ${C.n200}`, background: 'white', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n600 }}>
                Batal
              </button>
              <button
                onClick={handleReportProblem}
                disabled={!problemText || reportingProblem}
                style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: problemText ? '#EF4444' : C.n200, cursor: problemText ? 'pointer' : 'default', fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: 'white' }}
              >
                {reportingProblem ? 'Mengirim...' : '🚨 Laporkan'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {/* Tombol masalah */}
          <button
            onClick={() => setShowProblem(!showProblem)}
            style={{ padding: '12px 16px', borderRadius: 14, border: `1.5px solid #EF4444`, background: showProblem ? '#FEE2E2' : 'white', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: '#EF4444', flexShrink: 0 }}
          >
            🚨
          </button>

          {/* TOMBOL UTAMA — sangat besar dan jelas */}
          {!allDone ? (
            <button
              onClick={handleUpdateStage}
              disabled={updating || !canUpdateStage}
              style={{
                flex: 1, height: 54, borderRadius: 14, border: 'none', cursor: updating || !canUpdateStage ? 'default' : 'pointer',
                background: updating || !canUpdateStage ? C.n200 : `linear-gradient(135deg, ${STAGE_COLORS[nextStage] || C.primary}CC, ${STAGE_COLORS[nextStage] || C.primary})`,
                fontFamily: 'Poppins', fontSize: 15, fontWeight: 800, color: updating || !canUpdateStage ? C.n500 : 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: updating || !canUpdateStage ? 'none' : `0 4px 16px ${STAGE_COLORS[nextStage] || C.primary}55`,
                transition: 'all 0.2s',
              }}
            >
              {updating
                ? <><div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />&nbsp;Mencatat...</>
                : !canUpdateStage
                ? <div style={{display:'flex', flexDirection:'column', alignItems:'center', lineHeight:1.2}}><span style={{fontSize: 13}}>Bukan bagian {workstation}</span><span style={{fontSize: 10, fontWeight: 500}}>Tunggu tahap {nextStage} selesai</span></div>
                : <>{STAGE_ICONS[nextStage]} Selesai: {nextStage}</>
              }
            </button>
          ) : (
            <button
              onClick={goBack}
              style={{ flex: 1, height: 54, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #10B981, #059669)', fontFamily: 'Poppins', fontSize: 15, fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px #10B98155' }}
            >
              ✅ Semua Selesai! Kembali
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
