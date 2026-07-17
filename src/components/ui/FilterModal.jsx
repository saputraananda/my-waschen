// ─────────────────────────────────────────────────────────────────────────────
// FilterModal.jsx — Unified Filter Modal Component
// Consistent filter UI across all pages
// Mobile: Bottom sheet | Desktop: Center modal
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../../utils/theme';

// ─── Filter Modal Component ──────────────────────────────────────────────────
export default function FilterModal({
  visible,
  onClose,
  title = 'Filter',
  onApply,
  onReset,
  children,
  footer,
}) {
  const contentRef = useRef(null);

  // Handle escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && visible) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [visible, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [visible]);

  const handleApply = () => {
    onApply?.();
    onClose();
  };

  const handleReset = () => {
    onReset?.();
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 500, // GlassModal level — above Premium Modal (400), below Select (9000)
            }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: '85vh',
              background: 'white',
              borderRadius: '24px 24px 0 0',
              zIndex: 501,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Handle */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '12px 0 0',
            }}>
              <div style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: C.n200,
              }} />
            </div>

            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: `1px solid ${C.n100}`,
              flexShrink: 0,
            }}>
              <div style={{
                fontFamily: 'Poppins',
                fontSize: 16,
                fontWeight: 700,
                color: C.n900,
              }}>
                {title}
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  border: 'none',
                  background: C.n50,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: C.n600,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div
              ref={contentRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {children}
            </div>

            {/* Footer */}
            {footer || (
              <div style={{
                display: 'flex',
                gap: 10,
                padding: '16px 20px',
                paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
                borderTop: `1px solid ${C.n100}`,
                flexShrink: 0,
              }}>
                <button
                  onClick={handleReset}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 12,
                    border: `1.5px solid ${C.n200}`,
                    background: 'white',
                    cursor: 'pointer',
                    fontFamily: 'Poppins',
                    fontSize: 14,
                    fontWeight: 600,
                    color: C.n600,
                  }}
                >
                  Reset
                </button>
                <button
                  onClick={handleApply}
                  style={{
                    flex: 2,
                    height: 48,
                    borderRadius: 12,
                    border: 'none',
                    background: `linear-gradient(135deg, ${C.primaryHover}, ${C.primary})`,
                    cursor: 'pointer',
                    fontFamily: 'Poppins',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'white',
                  }}
                >
                  Terapkan
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Filter Section Component ────────────────────────────────────────────────
export function FilterSection({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {title && (
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 12,
          fontWeight: 600,
          color: C.n600,
          marginBottom: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Filter Chip Group Component ─────────────────────────────────────────────
export function FilterChipGroup({ options = [], selected = [], onChange, multiple = true }) {
  const toggle = (value) => {
    if (multiple) {
      if (selected.includes(value)) {
        onChange?.(selected.filter(v => v !== value));
      } else {
        onChange?.([...selected, value]);
      }
    } else {
      onChange?.(selected === value ? null : value);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
    }}>
      {options.map(opt => {
        const value = opt.value ?? opt;
        const label = opt.label ?? opt;
        const isSelected = multiple
          ? selected.includes(value)
          : selected === value;

        return (
          <button
            key={String(value)}
            onClick={() => toggle(value)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: `1.5px solid ${isSelected ? C.primary : C.n200}`,
              background: isSelected ? `${C.primary}12` : 'white',
              cursor: 'pointer',
              fontFamily: 'Poppins',
              fontSize: 12,
              fontWeight: isSelected ? 600 : 500,
              color: isSelected ? C.primary : C.n700,
              transition: 'all 0.2s ease',
            }}
          >
            {opt.icon && <span style={{ marginRight: 4 }}>{opt.icon}</span>}
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Date Presets Component ─────────────────────────────────────────────────
const DATE_PRESETS = [
  { key: 'today', label: 'Hari ini' },
  { key: 'yesterday', label: 'Kemarin' },
  { key: '7d', label: '7 Hari' },
  { key: '30d', label: '30 Hari' },
  { key: 'this_month', label: 'Bulan Ini' },
  { key: 'last_month', label: 'Bulan Lalu' },
];

export function DatePresets({ selected, onChange }) {
  return (
    <FilterChipGroup
      options={DATE_PRESETS}
      selected={selected}
      onChange={(val) => onChange?.(val)}
      multiple={false}
    />
  );
}

// ─── Status Chips Component ─────────────────────────────────────────────────
export function StatusChips({ options = [], selected = [], onChange }) {
  return <FilterChipGroup options={options} selected={selected} onChange={onChange} />;
}

// ─── Search Filter Header Component ──────────────────────────────────────────
export function SearchFilterHeader({
  searchValue,
  onSearchChange,
  onFilterClick,
  filterActive = false,
  searchPlaceholder = 'Cari...',
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 44px',
      gap: 8,
      marginBottom: 12,
    }}>
      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={C.n400}
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={searchPlaceholder}
          style={{
            width: '100%',
            height: 44,
            borderRadius: 10,
            padding: '0 12px 0 38px',
            border: `1.5px solid ${C.n200}`,
            background: 'white',
            fontFamily: 'Poppins',
            fontSize: 13,
            color: C.n900,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {searchValue && (
          <button
            onClick={() => onSearchChange?.('')}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 24,
              height: 24,
              borderRadius: 12,
              border: 'none',
              background: C.n100,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.n500} strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter Button */}
      <button
        onClick={onFilterClick}
        style={{
          height: 44,
          borderRadius: 10,
          border: `1.5px solid ${filterActive ? C.primary : C.n200}`,
          background: filterActive ? `${C.primary}10` : 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={filterActive ? C.primary : C.n600} strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="6" x2="14" y2="6" />
          <circle cx="16" cy="6" r="2" />
          <line x1="20" y1="6" x2="18" y2="6" />
          <line x1="4" y1="12" x2="6" y2="12" />
          <circle cx="8" cy="12" r="2" />
          <line x1="20" y1="12" x2="10" y2="12" />
          <line x1="4" y1="18" x2="12" y2="18" />
          <circle cx="14" cy="18" r="2" />
          <line x1="20" y1="18" x2="16" y2="18" />
        </svg>
        {filterActive && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 12,
            height: 12,
            borderRadius: 6,
            background: C.primary,
            border: '2px solid white',
          }} />
        )}
      </button>
    </div>
  );
}

// ─── Quick Filter Chips Component ───────────────────────────────────────────
export function QuickFilterChips({ tabs = [], activeTab, onChange }) {
  return (
    <div style={{
      display: 'flex',
      gap: 6,
      overflowX: 'auto',
      paddingBottom: 8,
      marginBottom: 12,
      WebkitOverflowScrolling: 'touch',
    }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange?.(tab.value)}
            style={{
              flexShrink: 0,
              padding: '8px 14px',
              borderRadius: 999,
              border: 'none',
              background: isActive ? C.primary : C.n50,
              cursor: 'pointer',
              fontFamily: 'Poppins',
              fontSize: 12,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'white' : C.n600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {tab.icon && <span>{tab.icon}</span>}
            {tab.label}
            {tab.count != null && (
              <span style={{
                background: isActive ? 'rgba(255,255,255,0.3)' : C.n200,
                padding: '2px 6px',
                borderRadius: 999,
                fontSize: 10,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Checkbox List Component ────────────────────────────────────────────────
export function CheckboxList({ options = [], selected = [], onChange }) {
  const toggle = (value) => {
    if (selected.includes(value)) {
      onChange?.(selected.filter(v => v !== value));
    } else {
      onChange?.([...selected, value]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {options.map(opt => {
        const value = opt.value ?? opt;
        const label = opt.label ?? opt;
        const isSelected = selected.includes(value);

        return (
          <label
            key={String(value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 8,
              background: isSelected ? `${C.primary}08` : 'transparent',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              border: `2px solid ${isSelected ? C.primary : C.n300}`,
              background: isSelected ? C.primary : 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {isSelected && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggle(value)}
              style={{ display: 'none' }}
            />
            <span style={{
              fontFamily: 'Poppins',
              fontSize: 13,
              color: C.n800,
            }}>
              {label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
