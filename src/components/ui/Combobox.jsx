// ─────────────────────────────────────────────────────────────────────────────
// Combobox — searchable dropdown dengan free-text input
// ─────────────────────────────────────────────────────────────────────────────
// Behavior:
//   - User bisa: (1) klik buka dropdown, (2) ketik untuk filter list,
//     (3) ketik input bebas yang TIDAK ada di list (free text).
//   - onChange dipanggil terus saat user ketik — value mentah string.
//   - Pilih item dari list → set value persis sesuai opsi.
//   - Virtualisasi list (windowing manual) supaya 200+ items tidak laggy.
//
// Pure controlled — parent yang pegang state.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { C } from '../../utils/theme';

const ITEM_HEIGHT = 38;       // tinggi tiap baris (px)
const VIEWPORT_HEIGHT = 240;  // tinggi viewport list dropdown (px)
const OVERSCAN = 4;           // ekstra item di luar viewport biar smooth

export function Combobox({
  label,
  value,
  onChange,
  options = [],
  placeholder,
  disabled = false,
  helperText,
  error,
  emptyText = 'Tidak ada di daftar — input akan disimpan apa adanya.',
  /**
   * Auto-capitalize tiap kata saat user mengetik bebas.
   * Item yang dipilih dari list TIDAK diubah (pakai persis nilai opsi).
   */
  autoCapitalize = false,
  /** Aksesibilitas: id supaya label bisa htmlFor */
  id,
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [scrollTop, setScrollTop] = useState(0);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const isPickingRef = useRef(false); // flag biar onBlur tidak menutup saat klik item

  // Filter list sesuai input — kalau user ketik, dropdown jadi search.
  const filtered = useMemo(() => {
    const q = String(value || '').trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => String(opt).toLowerCase().includes(q));
  }, [value, options]);

  // Apakah value persis cocok dengan salah satu opsi?
  const exactMatch = useMemo(() => {
    const v = String(value || '').trim().toLowerCase();
    return options.some((opt) => String(opt).toLowerCase() === v);
  }, [value, options]);

  // Hitung posisi popup tiap kali buka / scroll
  const recalcPos = useCallback(() => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    recalcPos();
    const onScroll = () => recalcPos();
    const onResize = () => recalcPos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, recalcPos]);

  // Close kalau click di luar
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e) => {
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target)) return;
      // Klik dalam list (yang dirender via portal) jangan tutup
      if (listRef.current && listRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  // Reset scroll & active saat list berubah (mis. user ketik)
  useEffect(() => {
    if (open) {
      setScrollTop(0);
      setActiveIdx(filtered.length > 0 ? 0 : -1);
      if (listRef.current) listRef.current.scrollTop = 0;
    }
  }, [filtered.length, open]);

  const applyAutoCap = (s) => {
    if (!autoCapitalize) return s;
    return String(s).replace(/(^|\s|\()(\p{L})/gu, (m) => m.toUpperCase());
  };

  const handleType = (e) => {
    onChange(applyAutoCap(e.target.value));
    if (!open) setOpen(true);
  };

  const handlePick = (opt) => {
    isPickingRef.current = true;
    onChange(opt);            // value mentah dari list
    setOpen(false);
    inputRef.current?.blur();
    setTimeout(() => { isPickingRef.current = false; }, 50);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && activeIdx >= 0 && activeIdx < filtered.length) {
        e.preventDefault();
        handlePick(filtered[activeIdx]);
      } else {
        // Biarkan free-text dipertahankan, tutup saja.
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Scroll active item supaya kelihatan
  useEffect(() => {
    if (!open || activeIdx < 0) return;
    const top = activeIdx * ITEM_HEIGHT;
    const bottom = top + ITEM_HEIGHT;
    const view = listRef.current;
    if (!view) return;
    if (top < view.scrollTop) view.scrollTop = top;
    else if (bottom > view.scrollTop + VIEWPORT_HEIGHT) {
      view.scrollTop = bottom - VIEWPORT_HEIGHT;
    }
  }, [activeIdx, open]);

  // ─── Virtualization ───────────────────────────────────────────────────────
  const totalHeight = filtered.length * ITEM_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ITEM_HEIGHT) + OVERSCAN * 2;
  const endIdx = Math.min(filtered.length, startIdx + visibleCount);
  const visibleItems = filtered.slice(startIdx, endIdx);
  const offsetY = startIdx * ITEM_HEIGHT;

  // Highlight substring match
  const highlight = (text, q) => {
    if (!q) return text;
    const idx = String(text).toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: '#FEF3C7', color: 'inherit', padding: 0 }}>
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  const isFreeText = !!value && !exactMatch;

  return (
    <div ref={wrapRef} style={{ marginBottom: 16, position: 'relative' }}>
      {label && (
        <label htmlFor={id} style={{
          display: 'block', fontFamily: 'Poppins', fontSize: 12, fontWeight: 500,
          color: C.n600, marginBottom: 6,
        }}>
          {label}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value || ''}
          onChange={handleType}
          onKeyDown={handleKeyDown}
          onFocus={() => !disabled && setOpen(true)}
          onBlur={() => {
            // beri delay supaya klik item bisa terbaca duluan
            setTimeout(() => { if (!isPickingRef.current) setOpen(false); }, 120);
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          style={{
            width: '100%', height: 48, borderRadius: 10,
            padding: '0 40px 0 14px',
            border: `${open ? 2 : 1.5}px solid ${error ? (C.danger || '#DC2626') : open ? C.primary : C.n300}`,
            fontFamily: 'Poppins', fontSize: 14, color: disabled ? C.n500 : C.n900,
            background: disabled ? C.n50 : C.white,
            outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
          }}
        />

        {/* Right icon — chevron / clear */}
        <div
          onMouseDown={(e) => {
            // Biar tidak trigger blur sebelum aksi jalan
            e.preventDefault();
            if (disabled) return;
            if (value) onChange('');
            else { setOpen((v) => !v); inputRef.current?.focus(); }
          }}
          style={{
            position: 'absolute', right: 10, top: '50%',
            transform: 'translateY(-50%)',
            width: 26, height: 26, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: C.n600,
          }}
          aria-label={value ? 'Bersihkan' : 'Buka daftar'}
        >
          {value ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>
      </div>

      {/* Helper / status */}
      {!error && (helperText || isFreeText) && (
        <div style={{
          fontFamily: 'Poppins', fontSize: 10, color: isFreeText ? C.primary : C.n500,
          marginTop: 4,
        }}>
          {isFreeText ? '✏️ Input manual — tidak ada di daftar tapi tetap akan disimpan.' : helperText}
        </div>
      )}
      {error && (
        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.danger || '#DC2626', marginTop: 4 }}>
          {error}
        </div>
      )}

      {/* Dropdown list — portal supaya tidak terpotong overflow parent */}
      {open && !disabled && createPortal(
        <div
          ref={listRef}
          onMouseDown={() => { isPickingRef.current = true; }}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          style={{
            position: 'fixed',
            top: dropPos.top, left: dropPos.left, width: dropPos.width,
            maxHeight: VIEWPORT_HEIGHT,
            overflowY: 'auto',
            background: 'white',
            border: `1px solid ${C.n200}`,
            borderRadius: 10,
            boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
            zIndex: 9999,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{
              padding: '14px 12px',
              fontFamily: 'Poppins', fontSize: 12, color: C.n600,
              lineHeight: 1.5,
            }}>
              {emptyText}
            </div>
          ) : (
            <div style={{ height: totalHeight, position: 'relative' }}>
              <div style={{ transform: `translateY(${offsetY}px)` }}>
                {visibleItems.map((opt, i) => {
                  const idxInFiltered = startIdx + i;
                  const isActive = idxInFiltered === activeIdx;
                  const isSelected = String(opt).toLowerCase() === String(value || '').toLowerCase();
                  return (
                    <div
                      key={`${opt}-${idxInFiltered}`}
                      onMouseEnter={() => setActiveIdx(idxInFiltered)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handlePick(opt)}
                      style={{
                        height: ITEM_HEIGHT,
                        padding: '0 12px',
                        display: 'flex', alignItems: 'center',
                        fontFamily: 'Poppins', fontSize: 13,
                        color: isSelected ? C.primary : C.n900,
                        fontWeight: isSelected ? 700 : 500,
                        background: isActive ? `${C.primary}10` : 'white',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                    >
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {highlight(String(opt), value)}
                      </span>
                      {isSelected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer info — kalau hasil kosong tapi user masih bisa pakai input manual */}
          {filtered.length > 0 && (
            <div style={{
              borderTop: `1px solid ${C.n100}`,
              padding: '6px 12px',
              fontFamily: 'Poppins', fontSize: 10, color: C.n500,
              background: '#FAFBFC', position: 'sticky', bottom: 0,
            }}>
              {filtered.length} item · ketik bebas jika tidak ada di daftar
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

export default Combobox;
