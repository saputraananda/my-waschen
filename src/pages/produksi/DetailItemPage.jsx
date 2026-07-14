import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { STAGES, txApiId, photoTypeLabel } from '../../utils/helpers';
import { TopBar, Btn, Badge, Avatar, ErrorBoundary, PhotoLightbox } from '../../components/ui';
import { alertWarning } from '../../utils/alert';
import { STAGE_STYLE, STAGE_ICONS, PROD_SHADOW, HEADER, CARD, getStageStyle } from '../../utils/productionDesign';
import { uploadImage } from '../../utils/imageUpload';
import { useResponsive } from '../../utils/hooks';

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
  if (diffMin < 0) return { text: `Telat ${Math.abs(Math.round(diffMin))} menit!`, bg: C.validationErrorBg, color: C.validationErrorText, icon: '🔴' };
  if (diffMin < 60) return { text: `Hanya ${Math.round(diffMin)} menit lagi!`, bg: C.validationWarningBg, color: C.validationWarningText, icon: '⚠️' };
  if (diffMin < 180) return { text: `${Math.round(diffMin / 60)} jam ${Math.round(diffMin % 60)} menit lagi`, bg: C.validationInfoBg, color: C.validationInfoText, icon: '🕐' };
  return null;
}

// Internal component (wrapped by ErrorBoundary)
export function DetailItemPageContent({ navigate, goBack, screenParams, user }) {
  const { isMobile } = useResponsive();
  const tx = screenParams;
  // item = layanan spesifik yang dipilih dari dashboard produksi
  const item = tx?.item || null;

  const initProgress = item ? (item.progress || []) : (tx?.progress || []);
  const [updating, setUpdating] = useState(false);
  const [localProgress, setLocalProgress] = useState(initProgress);
  const [stageError, setStageError] = useState('');
  const [packingDone, setPackingDone] = useState(Number(item?.packingDone) || 0);
  const [packingUpdating, setPackingUpdating] = useState(false);
  const [showProblem, setShowProblem] = useState(false);
  const [problemText, setProblemText] = useState('');
  const [customProblem, setCustomProblem] = useState('');
  const [reportingProblem, setReportingProblem] = useState(false);
  const [problemSent, setProblemSent] = useState(false);
  const [showSelesaiConfirm, setShowSelesaiConfirm] = useState(false);

  // Photo lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);  const [conditionPhotos, setConditionPhotos] = useState(tx?.conditionPhotos || []);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [productionMeta, setProductionMeta] = useState(tx?.production || null);
  const needsReceivePhoto = tx?.needsReceivePhoto ?? !productionMeta?.hasReceivePhoto;

  const apiId = tx ? txApiId(tx) : null;

  useEffect(() => {
    if (!apiId) return;
    let cancelled = false;
    const fetchTx = async () => {
      setPhotosLoading(true);
      try {
        const url = item?.itemId
          ? `/api/transactions/${apiId}?itemId=${item.itemId}`
          : `/api/transactions/${apiId}`;
        const res = await axios.get(url);
        const txData = res?.data?.data;
        if (cancelled || !txData) return;

        const photos = txData.conditionPhotos;
        if (Array.isArray(photos)) setConditionPhotos(photos);
        if (txData.production) setProductionMeta(txData.production);

        // Sync progress dari server agar tidak rollback ketika back-navigate
        if (item && item.itemId && txData.items) {
          const serverItem = txData.items.find(i => i.itemId === item.itemId || i.id === item.itemId);
          if (serverItem?.progress) {
            setLocalProgress(serverItem.progress);
          }
          if (serverItem?.packingDone != null) {
            setPackingDone(Number(serverItem.packingDone) || 0);
          }
        } else if (txData.progress) {
          setLocalProgress(txData.progress);
        }
      } catch {
        // Silent fail for optional data refresh
      }
      finally { if (!cancelled) setPhotosLoading(false); }
    };
    fetchTx();

    // Listen event saat user save foto di FotoKondisiPage → refresh otomatis dengan bypass cache
    const handlePhotoSaved = async () => {
      if (cancelled) return;
      // Bypass cache — pakai header X-Skip-Cache supaya pasti dapat data fresh
      try {
        const url = item?.itemId
          ? `/api/transactions/${apiId}?itemId=${item.itemId}`
          : `/api/transactions/${apiId}`;
        const res = await axios.get(url, { headers: { 'X-Skip-Cache': '1' } });
        const txData = res?.data?.data;
        if (cancelled || !txData) return;
        const photos = txData.conditionPhotos;
        if (Array.isArray(photos)) setConditionPhotos(photos);
        if (txData.production) setProductionMeta(txData.production);
        if (item?.itemId && Array.isArray(txData.items)) {
          const serverItem = txData.items.find(i => i.itemId === item.itemId || i.id === item.itemId);
          if (serverItem?.progress) setLocalProgress(serverItem.progress);
          if (serverItem?.packingDone != null) setPackingDone(Number(serverItem.packingDone) || 0);
        }
      } catch {
        // Silent fail for photo refresh
      }
    };
    window.addEventListener('produksi:photo-saved', handlePhotoSaved);

    return () => {
      cancelled = true;
      window.removeEventListener('produksi:photo-saved', handlePhotoSaved);
    };
  }, [apiId, screenParams?.refreshKey, item?.itemId]);

  if (!tx) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
      <div style={{ fontSize: 48 }}>😕</div>
      <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n800 }}>Order tidak ditemukan</div>
      <Btn variant="secondary" onClick={goBack}>← Kembali</Btn>
    </div>
  );

  // STAGES tanpa Selesai (Selesai = end state, bukan active stage)
  const ACTIVE_STAGES = STAGES.filter(s => s !== 'Selesai'); // ['Diterima','Packing']
  const doneStages = localProgress.map(p => p.stage);
  const nextStage = ACTIVE_STAGES.find(s => !doneStages.includes(s));
  const allDone = !nextStage;
  const progressPct = Math.round((doneStages.length / ACTIVE_STAGES.length) * 100);
  const sla = getSLAStatus(tx.estimatedDoneAt);
  
  const packingNeeded = Number(item?.packingNeeded) || 1;
  const packingNotes = item?.packingNotes || '';
  const packingComplete = packingDone >= packingNeeded;

  const workstation = localStorage.getItem('produksi_workstation') || 'Semua';
  // Semua staff produksi bisa update semua stage (tidak ada sub-role)
  // Workstation hanya untuk filter tampilan di dashboard, bukan pembatas aksi
  const canUpdateStage = (nextStage !== 'Packing' || packingComplete);

  const handlePackingCount = async (newDone) => {
    const clamped = Math.max(0, Math.min(newDone, packingNeeded));
    setPackingDone(clamped);
    if (!item?.itemId) return;
    setPackingUpdating(true);
    try {
      await axios.patch(`/api/transactions/${apiId}/items/${item.itemId}/packing`, { packingDone: clamped });
    } catch (err) {
      // Silent fail - UI rollback handled automatically
      setPackingDone((prev) => prev); // kalau perlu, fetch ulang di future
    }
    finally { setPackingUpdating(false); }
  };

  const openFoto = (photoPhase) => {
    navigate('foto_kondisi', { ...tx, item, photoPhase });
  };

  const handleUpdateStage = async () => {
    if (!nextStage || !canUpdateStage) return;

    // Cek hasPackingPhoto: dari server meta atau dari conditionPhotos lokal yang baru di-upload
    const hasPacking = productionMeta?.hasPackingPhoto || conditionPhotos.some((p) =>
      p.type === 'packing'
    );

    // ✅ VALIDASI: Jika sedang di tahap Packing → wajib ada foto packing sebelum bisa selesaikan tahap ini
    if (nextStage === 'Packing' && !hasPacking) {
      alertWarning('Wajib foto packing sebelum bisa menyelesaikan tahap Packing.');
      openFoto('packing');
      return;
    }

    // Tampilkan konfirmasi sebelum menandai selesai semua
    if (allDone) {
      setShowSelesaiConfirm(true);
      return;
    }

    await doUpdateStage(nextStage);
  };

  const doUpdateStage = async (stage) => {

    setUpdating(true);
    setStageError('');
    try {
      const body = item
        ? { stage, itemId: item.itemId }
        : { stage };
      const res = await axios.patch(`/api/transactions/${apiId}/production-stage`, body);
      const refreshUrl = item?.itemId
        ? `/api/transactions/${apiId}?itemId=${item.itemId}`
        : `/api/transactions/${apiId}`;
      const refreshed = await axios.get(refreshUrl);
      if (refreshed?.data?.data?.conditionPhotos) setConditionPhotos(refreshed.data.data.conditionPhotos);
      if (refreshed?.data?.data?.production) setProductionMeta(refreshed.data.data.production);
      const updatedProgress = res?.data?.data?.progress || [
        ...localProgress,
        { stage, timestamp: new Date().toISOString() },
      ];
      setLocalProgress(updatedProgress);

      // Kalau stage terakhir 'Selesai' — auto redirect ke dashboard setelah delay singkat
      if (stage === 'Selesai') {
        setShowSelesaiConfirm(false);
        setTimeout(() => {
          navigate('dashboard', null, { replace: true });
        }, 1500);
      }
    } catch (err) {
      const code = err?.response?.data?.code;
      const msg = err?.response?.data?.message || 'Gagal mencatat. Coba lagi.';
      setStageError(msg);
      if (code === 'PACKING_PHOTO_REQUIRED') openFoto('packing');
      // Rollback: re-fetch server progress so UI stays in sync
      try {
        const res = await axios.get(`/api/transactions/${apiId}${item?.itemId ? `?itemId=${item.itemId}` : ''}`);
        const txData = res?.data?.data;
        if (txData?.items && item?.itemId) {
          const serverItem = txData.items.find(i => i.itemId === item.itemId);
          if (serverItem?.progress) setLocalProgress(serverItem.progress);
        } else if (txData?.progress) {
          setLocalProgress(txData.progress);
        }
      } catch {}
    } finally {
      setUpdating(false);
    }
  };

  const [problemPhotos, setProblemPhotos] = useState([]); // array of dataUrl strings
  const [problemUploading, setProblemUploading] = useState(false);
  const [showRevert, setShowRevert] = useState(false);
  const [revertReason, setRevertReason] = useState('');
  const [reverting, setReverting] = useState(false);

  // Photo edit/delete state
  const [editingPhotoId, setEditingPhotoId] = useState(null);
  const [editingNotes, setEditingNotes] = useState('');
  const [editingType, setEditingType] = useState('');
  const [photoActionLoading, setPhotoActionLoading] = useState(false);
  const [confirmDeletePhotoId, setConfirmDeletePhotoId] = useState(null);

  const refreshPhotos = async () => {
    try {
      const url = item?.itemId
        ? `/api/transactions/${apiId}?itemId=${item.itemId}`
        : `/api/transactions/${apiId}`;
      const res = await axios.get(url);
      const txData = res?.data?.data;
      if (Array.isArray(txData?.conditionPhotos)) setConditionPhotos(txData.conditionPhotos);
      if (txData?.production) setProductionMeta(txData.production);
    } catch {
      // Silent fail for optional refresh
    }
  };

  const handleDeletePhoto = async (photoId) => {
    setPhotoActionLoading(true);
    // Optimistic update — langsung hilangkan dari list
    const prevPhotos = conditionPhotos;
    setConditionPhotos((prev) => prev.filter((p) => p.id !== photoId));
    setConfirmDeletePhotoId(null);
    try {
      await axios.delete(`/api/transactions/${apiId}/photos/${photoId}`);
      // Refresh meta tapi jangan tunggu (foto sudah hilang dari UI)
      refreshPhotos();
    } catch (err) {
      // Rollback kalau gagal
      setConditionPhotos(prevPhotos);
      alertWarning(err?.response?.data?.message || 'Gagal hapus foto.');
    } finally {
      setPhotoActionLoading(false);
    }
  };

  const handleSaveEditPhoto = async () => {
    setPhotoActionLoading(true);
    try {
      await axios.patch(`/api/transactions/${apiId}/photos/${editingPhotoId}`, {
        notes: editingNotes,
        photoType: editingType,
      });
      setEditingPhotoId(null);
      setEditingNotes('');
      setEditingType('');
      await refreshPhotos();
    } catch (err) {
      alertWarning(err?.response?.data?.message || 'Gagal update foto.');
    } finally {
      setPhotoActionLoading(false);
    }
  };

  const startEditPhoto = (photo) => {
    setEditingPhotoId(photo.id);
    setEditingNotes(photo.notes || '');
    setEditingType(photo.type || 'initial_condition');
  };

  const handleReportProblem = async () => {
    const text = problemText === '✍️ Tulis sendiri...' ? customProblem : problemText;
    if (!text?.trim()) {
      alertWarning('Mohon isi deskripsi masalah.');
      return;
    }
    setReportingProblem(true);
    try {
      // Build photos array
      const photoArr = problemPhotos.map((dataUrl) => ({
        url: dataUrl,
        type: 'problem_report',
      }));
      await axios.post(`/api/transactions/${apiId}/condition`, {
        photos: photoArr,
        notes: `[LAPORAN MASALAH] ${text.trim()}`,
        isDamage: text.includes('kerusakan'),
      });
      setProblemSent(true);
      setShowProblem(false);
      setProblemPhotos([]);
      setProblemText('');
      setCustomProblem('');
    } catch (err) {
      // Silent fail - error already handled via alertWarning
    } finally {
      setReportingProblem(false);
    }
  };

  const handleAddProblemPhoto = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setProblemUploading(true);
    try {
      const results = await Promise.all(files.map(f => uploadImage(f, 'documentation').catch(() => null)));
      const valid = results.filter(r => r && r.dataUrl).map(r => r.dataUrl);

      // Feedback jika semua upload gagal
      if (files.length > 0 && valid.length === 0) {
        alertWarning('Gagal meng-upload foto. Silakan coba lagi.');
      }

      setProblemPhotos((prev) => [...prev, ...valid].slice(0, 5)); // max 5 photos
    } catch (err) {
      alertWarning('Gagal meng-upload foto. Silakan coba lagi.');
    } finally {
      setProblemUploading(false);
      if (e.target) e.target.value = ''; // reset input
    }
  };

  const handleRevertStage = async () => {
    if (!revertReason.trim()) return;
    setReverting(true);
    try {
      await axios.patch(`/api/transactions/${apiId}/production-stage/revert`, {
        itemId: item?.itemId,
        reason: revertReason.trim(),
      });
      // Refresh data
      const refreshed = await axios.get(`/api/transactions/${apiId}`);
      const txData = refreshed?.data?.data;
      if (item && item.itemId && txData?.items) {
        const serverItem = txData.items.find(i => i.itemId === item.itemId);
        if (serverItem?.progress) setLocalProgress(serverItem.progress);
      }
      if (txData?.production) setProductionMeta(txData.production);
      setShowRevert(false);
      setRevertReason('');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal revert stage.';
      setStageError(msg);
    } finally {
      setReverting(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title={item ? 'Detail Item Cucian' : 'Detail Nota'}
        subtitle={item ? `${tx.id} · ${item.name}` : tx.id}
        onBack={goBack}
        rightAction={() => openFoto(nextStage === 'Packing' || allDone ? 'packing' : 'receive')}
        rightIcon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 16, display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 12, paddingBottom: isMobile ? 120 : 100 }}>

        {(nextStage === 'Packing' || allDone) && !productionMeta?.hasPackingPhoto && !conditionPhotos.some((p) => p.type === 'packing') && (
          <div style={{ background: C.successBg, borderRadius: 12, padding: '10px 12px', fontFamily: 'Poppins', fontSize: 11, color: C.successDark }}>
            📦 <strong>Wajib foto packing</strong> sebelum order siap diambil customer.
          </div>
        )}

        {/* SLA Warning */}
        {sla && (
          <div style={{ background: sla.bg, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{sla.icon}</span>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: sla.color }}>{sla.text}</div>
          </div>
        )}

        {/* Nota & Customer Info (Simplified) */}
        <div style={{ background: 'white', borderRadius: 16, padding: isMobile ? '12px 14px' : '14px 16px', boxShadow: PROD_SHADOW.card }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 12, marginBottom: isMobile ? 8 : 10 }}>
            <Avatar initials={(tx.customerName || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()} size={isMobile ? 40 : 46} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 14 : 16, fontWeight: 600, color: C.n800 }}>{tx.customerName}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                {tx.isExpress && <span style={{ background: C.validationWarningBg, color: C.validationWarningText, fontFamily: 'Poppins', fontSize: 10, fontWeight: 500, padding: '1px 8px', borderRadius: 999 }}>⚡ EXPRESS</span>}
                {tx.pickupType === 'delivery' && <span style={{ background: C.infoBg, color: C.primary, fontFamily: 'Poppins', fontSize: 10, fontWeight: 500, padding: '1px 8px', borderRadius: 999 }}>🚗 Antar</span>}
                {tx.customerIsMember && <span style={{ background: C.successBg, color: C.successDark, fontFamily: 'Poppins', fontSize: 10, fontWeight: 500, padding: '1px 8px', borderRadius: 999 }}>⭐ Member</span>}
                <Badge status={tx.status === 'selesai' ? 'selesai' : 'proses'} small />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>
              📋 {tx.id} · 📅 Masuk: {tx.date}
            </div>
            {tx.customerPhone && (
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n700 }}>
                📞 {tx.customerPhone}
              </div>
            )}
            {tx.estimatedDoneAt && (
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n700 }}>
                🏁 Target: {new Date(tx.estimatedDoneAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>

        {/* Item Detail (Focused) */}
        {item && (
          <div style={{ background: 'white', borderRadius: 16, padding: '16px', boxShadow: PROD_SHADOW.card }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n500, letterSpacing: '0.05em', marginBottom: 14 }}>ITEM YANG DIPROSES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 600, color: C.n800 }}>{item.name}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n500 }}>{item.qty} {item.unit}</div>
              </div>
              
              {/* Item Attributes */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {item.material && (
                  <span style={{ background: C.infoBg, color: C.infoDark, fontSize: '11px', fontFamily: 'Poppins', padding: '6px 12px', borderRadius: '8px', fontWeight: 500 }}>🧵 Bahan: {item.material}</span>
                )}
                {item.brand && (
                  <span style={{ background: C.infoBg, color: C.primary, fontSize: '11px', fontFamily: 'Poppins', padding: '6px 12px', borderRadius: '8px', fontWeight: 500 }}>🏷️ Merk: {item.brand}</span>
                )}
                {item.specialCareAlert && (
                  <span style={{ background: C.validationWarningBg, color: C.validationWarningText, fontSize: '11px', fontFamily: 'Poppins', padding: '6px 12px', borderRadius: '8px', fontWeight: 500 }}>⚠️ Perhatian: {item.specialCareAlert}</span>
                )}
                {item.isExpress && (
                  <span style={{ background: C.validationWarningBg, color: C.validationWarningText, fontSize: '11px', fontFamily: 'Poppins', padding: '6px 12px', borderRadius: '8px', fontWeight: 500 }}>⚡ EXPRESS</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CURRENT STAGE — compact hero */}
        {(() => {
          const stageStyle = getStageStyle(nextStage || 'Selesai');
          return (
        <div style={{
          background: allDone
            ? C.successBg
            : stageStyle.bg,
          borderRadius: 18, padding: isMobile ? '12px 14px' : '16px 18px',
          boxShadow: PROD_SHADOW.card,
          border: `2px solid ${allDone ? C.success : stageStyle.accent + '60'}`,
          display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 14,
        }}>
          <div style={{
            width: isMobile ? 48 : 56, height: isMobile ? 48 : 56, borderRadius: isMobile ? 14 : 16, flexShrink: 0,
            background: allDone ? C.success : stageStyle.accent + '20',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isMobile ? 24 : 28,
            border: allDone ? 'none' : `2px solid ${stageStyle.accent}40`,
            boxShadow: stageStyle.dotShadow ? `0 0 8px ${stageStyle.dotShadow}` : 'none',
          }}>
            {STAGE_ICONS[nextStage || 'Selesai']}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 9 : 10, color: allDone ? C.successDark : C.n500, fontWeight: 500, letterSpacing: '0.06em' }}>
              {allDone ? 'STATUS' : 'TAHAP SELANJUTNYA'}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 16 : 20, fontWeight: 600, color: allDone ? C.successDark : stageStyle.text, marginTop: 2 }}>
              {allDone ? 'SELESAI 🎉' : nextStage}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <div style={{ flex: 1, height: 6, background: `${allDone ? C.success : stageStyle.accent}20`, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: allDone ? C.success : stageStyle.accent, borderRadius: 3, transition: 'width 0.6s ease' }} />
              </div>
              <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: allDone ? C.successDark : stageStyle.text }}>{progressPct}%</span>
            </div>
          </div>
        </div>
          );
        })()}

        {/* Stage Pipeline — horizontal visual */}
        <div style={{ background: 'white', borderRadius: 16, padding: '16px', boxShadow: PROD_SHADOW.card }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n500, letterSpacing: '0.05em', marginBottom: 14 }}>ALUR PRODUKSI</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 12 }}>
            {ACTIVE_STAGES.map((s, i) => {
              const isDone = doneStages.includes(s);
              const isCurrent = s === nextStage;
              const stageStyle = getStageStyle(s);
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 18, flexShrink: 0,
                      background: isDone ? stageStyle.accent : isCurrent ? `${stageStyle.accent}20` : C.n100,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: isCurrent ? `2.5px solid ${stageStyle.accent}` : isDone ? 'none' : `1.5px solid ${C.n200}`,
                      boxShadow: isCurrent ? `0 0 0 4px ${stageStyle.accent}15` : 'none',
                      transition: 'all 0.3s',
                    }}>
                      {isDone
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        : <span style={{ fontSize: 14 }}>{STAGE_ICONS[s]}</span>
                      }
                    </div>
                    <span style={{
                      fontFamily: 'Poppins', fontSize: 9, fontWeight: isDone || isCurrent ? 600 : 400,
                      color: isDone ? stageStyle.text : isCurrent ? stageStyle.text : C.n400,
                      textAlign: 'center', lineHeight: 1.1,
                    }}>
                      {s}
                    </span>
                  </div>
                  {i < ACTIVE_STAGES.length - 1 && (
                    <div style={{
                      height: 2, flex: 0.5, minWidth: 8,
                      background: isDone ? stageStyle.accent : C.n200,
                      borderRadius: 1, marginTop: -14,
                      transition: 'background 0.3s',
                    }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Timestamp log */}
          {localProgress.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.n200}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {localProgress.map((p, pi) => {
                const ps = getStageStyle(p.stage);
                return (
                <div key={`${p.stage}-${p.timestamp || pi}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: 10, color: ps.text, fontWeight: 500 }}>
                    {STAGE_ICONS[p.stage]} {p.stage}
                  </span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n400 }}>
                    {p.timestamp ? new Date(p.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </span>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Packing Tracker */}
        {item && (nextStage === 'Packing' || doneStages.includes('Packing')) && (
          <div style={{ background: 'white', borderRadius: 16, padding: '16px', boxShadow: PROD_SHADOW.card, border: `2px solid ${packingComplete ? C.success : C.warning}` }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n500, letterSpacing: '0.05em', marginBottom: 12 }}>📦 PROGRESS PACKING</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <button
                onClick={() => handlePackingCount(packingDone - 1)}
                disabled={packingDone <= 0 || packingUpdating}
                style={{ width: 44, height: 44, borderRadius: 22, border: `2px solid ${C.n300}`, background: packingDone > 0 ? C.n100 : C.n50, cursor: packingDone > 0 ? 'pointer' : 'default', fontFamily: 'Poppins', fontSize: 22, fontWeight: 600, color: C.n700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >−</button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 36, fontWeight: 600, color: packingComplete ? C.success : C.warning, lineHeight: 1 }}>
                  {packingDone}<span style={{ fontSize: 18, color: C.n500 }}> / {packingNeeded}</span>
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n400, marginTop: 4 }}>paket selesai dipacking</div>
              </div>
              <button
                onClick={() => handlePackingCount(packingDone + 1)}
                disabled={packingDone >= packingNeeded || packingUpdating}
                style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: packingDone < packingNeeded ? C.primary : C.n100, cursor: packingDone < packingNeeded ? 'pointer' : 'default', fontFamily: 'Poppins', fontSize: 22, fontWeight: 600, color: packingDone < packingNeeded ? 'white' : C.n400, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >+</button>
            </div>
            <div style={{ height: 8, background: C.n100, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', width: `${Math.min(100, (packingDone / packingNeeded) * 100)}%`, background: packingComplete ? C.success : C.warning, borderRadius: 4, transition: 'width 0.4s ease' }} />
            </div>
            {packingNotes && (
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.validationWarningText, background: C.validationWarningBg, borderRadius: 8, padding: '6px 10px', marginBottom: 8 }}>
                📝 {packingNotes}
              </div>
            )}
            {packingComplete
              ? <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.successDark, textAlign: 'center' }}>✅ Semua paket sudah dipacking! Lanjutkan ke tahap berikutnya.</div>
              : <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.validationWarningText, textAlign: 'center' }}>Selesaikan semua {packingNeeded} paket untuk lanjut tahap berikutnya.</div>
            }
          </div>
        )}

        {/* Bukti foto dokumentasi */}
        <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', boxShadow: PROD_SHADOW.card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n500, letterSpacing: '0.05em' }}>BUKTI FOTO</div>
            <button type="button" onClick={() => openFoto('receive')} style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 500, color: C.primary, background: C.primaryTint, border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>+ Foto</button>
          </div>
          {photosLoading && (
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n400, textAlign: 'center', padding: 8 }}>Memuat foto…</div>
          )}
          {!photosLoading && conditionPhotos.length === 0 && (
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n400, textAlign: 'center', padding: 10, background: C.n50, borderRadius: 10 }}>
              Belum ada dokumentasi. Foto packing wajib sebelum serah ke customer.
            </div>
          )}
          {!photosLoading && conditionPhotos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {conditionPhotos.filter((p) => p.url && p.url !== 'note_only').map((p, idx) => {
                const isEditing = editingPhotoId === p.id;
                return (
                <div key={p.id} style={{
                  background: isEditing ? C.validationWarningBg : C.n50,
                  borderRadius: 10, padding: '8px 10px',
                  border: `1px solid ${isEditing ? '#FDE68A' : 'transparent'}`,
                  transition: 'background 0.15s',
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {/* Thumbnail dengan X delete di kanan atas */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
                        style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'block' }}
                        aria-label="Lihat foto"
                      >
                        <img src={p.url} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', border: `1px solid ${C.n200}`, display: 'block' }} />
                      </button>
                      {!isEditing && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeletePhotoId(p.id); }}
                          aria-label="Hapus foto"
                          style={{
                            position: 'absolute', top: -6, right: -6,
                            width: 22, height: 22, borderRadius: 11,
                            background: C.danger, border: '2px solid white',
                            cursor: 'pointer', padding: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(220,38,38,0.4)',
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <>
                          <select
                            value={editingType}
                            onChange={(e) => setEditingType(e.target.value)}
                            style={{ width: '100%', height: 28, borderRadius: 6, border: `1px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 11, padding: '0 6px', marginBottom: 4 }}
                          >
                            <option value="initial_condition">📥 Kondisi Diterima</option>
                            <option value="packing">📦 Packing / Serah</option>
                            <option value="damage">🔴 Kerusakan</option>
                            <option value="qc">🔍 QC</option>
                            <option value="other">📋 Lainnya</option>
                          </select>
                          <textarea
                            value={editingNotes}
                            onChange={(e) => setEditingNotes(e.target.value)}
                            placeholder="Catatan foto..."
                            rows={2}
                            style={{ width: '100%', borderRadius: 6, border: `1px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 11, padding: 6, boxSizing: 'border-box', resize: 'none' }}
                          />
                        </>
                      ) : (
                        <>
                          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 500, color: C.n800 }}>{photoTypeLabel(p.type)}</div>
                          {p.notes && <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 2 }}>{p.notes}</div>}
                          {p.createdAt && (
                            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600, marginTop: 2 }}>
                              {new Date(p.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              {p.uploadedByName ? ` · ${p.uploadedByName}` : ''}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Edit action buttons */}
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => { setEditingPhotoId(null); setEditingNotes(''); setEditingType(''); }} disabled={photoActionLoading} style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.n300}`, background: 'white', color: C.n700, cursor: 'pointer' }}>Batal</button>
                      <button onClick={handleSaveEditPhoto} disabled={photoActionLoading} style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: 'none', background: C.primary, color: 'white', cursor: photoActionLoading ? 'default' : 'pointer', opacity: photoActionLoading ? 0.6 : 1 }}>
                        {photoActionLoading ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 10, border: '1.5px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                            Menyimpan
                          </span>
                        ) : '✓ Simpan'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => startEditPhoto(p)} style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.n200}`, background: 'white', color: C.n700, cursor: 'pointer' }}>✏️ Edit</button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => openFoto('receive')} style={{ flex: 1, padding: '8px', borderRadius: 10, border: `1px solid ${C.n200}`, background: C.validationInfoBg, fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.validationInfoText, cursor: 'pointer' }}>📥 Foto terima</button>
            <button type="button" onClick={() => openFoto('packing')} style={{ flex: 1, padding: '8px', borderRadius: 10, border: `1px solid ${C.n200}`, background: C.successBg, fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.successDark, cursor: 'pointer' }}>📦 Foto packing</button>
          </div>
        </div>

        {/* Items laundry (Only if multiple items) */}
        {tx.items && tx.items.length > 1 && (
          <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', boxShadow: PROD_SHADOW.card }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n500, letterSpacing: '0.05em', marginBottom: 10 }}>ITEM LAIN DI NOTA INI</div>
            {tx.items.map((itm, i) => {
              if (itm.itemId === item?.itemId) return null;
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < tx.items.length - 1 ? `1px solid ${C.n200}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 500, color: C.n800 }}>{itm.name || itm.serviceName}</span>
                    {(itm.express || itm.isExpress) && <span style={{ background: C.validationWarningBg, color: C.validationWarningText, fontFamily: 'Poppins', fontSize: 9, fontWeight: 500, padding: '1px 6px', borderRadius: 999 }}>⚡</span>}
                  </div>
                  <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 500, color: C.n500 }}>{itm.qty} {itm.unit}</span>
                </div>
              );
            })}
          </div>
        )}

        {(() => {
            const userNotes = (tx.notes || '').replace(/\[Bayar:[^\]]*\]/g, '').trim();
            if (!userNotes) return null;
            return (
              <div style={{ padding: '8px 10px', background: C.validationWarningBg, borderRadius: 8 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.validationWarningText }}>📝 Catatan: {userNotes}</span>
              </div>
            );
          })()}
        {problemSent && (
          <div style={{ padding: '8px 12px', background: C.successBg, borderRadius: 8 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.successDark, fontWeight: 600 }}>✅ Laporan masalah berhasil dikirim</span>
          </div>
        )}

      </div>

      {/* Bottom action area */}
      <div style={{ padding: isMobile ? '10px 12px' : '12px 16px', background: 'white', borderTop: `1px solid ${C.n100}`, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stageError && (
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.validationErrorText, background: C.validationErrorBg, borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
            ⚠️ {stageError}
          </div>
        )}

        {/* Problem modal */}
        {showProblem && (
          <div style={{
            marginBottom: 4,
            background: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
            borderRadius: 14,
            padding: '14px 16px',
            border: '1.5px solid #334155',
            boxShadow: '0 4px 16px rgba(15,23,42,0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>🚨</span>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>Laporan Masalah</div>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#CBD5E1', marginBottom: 8 }}>Pilih jenis masalah:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PROBLEM_PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => setProblemText(p)}
                  style={{
                    padding: '10px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                    border: `1.5px solid ${problemText === p ? '#EF4444' : '#475569'}`,
                    background: problemText === p ? '#7F1D1D' : '#334155',
                    fontFamily: 'Poppins', fontSize: 12,
                    color: problemText === p ? '#FECACA' : '#F1F5F9',
                    transition: 'all 0.15s',
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
                style={{
                  width: '100%', marginTop: 8, borderRadius: 10,
                  border: `1.5px solid #475569`,
                  background: '#0F172A', color: '#F1F5F9',
                  fontFamily: 'Poppins', fontSize: 12, padding: 10,
                  boxSizing: 'border-box', resize: 'none', outline: 'none',
                }}
              />
            )}

            {/* Upload foto bukti */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #334155' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>📸 Foto bukti (opsional)</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {problemPhotos.map((url, idx) => (
                  <div key={idx} style={{ position: 'relative', width: 56, height: 56, borderRadius: 8, overflow: 'hidden', border: `1.5px solid #475569` }}>
                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      onClick={() => setProblemPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 9, background: 'rgba(239,68,68,0.9)', border: 'none', cursor: 'pointer', color: 'white', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >×</button>
                  </div>
                ))}
                {problemPhotos.length < 5 && (
                  <label style={{ width: 56, height: 56, borderRadius: 8, border: `1.5px dashed ${C.n500}`, background: '#334155', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    {problemUploading ? (
                      <div style={{ width: 16, height: 16, border: `2px solid #475569`, borderTopColor: '#A78BFA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    ) : (
                      <>
                        <span style={{ fontSize: 18, color: '#94A3B8' }}>+</span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 8, color: '#CBD5E1', fontWeight: 600 }}>Foto</span>
                      </>
                    )}
                    <input type="file" accept="image/*" capture="environment" multiple onChange={handleAddProblemPhoto} style={{ display: 'none' }} disabled={problemUploading} />
                  </label>
                )}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 9, color: '#94A3B8', marginTop: 4 }}>
                Maks 5 foto · {problemPhotos.length}/5 dilampirkan
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setShowProblem(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid #475569`, background: '#334155', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>
                Batal
              </button>
              <button
                onClick={handleReportProblem}
                disabled={
                  !problemText || 
                  reportingProblem ||
                  (problemText === '✍️ Tulis sendiri...' && !customProblem?.trim())
                }
                style={{
                  flex: 2, padding: '10px', borderRadius: 10, border: 'none',
                  background: (problemText && !(problemText === '✍️ Tulis sendiri...' && !customProblem?.trim())) ? '#ef4444' : '#475569',
                  cursor: (problemText && !(problemText === '✍️ Tulis sendiri...' && !customProblem?.trim())) ? 'pointer' : 'default',
                  fontFamily: 'Poppins', fontSize: 13, fontWeight: 600,
                  color: (problemText && !(problemText === '✍️ Tulis sendiri...' && !customProblem?.trim())) ? 'white' : '#94A3B8',
                  boxShadow: (problemText && !(problemText === '✍️ Tulis sendiri...' && !customProblem?.trim())) ? '0 4px 12px rgba(239,68,68,0.4)' : 'none',
                }}
              >
                {reportingProblem ? 'Mengirim...' : '🚨 Laporkan'}
              </button>
            </div>
          </div>
        )}

        {/* Revert stage modal */}
        {showRevert && (
          <div style={{ marginBottom: 4, background: C.validationWarningBg, borderRadius: 10, padding: '12px 14px', border: '1.5px solid #FDE68A' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.validationWarningText, marginBottom: 6 }}>↩️ Batalkan Tahap Terakhir</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700, marginBottom: 8, lineHeight: 1.5 }}>
              Tahap terakhir akan dikembalikan ke tahap sebelumnya. Tulis alasan kenapa perlu di-revert (untuk audit trail).
            </div>
            <textarea
              value={revertReason}
              onChange={e => setRevertReason(e.target.value)}
              placeholder="Mis. Salah pencet, kainnya belum kering, dll..."
              rows={2}
              style={{ width: '100%', borderRadius: 8, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 12, padding: 8, boxSizing: 'border-box', resize: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => { setShowRevert(false); setRevertReason(''); }} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1.5px solid ${C.n200}`, background: 'white', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600 }}>
                Batal
              </button>
              <button
                onClick={handleRevertStage}
                disabled={!revertReason.trim() || reverting}
                style={{ flex: 2, padding: '8px', borderRadius: 8, border: 'none', background: revertReason.trim() ? C.warning : C.n200, cursor: revertReason.trim() ? 'pointer' : 'default', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: 'white' }}
              >
                {reverting ? 'Memproses...' : '↩️ Kembalikan ke Tahap Sebelumnya'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {/* Tombol revert (hanya muncul kalau sudah ada progress, dan belum allDone) */}
          {localProgress.length > 0 && !allDone && (
            <button
              onClick={() => setShowRevert(!showRevert)}
              title="Batalkan tahap terakhir (kalau salah pencet)"
              style={{ padding: '12px 14px', borderRadius: 14, border: `1.5px solid ${C.warning}`, background: showRevert ? C.validationWarningBg : 'white', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.warning, flexShrink: 0 }}
            >
              ↩️
            </button>
          )}

          {/* Tombol masalah */}
          <button
            onClick={() => setShowProblem(!showProblem)}
            style={{ padding: '12px 16px', borderRadius: 14, border: `1.5px solid ${C.danger}`, background: showProblem ? C.validationErrorBg : 'white', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.danger, flexShrink: 0 }}
          >
            🚨
          </button>

          {/* TOMBOL UTAMA — besar dan jelas */}
          {!allDone ? (
            <button
              onClick={handleUpdateStage}
              disabled={updating || !canUpdateStage}
              style={{
                flex: 1, height: 54, borderRadius: 14, border: 'none', cursor: updating || !canUpdateStage ? 'default' : 'pointer',
                background: updating || !canUpdateStage ? C.n200 : (() => {
                  const s = getStageStyle(nextStage); return s.accent;
                })(),
                fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: updating || !canUpdateStage ? C.n400 : 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: updating || !canUpdateStage ? 'none' : PROD_SHADOW.card,
                transition: 'all 0.2s',
              }}
            >
              {updating
                ? <><div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />&nbsp;Mencatat...</>
                : !canUpdateStage
                ? <span style={{ fontSize: 12, fontWeight: 500 }}>Selesaikan packing dulu</span>
                : <>{STAGE_ICONS[nextStage]} {nextStage}</>
              }
            </button>
          ) : (
            <button
              onClick={goBack}
              style={{ flex: 1, height: 54, borderRadius: 14, border: 'none', cursor: 'pointer', background: C.success, fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: PROD_SHADOW.card }}
            >
              ✅ Semua Selesai! Kembali
            </button>
          )}
        </div>
      </div>

      {/* Modal konfirmasi selesai */}
      {showSelesaiConfirm && (
        <div
          onClick={() => setShowSelesaiConfirm(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 340, background: 'white', borderRadius: 18,
              padding: 22, boxShadow: '0 12px 36px rgba(15,23,42,0.25)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 28,
                background: C.successBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px',
              }}>
                <span style={{ fontSize: 28 }}>✅</span>
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n800 }}>
                Tandai Selesai?
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 6, lineHeight: 1.5 }}>
                Item <strong>{item?.name}</strong> ({item?.qty} {item?.unit}) akan dipindahkan ke riwayat produksi dan ditandai siap diambil customer.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowSelesaiConfirm(false)}
                style={{
                  flex: 1, height: 42, borderRadius: 10,
                  border: `1.5px solid ${C.n200}`, background: 'white',
                  fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n700,
                  cursor: 'pointer',
                }}
              >
                Batal
              </button>
              <button
                onClick={() => doUpdateStage('Selesai')}
                style={{
                  flex: 1, height: 42, borderRadius: 10,
                  border: 'none', background: C.success,
                  fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(34,197,94,0.3)',
                }}
              >
                ✅ Ya, Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal konfirmasi hapus foto */}
      {confirmDeletePhotoId && (
        <div
          onClick={() => !photoActionLoading && setConfirmDeletePhotoId(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 340, background: 'white', borderRadius: 18,
              padding: 22, boxShadow: '0 12px 36px rgba(15,23,42,0.25)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 28, background: C.validationErrorBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px',
              }}>
                <span style={{ fontSize: 28 }}>🗑️</span>
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n800 }}>
                Hapus foto?
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 6, lineHeight: 1.5 }}>
                Foto ini akan dihapus dari dokumentasi. Aksi ini bisa di-undo oleh admin.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmDeletePhotoId(null)}
                disabled={photoActionLoading}
                style={{
                  flex: 1, height: 42, borderRadius: 10,
                  border: `1.5px solid ${C.n200}`, background: 'white',
                  fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n700,
                  cursor: photoActionLoading ? 'default' : 'pointer',
                  opacity: photoActionLoading ? 0.5 : 1,
                }}
              >
                Batal
              </button>
              <button
                onClick={() => handleDeletePhoto(confirmDeletePhotoId)}
                disabled={photoActionLoading}
                style={{
                  flex: 1, height: 42, borderRadius: 10, border: 'none',
                  background: photoActionLoading ? C.n400 : C.danger,
                  fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: 'white',
                  cursor: photoActionLoading ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {photoActionLoading ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                    Menghapus...
                  </>
                ) : 'Hapus Foto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox — preview foto tanpa pindah tab */}
      <PhotoLightbox
        visible={lightboxOpen}
        photos={conditionPhotos.filter((p) => p.url && p.url !== 'note_only')}
        index={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIndex}
        formatType={photoTypeLabel}
      />
    </div>
  );
}

// ErrorBoundary wrapper
export function DetailItemProduksiPage({ navigate, goBack, screenParams, user }) {
  return (
    <ErrorBoundary>
      <DetailItemPageContent navigate={navigate} goBack={goBack} screenParams={screenParams} user={user} />
    </ErrorBoundary>
  );
}
export default DetailItemProduksiPage;
