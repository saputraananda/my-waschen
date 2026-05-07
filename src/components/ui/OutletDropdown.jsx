import { useState, useRef, useEffect } from 'react';
import { C } from '../../utils/theme';

/**
 * OutletDropdown — custom scrollable dropdown with rounded corners.
 * Replaces native <select> for outlet filtering.
 */
export default function OutletDropdown({ value, onChange, outlets = [], placeholder = '🏪 Semua Outlet' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const selected = outlets.find((o) => o.id === value);
  const label = selected ? selected.name : placeholder;

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: 12, zIndex: 40 }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          background: C.white,
          border: `1.5px solid ${open ? C.primary : C.n300}`,
          borderRadius: open ? '12px 12px 0 0' : 12,
          fontFamily: 'Poppins', fontSize: 13, fontWeight: 500,
          color: value ? C.n900 : C.n600,
          cursor: 'pointer',
          outline: 'none',
          transition: 'border-color 0.2s, border-radius 0.2s',
          boxShadow: open ? `0 2px 12px ${C.primary}18` : '0 2px 6px rgba(15,23,42,0.06)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke={open ? C.primary : C.n600}
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transition: 'transform 0.25s ease', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown list */}
      <div
        style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: C.white,
          borderRight: open ? `1.5px solid ${C.primary}` : `1.5px solid transparent`,
          borderBottom: open ? `1.5px solid ${C.primary}` : `1.5px solid transparent`,
          borderLeft: open ? `1.5px solid ${C.primary}` : `1.5px solid transparent`,
          borderTop: 'none',
          borderRadius: '0 0 14px 14px',
          maxHeight: open ? 220 : 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          opacity: open ? 1 : 0,
          transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
          boxShadow: open ? '0 8px 24px rgba(15,23,42,0.12)' : 'none',
          pointerEvents: open ? 'auto' : 'none',
          scrollbarWidth: 'thin',
          scrollbarColor: `${C.n300} transparent`,
        }}
      >
        {/* "Semua Outlet" option */}
        <div
          onClick={() => { onChange(''); setOpen(false); }}
          style={{
            padding: '11px 14px',
            fontFamily: 'Poppins', fontSize: 13, fontWeight: !value ? 600 : 400,
            color: !value ? C.primary : C.n900,
            background: !value ? C.primaryLight : 'transparent',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { if (value) e.currentTarget.style.background = C.n50; }}
          onMouseLeave={(e) => { if (value) e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ fontSize: 14 }}>🏪</span>
          <span>{placeholder.replace('🏪 ', '')}</span>
          {!value && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="3" strokeLinecap="round" style={{ marginLeft: 'auto' }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: C.n100, margin: '0 12px' }} />

        {/* Outlet items */}
        {outlets.map((o, i) => {
          const isActive = value === o.id;
          return (
            <div
              key={o.id}
              onClick={() => { onChange(o.id); setOpen(false); }}
              style={{
                padding: '11px 14px',
                fontFamily: 'Poppins', fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? C.primary : C.n900,
                background: isActive ? C.primaryLight : 'transparent',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'background 0.15s',
                borderRadius: i === outlets.length - 1 ? '0 0 13px 13px' : 0,
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = C.n50; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: 8,
                background: isActive ? `${C.primary}18` : C.n50,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Poppins', fontSize: 10, fontWeight: 700,
                color: isActive ? C.primary : C.n600,
                flexShrink: 0,
              }}>
                {(o.name || '').split(' ').pop()?.slice(0, 2)?.toUpperCase() || '??'}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.name}
              </span>
              {isActive && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="3" strokeLinecap="round" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          );
        })}

        {/* Bottom padding for rounded corners */}
        <div style={{ height: 4 }} />
      </div>

      {/* Custom scrollbar styling (injected once) */}
      <style>{`
        [data-outlet-dropdown]::-webkit-scrollbar { width: 4px; }
        [data-outlet-dropdown]::-webkit-scrollbar-track { background: transparent; }
        [data-outlet-dropdown]::-webkit-scrollbar-thumb { background: ${C.n300}; border-radius: 4px; }
      `}</style>
    </div>
  );
}
