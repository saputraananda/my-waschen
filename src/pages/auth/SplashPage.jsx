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
        {/* Logo Wäschen — same as login page */}
        <div style={{ width: 240, marginBottom: 12 }}>
          <svg viewBox="0 0 320 100" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
            {/* Bubbles */}
            <circle cx="28" cy="52" r="14" fill="none" stroke="#E85D04" strokeWidth="3.5"/>
            <circle cx="18" cy="72" r="8" fill="none" stroke="#E85D04" strokeWidth="3"/>
            <circle cx="38" cy="78" r="5" fill="#E85D04"/>
            <circle cx="48" cy="38" r="5" fill="#E85D04"/>
            {/* Text "Wäschen" */}
            <text x="52" y="68" fontFamily="'Poppins', Arial, sans-serif" fontSize="46" fontWeight="800" fill="white" letterSpacing="-1">
              W<tspan fontSize="42">ä</tspan>schen
            </text>
            {/* ® symbol */}
            <text x="285" y="42" fontFamily="'Poppins', Arial, sans-serif" fontSize="14" fontWeight="700" fill="rgba(255,255,255,0.7)">®</text>
            {/* Tagline bar */}
            <rect x="52" y="76" width="195" height="18" rx="2" fill="#E85D04"/>
            <text x="150" y="89" fontFamily="'Poppins', Arial, sans-serif" fontSize="10" fontWeight="700" fill="white" textAnchor="middle" letterSpacing="0.5">
              EXPERT LAUNDRY SOLUTIONS
            </text>
          </svg>
        </div>
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
