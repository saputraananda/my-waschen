// ─────────────────────────────────────────────────────────────────────────────
// CustomerSearchInput — autocomplete search by name/phone for checkout
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { useDebounce } from '../../utils/hooks';
import { rp } from '../../utils/helpers';

/**
 * CustomerSearchInput — typeahead search untuk customer.
 *
 * Props:
 * - onSelect(customer): callback saat customer dipilih
 * - onAddNew(): optional, callback "Tambah customer baru"
 * - placeholder
 * - autoFocus
 */
export const CustomerSearchInput = ({ onSelect, onAddNew, placeholder = 'Cari nama atau no. HP...', autoFocus = false }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debouncedQuery = useDebounce(query, 250);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch results when debounced query changes
  useEffect(() => {
    let cancelled = false;
    const search = async () => {
      const q = debouncedQuery.trim();
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await axios.get(`/api/customers/lookup?q=${encodeURIComponent(q)}`);
        if (!cancelled) {
          setResults(res?.data?.data || []);
          setActiveIdx(-1);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    search();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const handleKeyDown = (e) => {
    if (!open || results.length === 0) {
      if (e.key === 'Enter' && onAddNew && query.trim()) onAddNew(query);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && results[activeIdx]) {
        handleSelect(results[activeIdx]);
      } else if (onAddNew && query.trim()) {
        onAddNew(query);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleSelect = (customer) => {
    onSelect?.(customer);
    setQuery(`${customer.name} (${customer.phone || '-'})`);
    setOpen(false);
    setResults([]);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        {/* Search icon */}
        <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a3a3a" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          style={{
            width: '100%', height: 48,
            padding: '0 40px 0 42px',
            borderRadius: 12,
            border: `1.5px solid ${open && results.length > 0 ? C.primary : C.n300}`,
            fontFamily: 'Poppins', fontSize: 14, color: C.n900,
            outline: 'none', boxSizing: 'border-box',
            background: C.white,
            transition: 'border-color 0.15s',
          }}
        />

        {/* Loading indicator */}
        {loading && (
          <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
            <div style={{ width: 16, height: 16, border: `2px solid ${C.n200}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {/* Clear button */}
        {!loading && query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus(); }}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              width: 24, height: 24, borderRadius: 12, border: 'none',
              background: C.n100, color: '#3a3a3a',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12,
            }}
            aria-label="Hapus pencarian"
          >×</button>
        )}
      </div>

      {/* Dropdown */}
      {open && (results.length > 0 || (!loading && query.trim().length >= 2)) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          marginTop: 4, background: C.white,
          border: `1px solid ${C.n200}`, borderRadius: 12,
          boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
          maxHeight: 320, overflowY: 'auto',
          zIndex: 100,
        }}>
          {results.length === 0 && !loading && (
            <div style={{ padding: '14px 16px', textAlign: 'center', fontFamily: 'Poppins', fontSize: 12, color: '#3a3a3a' }}>
              Customer tidak ditemukan
              {onAddNew && (
                <button
                  type="button"
                  onClick={() => onAddNew(query)}
                  style={{
                    display: 'block', margin: '10px auto 0',
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: C.primary, color: 'white',
                    fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >+ Tambah Customer Baru</button>
              )}
            </div>
          )}
          {results.map((c, i) => {
            const isActive = i === activeIdx;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: isActive ? C.primaryLight : 'transparent',
                  border: 'none', borderBottom: i < results.length - 1 ? `1px solid ${C.n100}` : 'none',
                  cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: 18,
                  background: `linear-gradient(135deg, ${C.primaryLight}, ${C.primary}40)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.primary,
                  flexShrink: 0,
                }}>
                  {(c.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{c.name}</span>
                    {c.isMember && <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '1px 6px', borderRadius: 999 }}>★ MEMBER</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 11, color: '#3a3a3a' }}>📱 {c.phone || '-'}</span>
                    {c.depositBalance > 0 && (
                      <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.success, fontWeight: 600 }}>💰 {rp(c.depositBalance)}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {results.length > 0 && onAddNew && (
            <button
              type="button"
              onClick={() => onAddNew(query)}
              style={{
                width: '100%', padding: '12px 14px',
                background: C.n50, border: 'none', borderTop: `1px solid ${C.n200}`,
                cursor: 'pointer', textAlign: 'center',
                fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.primary,
              }}
            >+ Tambah Customer Baru</button>
          )}
        </div>
      )}
    </div>
  );
};
