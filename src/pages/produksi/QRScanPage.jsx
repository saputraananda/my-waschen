/**
 * ProduksiQRScanPage.jsx
 * Scanner QR Code untuk identifikasi order cucian.
 * SDM cukup arahkan kamera ke label nota → langsung buka detail order.
 *
 * Cara kerja:
 * - Gunakan getUserMedia (kamera belakang)
 * - Decode frame tiap 200ms menggunakan jsQR
 * - Jika berhasil decode → cari transaksi → navigate ke detail
 * - Fallback: input manual nomor nota
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import axios from 'axios';
import { C } from '../../utils/theme';
import { TopBar, Btn } from '../../components/ui';

export default function ProduksiQRScanPage({ navigate, goBack }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const frameRef    = useRef(null);

  const [mode, setMode]           = useState('camera');  // 'camera' | 'manual'
  const [scanning, setScanning]   = useState(false);
  const [result, setResult]       = useState(null);      // decoded text
  const [manualNo, setManualNo]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [cameraError, setCameraError] = useState('');
  const [flashOn, setFlashOn]     = useState(false);
  const [foundTx, setFoundTx]     = useState(null);

  // ── Buka kamera ────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
      }
    } catch (err) {
      setCameraError('Kamera tidak dapat diakses. Gunakan input manual.');
      setMode('manual');
    }
  }, []);

  // ── Stop kamera ────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setScanning(false);
  }, []);

  // ── Scan frame ─────────────────────────────────────────────────────────────
  const scanFrame = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== 4) {
      frameRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const decoded   = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (decoded?.data) {
      // Ekstrak transaction_no dari hasil decode
      // Format QR: "WAS-XXXXXX" atau URL yang berisi "nota=WAS-XXXXXX"
      const raw = decoded.data.trim();
      const notaMatch = raw.match(/([A-Z]{2,5}-\d{4,})/);
      const notaNo = notaMatch ? notaMatch[1] : raw;
      setResult(notaNo);
      stopCamera();
      lookupTransaction(notaNo);
      return;
    }
    frameRef.current = requestAnimationFrame(scanFrame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]);

  useEffect(() => {
    if (scanning) {
      frameRef.current = requestAnimationFrame(scanFrame);
    }
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [scanning, scanFrame]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // ── Torch (flash) toggle ──────────────────────────────────────────────────
  const toggleFlash = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !flashOn }] });
      setFlashOn(f => !f);
    } catch { /* tidak semua device support */ }
  };

  // ── Lookup transaksi ───────────────────────────────────────────────────────
  const lookupTransaction = async (notaNo) => {
    if (!notaNo?.trim()) return;
    setLoading(true);
    setError('');
    setFoundTx(null);
    try {
      const res = await axios.get(`/api/transactions/${encodeURIComponent(notaNo.trim())}`);
      const tx  = res?.data?.data;
      if (!tx) { setError('Nota tidak ditemukan.'); return; }
      setFoundTx(tx);
    } catch (err) {
      const msg = err?.response?.data?.message;
      setError(msg || 'Nota tidak ditemukan. Cek kembali nomor nota.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = () => {
    if (!manualNo.trim()) { setError('Masukkan nomor nota.'); return; }
    setResult(manualNo.trim());
    lookupTransaction(manualNo.trim());
  };

  const handleNavigate = () => {
    if (!foundTx) return;
    stopCamera();
    navigate('detail_item_produksi', foundTx);
  };

  const handleRetry = () => {
    setResult(null);
    setFoundTx(null);
    setError('');
    setManualNo('');
    if (mode === 'camera') startCamera();
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0F172A', overflow: 'hidden' }}>
      <TopBar
        title="Scan Label Nota"
        onBack={goBack}
        rightAction={mode === 'camera' ? toggleFlash : undefined}
        rightIcon={mode === 'camera'
          ? <svg width="22" height="22" viewBox="0 0 24 24" fill={flashOn ? '#FBBF24' : 'none'} stroke={flashOn ? '#FBBF24' : 'currentColor'} strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          : undefined
        }
      />

      {/* Mode tabs */}
      <div style={{ display: 'flex', background: '#1E293B', padding: '6px 16px', gap: 8, flexShrink: 0 }}>
        {[{ k: 'camera', label: '📷 Kamera' }, { k: 'manual', label: '⌨️ Manual' }].map(m => (
          <button
            key={m.k}
            onClick={() => { setMode(m.k); setResult(null); setFoundTx(null); setError(''); if (m.k === 'camera') startCamera(); else stopCamera(); }}
            style={{ flex: 1, padding: '8px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, background: mode === m.k ? '#3B82F6' : 'transparent', color: mode === m.k ? 'white' : '#94A3B8' }}
          >{m.label}</button>
        ))}
      </div>

      {/* Camera view */}
      {mode === 'camera' && (
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Video feed */}
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Scan overlay */}
          {!result && !cameraError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              {/* Viewfinder box */}
              <div style={{ width: 240, height: 240, position: 'relative' }}>
                {/* Corner brackets */}
                {[
                  { top: 0, left: 0, borderTop: '3px solid #3B82F6', borderLeft: '3px solid #3B82F6', borderRadius: '4px 0 0 0' },
                  { top: 0, right: 0, borderTop: '3px solid #3B82F6', borderRight: '3px solid #3B82F6', borderRadius: '0 4px 0 0' },
                  { bottom: 0, left: 0, borderBottom: '3px solid #3B82F6', borderLeft: '3px solid #3B82F6', borderRadius: '0 0 0 4px' },
                  { bottom: 0, right: 0, borderBottom: '3px solid #3B82F6', borderRight: '3px solid #3B82F6', borderRadius: '0 0 4px 0' },
                ].map((s, i) => (
                  <div key={i} style={{ position: 'absolute', width: 32, height: 32, ...s }} />
                ))}
                {/* Scan line */}
                <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: '#3B82F6', top: '50%', animation: 'scanLine 2s ease-in-out infinite', opacity: 0.8 }} />
              </div>
              <div style={{ marginTop: 20, fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: 'white', textAlign: 'center', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                Arahkan ke QR Code pada label nota
              </div>
            </div>
          )}

          {/* Camera error */}
          {cameraError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, background: '#0F172A' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 20 }}>{cameraError}</div>
              <Btn variant="secondary" onClick={() => setMode('manual')}>Pakai Input Manual</Btn>
            </div>
          )}
        </div>
      )}

      {/* Manual input */}
      {mode === 'manual' && !foundTx && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24, gap: 16 }}>
          <div style={{ textAlign: 'center', paddingTop: 24 }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>🔍</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: 'white' }}>Cari Nota</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: '#94A3B8', marginTop: 4 }}>Ketik nomor nota atau scan barcode</div>
          </div>
          <input
            value={manualNo}
            onChange={e => { setManualNo(e.target.value.toUpperCase()); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
            placeholder="Contoh: WAS-20250514-001"
            autoFocus
            style={{
              height: 54, borderRadius: 14, border: `2px solid ${error ? '#EF4444' : '#334155'}`,
              background: '#1E293B', color: 'white', fontFamily: 'Poppins', fontSize: 15,
              padding: '0 16px', outline: 'none', boxSizing: 'border-box', width: '100%',
              letterSpacing: 1,
            }}
          />
          {error && <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#EF4444' }}>⚠️ {error}</div>}
          <Btn variant="primary" fullWidth loading={loading} onClick={handleManualSearch}>
            🔍 Cari Order
          </Btn>
        </div>
      )}

      {/* Result panel */}
      {(result || foundTx || (error && mode === 'camera')) && (
        <div style={{ position: mode === 'camera' ? 'absolute' : 'relative', bottom: 0, left: 0, right: 0, background: '#1E293B', borderRadius: mode === 'camera' ? '20px 20px 0 0' : 0, padding: '20px 20px 32px', flexShrink: 0 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ width: 32, height: 32, border: '3px solid #334155', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <div style={{ fontFamily: 'Poppins', fontSize: 13, color: '#94A3B8' }}>Mencari nota {result}...</div>
            </div>
          )}

          {error && !loading && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>❌</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: '#EF4444', marginBottom: 4 }}>Tidak Ditemukan</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>{error}</div>
              <Btn variant="secondary" onClick={handleRetry}>Scan Ulang</Btn>
            </div>
          )}

          {foundTx && !loading && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: '#10B981' }}>Order ditemukan!</div>
              </div>
              <div style={{ background: '#0F172A', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: 'white', marginBottom: 4 }}>{foundTx.customerName}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>{foundTx.id} · {foundTx.date}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ background: '#1E293B', padding: '3px 10px', borderRadius: 999, fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: foundTx.status === 'selesai' ? '#10B981' : '#3B82F6' }}>
                    {foundTx.status === 'baru' ? '📥 Baru masuk'
                     : foundTx.status === 'proses' ? '🔄 Sedang diproses'
                     : foundTx.status === 'selesai' ? '✅ Sudah selesai'
                     : foundTx.status}
                  </span>
                  {foundTx.isExpress && <span style={{ background: '#FEF3C7', color: '#92400E', fontFamily: 'Poppins', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999 }}>⚡ EXPRESS</span>}
                </div>
                {foundTx.items?.length > 0 && (
                  <div style={{ marginTop: 10, borderTop: '1px solid #1E293B', paddingTop: 8 }}>
                    {foundTx.items.slice(0, 3).map((item, i) => (
                      <div key={i} style={{ fontFamily: 'Poppins', fontSize: 12, color: '#CBD5E1' }}>• {item.name || item.serviceName} {item.qty && `(${item.qty} ${item.unit || ''})`}</div>
                    ))}
                    {foundTx.items.length > 3 && <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#64748B' }}>+{foundTx.items.length - 3} item lainnya</div>}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleRetry} style={{ padding: '12px', borderRadius: 12, border: `1.5px solid #334155`, background: 'transparent', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: '#94A3B8' }}>
                  Scan Lagi
                </button>
                <button onClick={handleNavigate} style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', fontFamily: 'Poppins', fontSize: 14, fontWeight: 800, color: 'white' }}>
                  Buka Order →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes scanLine { 0%, 100% { transform: translateY(-80px); } 50% { transform: translateY(80px); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
