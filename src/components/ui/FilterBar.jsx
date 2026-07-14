/**
 * FilterBar Component
 * Universal filter bar for all pages
 * Features premium glassmorphism design
 *
 * @description
 * Consistent filter system across all pages with
 * date picker, outlet dropdown, search, status, and export.
 * Now with glassmorphism effect: translucent backdrop with blur
 *
 * @example
 * // Basic usage
 * <FilterBar
 *   dateRange={dateRange}
 *   onDateChange={setDateRange}
 *   outlets={outlets}
 *   selectedOutlets={selectedOutlets}
 *   onOutletChange={setSelectedOutlets}
 *   searchValue={search}
 *   onSearchChange={setSearch}
 *   statusOptions={statusOptions}
 *   selectedStatus={status}
 *   onStatusChange={setStatus}
 * />
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Glassmorphism styles
 */
const glassStyles = {
  backdrop: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
  },
  input: {
    background: 'rgba(255, 255, 255, 0.6)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.5)',
  },
};

/**
 * Icons
 */
const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const OutletIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FilterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 10 10 3 22 3" />
  </svg>
);

const ExportIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * DateRangePicker Component
 */
const DateRangePicker = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  placeholder = 'Tanggal',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const displayValue = startDate && endDate
    ? `${formatDate(startDate)} - ${formatDate(endDate)}`
    : startDate
    ? formatDate(startDate)
    : placeholder;

  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.98 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: compact ? 40 : 44,
          padding: '0 12px',
          background: '#FFFFFF',
          border: `1.5px solid ${isOpen ? '#6e2e78' : '#E5E7EB'}`,
          borderRadius: 10,
          fontFamily: 'Poppins, sans-serif',
          fontSize: 13,
          fontWeight: isOpen ? 600 : 400,
          color: startDate || endDate ? '#111827' : '#9CA3AF',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          minWidth: compact ? 140 : 180,
        }}
      >
        <span style={{ color: '#6e2e78' }}><CalendarIcon /></span>
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {displayValue}
        </span>
        <span style={{ color: '#9CA3AF' }}><ChevronDownIcon /></span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              zIndex: 100,
              background: '#FFFFFF',
              borderRadius: 12,
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
              padding: 12,
              minWidth: 280,
            }}
          >
            {/* Quick presets */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Hari Ini', days: 0 },
                { label: 'Kemarin', days: 1 },
                { label: '7 Hari', days: 7 },
                { label: '30 Hari', days: 30 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(start.getDate() - preset.days);
                    onStartDateChange(start);
                    onEndDateChange(end);
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid #E5E7EB',
                    background: '#FFFFFF',
                    fontFamily: 'Poppins',
                    fontSize: 11,
                    color: '#374151',
                    cursor: 'pointer',
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Date inputs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: 'Poppins', fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 4 }}>
                  Dari
                </label>
                <input
                  type="date"
                  value={startDate ? new Date(startDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => onStartDateChange(new Date(e.target.value))}
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    fontFamily: 'Poppins',
                    fontSize: 12,
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: 'Poppins', fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 4 }}>
                  Sampai
                </label>
                <input
                  type="date"
                  value={endDate ? new Date(endDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => onEndDateChange(new Date(e.target.value))}
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    fontFamily: 'Poppins',
                    fontSize: 12,
                  }}
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  onStartDateChange(null);
                  onEndDateChange(null);
                  setIsOpen(false);
                }}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
                  background: '#FFFFFF',
                  fontFamily: 'Poppins',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#374151',
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  flex: 2,
                  padding: '8px 0',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #8B5CF6, #6e2e78)',
                  fontFamily: 'Poppins',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#FFFFFF',
                  cursor: 'pointer',
                }}
              >
                Terapkan
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * OutletDropdown Component
 */
const OutletDropdown = ({
  outlets = [],
  selectedIds = [],
  onChange,
  placeholder = 'Semua Outlet',
  compact = false,
  multiSelect = true,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedOutlets = outlets.filter((o) => selectedIds.includes(o.id));
  const displayValue =
    selectedIds.length === 0
      ? placeholder
      : selectedIds.length === 1
      ? selectedOutlets[0]?.name || placeholder
      : `${selectedIds.length} Outlet`;

  const handleToggle = (outletId) => {
    if (multiSelect) {
      const newSelected = selectedIds.includes(outletId)
        ? selectedIds.filter((id) => id !== outletId)
        : [...selectedIds, outletId];
      onChange(newSelected);
    } else {
      onChange([outletId]);
      setIsOpen(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.98 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: compact ? 40 : 44,
          padding: '0 12px',
          background: '#FFFFFF',
          border: `1.5px solid ${isOpen ? '#6e2e78' : selectedIds.length > 0 ? '#6e2e78' : '#E5E7EB'}`,
          borderRadius: 10,
          fontFamily: 'Poppins, sans-serif',
          fontSize: 13,
          fontWeight: selectedIds.length > 0 ? 600 : 400,
          color: selectedIds.length > 0 ? '#111827' : '#9CA3AF',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          minWidth: compact ? 120 : 150,
        }}
      >
        <span style={{ color: '#6e2e78' }}><OutletIcon /></span>
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {displayValue}
        </span>
        {selectedIds.length > 0 && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              borderRadius: 8,
              background: '#E5E7EB',
              color: '#6B7280',
              cursor: 'pointer',
            }}
          >
            <CloseIcon />
          </span>
        )}
        {!selectedIds.length && (
          <span style={{ color: '#9CA3AF' }}><ChevronDownIcon /></span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99,
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                zIndex: 100,
                background: '#FFFFFF',
                borderRadius: 12,
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
                padding: 8,
                minWidth: 200,
                maxHeight: 300,
                overflowY: 'auto',
              }}
            >
              {outlets.map((outlet) => {
                const isSelected = selectedIds.includes(outlet.id);
                return (
                  <div
                    key={outlet.id}
                    onClick={() => handleToggle(outlet.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: isSelected ? '#6e2e7810' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `2px solid ${isSelected ? '#6e2e78' : '#D1D5DB'}`,
                        background: isSelected ? '#6e2e78' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span
                      style={{
                        fontFamily: 'Poppins',
                        fontSize: 13,
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? '#6e2e78' : '#111827',
                      }}
                    >
                      {outlet.name}
                    </span>
                  </div>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * SearchInput Component
 */
const SearchInput = ({
  value,
  onChange,
  placeholder = 'Cari...',
  compact = false,
  debounceMs = 300,
}) => {
  const [localValue, setLocalValue] = React.useState(value);
  const timeoutRef = React.useRef(null);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <span
        style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#9CA3AF',
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <SearchIcon />
      </span>
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          height: compact ? 40 : 44,
          padding: '0 36px 0 38px',
          borderRadius: 10,
          border: '1.5px solid #E5E7EB',
          fontFamily: 'Poppins, sans-serif',
          fontSize: 13,
          color: '#111827',
          background: '#FFFFFF',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {localValue && (
        <button
          onClick={handleClear}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 20,
            height: 20,
            borderRadius: 10,
            border: 'none',
            background: '#E5E7EB',
            color: '#6B7280',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
};

/**
 * StatusDropdown Component
 */
const StatusDropdown = ({
  options = [],
  selected = 'all',
  onChange,
  placeholder = 'Semua Status',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedOption = options.find((o) => o.value === selected);
  const displayValue = selectedOption?.label || placeholder;

  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.98 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: compact ? 40 : 44,
          padding: '0 12px',
          background: '#FFFFFF',
          border: `1.5px solid ${isOpen || selected !== 'all' ? '#6e2e78' : '#E5E7EB'}`,
          borderRadius: 10,
          fontFamily: 'Poppins, sans-serif',
          fontSize: 13,
          fontWeight: selected !== 'all' ? 600 : 400,
          color: selected !== 'all' ? '#111827' : '#9CA3AF',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: '#6e2e78' }}><FilterIcon /></span>
        <span style={{ flex: 1, textAlign: 'left' }}>{displayValue}</span>
        <span style={{ color: '#9CA3AF' }}><ChevronDownIcon /></span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99,
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                zIndex: 100,
                background: '#FFFFFF',
                borderRadius: 12,
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
                padding: 8,
                minWidth: 160,
              }}
            >
              {options.map((option) => {
                const isSelected = option.value === selected;
                return (
                  <div
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: isSelected ? '#6e2e7810' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {option.color && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          background: option.color,
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontFamily: 'Poppins',
                        fontSize: 13,
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? '#6e2e78' : '#111827',
                      }}
                    >
                      {option.label}
                    </span>
                  </div>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * ExportButton Component
 */
const ExportButton = ({
  onExport,
  options = ['Excel', 'PDF'],
  compact = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.98 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: compact ? 40 : 44,
          padding: '0 14px',
          background: 'linear-gradient(135deg, #8B5CF6, #6e2e78)',
          border: 'none',
          borderRadius: 10,
          fontFamily: 'Poppins, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          color: '#FFFFFF',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(110, 46, 120, 0.3)',
        }}
      >
        <ExportIcon />
        <span className="hide-mobile">Export</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99,
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                zIndex: 100,
                background: '#FFFFFF',
                borderRadius: 12,
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
                padding: 8,
                minWidth: 120,
              }}
            >
              {options.map((option) => (
                <div
                  key={option}
                  onClick={() => {
                    onExport?.(option.toLowerCase());
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    fontFamily: 'Poppins',
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#111827',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F3F4F6')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  📥 {option}
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * FilterBar Component (Main)
 */
const FilterBar = ({
  // Date
  dateRange = { start: null, end: null },
  onDateChange,

  // Outlet
  outlets = [],
  selectedOutlets = [],
  onOutletChange,

  // Search
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Cari...',

  // Status
  statusOptions = [],
  selectedStatus = 'all',
  onStatusChange,

  // Export
  onExport,
  exportOptions = ['Excel', 'PDF'],
  showExport = true,

  // Layout
  compact = false,
  showDate = true,
  showOutlet = true,
  showStatus = true,
  showSearch = true,

  // Gap
  gap = 8,

  // ClassName
  className = '',
  style = {},
}) => {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap,
        padding: compact ? '8px 0' : '10px 0',
        ...style,
      }}
    >
      {/* Date Picker */}
      {showDate && (
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onStartDateChange={(date) => onDateChange?.({ ...dateRange, start: date })}
          onEndDateChange={(date) => onDateChange?.({ ...dateRange, end: date })}
          compact={compact}
        />
      )}

      {/* Outlet Dropdown */}
      {showOutlet && (
        <OutletDropdown
          outlets={outlets}
          selectedIds={selectedOutlets}
          onChange={onOutletChange}
          compact={compact}
        />
      )}

      {/* Search Input - Takes remaining space */}
      {showSearch && (
        <SearchInput
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          compact={compact}
        />
      )}

      {/* Status Dropdown */}
      {showStatus && statusOptions.length > 0 && (
        <StatusDropdown
          options={statusOptions}
          selected={selectedStatus}
          onChange={onStatusChange}
          compact={compact}
        />
      )}

      {/* Export Button */}
      {showExport && onExport && (
        <ExportButton
          onExport={onExport}
          options={exportOptions}
          compact={compact}
        />
      )}
    </div>
  );
};

/**
 * FilterBarSkeleton - Loading placeholder
 */
export const FilterBarSkeleton = ({ compact = false }) => (
  <div
    style={{
      display: 'flex',
      gap: 8,
      padding: compact ? '8px 0' : '10px 0',
    }}
  >
    <div className="skeleton" style={{ width: 180, height: 44, borderRadius: 10 }} />
    <div className="skeleton" style={{ width: 150, height: 44, borderRadius: 10 }} />
    <div className="skeleton" style={{ flex: 1, height: 44, borderRadius: 10 }} />
  </div>
);

export {
  DateRangePicker,
  OutletDropdown,
  SearchInput,
  StatusDropdown,
  ExportButton,
};
export default FilterBar;
