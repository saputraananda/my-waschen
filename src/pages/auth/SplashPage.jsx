import { useState, useEffect } from 'react';
import { C } from '../../utils/theme';

export default function SplashPage({ onDone }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  useEffect(() => {
    const interval = setInterval(() => setProgress((p) => Math.min(p + 4, 100)), 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ flex: 1, background: `linear-gradient(160deg, ${C.primary} 0%, ${C.primaryDark} 60%, #2D0030 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
      <div style={{ position: 'absolute', bottom: 80, left: -80, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, border: '1.5px solid rgba(255,255,255,0.2)' }}>
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="18" stroke="white" strokeWidth="2.5" fill="none" opacity="0.3" />
            <path d="M14 24 C14 18, 20 14, 24 20 C28 14, 34 18, 34 24 C34 30, 28 35, 24 38 C20 35, 14 30, 14 24Z" fill="white" opacity="0.9" />
            <circle cx="24" cy="22" r="4" fill="white" opacity="0.6" />
          </svg>
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 32, fontWeight: 700, color: 'white', letterSpacing: '-0.5px' }}>Waschen</div>
        <div style={{ fontFamily: 'Poppins', fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 400, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Smart Laundry Management</div>
      </div>

      <div style={{ position: 'absolute', bottom: 60, left: 40, right: 40 }}>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'rgba(255,255,255,0.7)', borderRadius: 2, transition: 'width 0.08s linear' }} />
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 10 }}>v1.0.0 · PT Waschen Alora Indonesia</div>
      </div>
    </div>
  );
}
