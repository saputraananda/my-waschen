/**
 * GlobalLoading.jsx — Full-screen loading overlay.
 *
 * Usage:
 *   import { GlobalLoading } from '../components/ui';
 *
 *   <GlobalLoading visible={isLoading} message="Memuat data..." />
 */
import { C } from '../../utils/theme';

export function GlobalLoading({ visible = false, message = 'Memuat...' }) {
  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(15, 23, 42, 0.45)',
      backdropFilter: 'blur(4px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Poppins',
    }}>
      <div style={{
        background: 'white', borderRadius: 20, padding: '28px 36px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          border: `3px solid ${C.n200}`,
          borderTopColor: C.primary,
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{
          fontFamily: 'Poppins', fontSize: 14, fontWeight: 600,
          color: C.n700,
        }}>
          {message}
        </span>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
