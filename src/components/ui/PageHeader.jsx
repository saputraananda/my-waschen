/**
 * PageHeader Component
 * Page title with optional subtitle, actions, and breadcrumbs
 * Features premium glassmorphism design
 *
 * @description
 * Consistent page header across all pages with
 * title, subtitle, actions, and breadcrumbs.
 * Now with glassmorphism effect: translucent backdrop with blur
 *
 * @example
 * // Basic usage
 * <PageHeader
 *   title="Dashboard"
 *   subtitle="Selamat pagi, Budi"
 * />
 *
 * // With actions
 * <PageHeader
 *   title="Transaksi"
 *   actions={<Button>+ Tambah</Button>}
 * />
 *
 * // With breadcrumbs
 * <PageHeader
 *   breadcrumbs={[
 *     { label: 'Home', href: '/' },
 *     { label: 'Transaksi', href: '/transaksi' },
 *     { label: 'Detail' }
 *   ]}
 *   title="Detail Transaksi"
 * />
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * Glassmorphism styles
 */
const glassStyles = {
  icon: {
    background: 'rgba(110, 46, 120, 0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 4px 15px rgba(110, 46, 120, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
  },
};

/**
 * Chevron icon for breadcrumbs
 */
const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/**
 * Breadcrumb item
 */
const BreadcrumbItem = ({ item, isLast }) => {
  const content = (
    <>
      <span
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 12,
          fontWeight: isLast ? 500 : 400,
          color: isLast ? '#374151' : '#9CA3AF',
          transition: 'color 0.15s ease',
        }}
      >
        {item.label}
      </span>
      {!isLast && (
        <span style={{ color: '#D1D5DB', marginLeft: 4, marginRight: 4 }}>
          <ChevronRightIcon />
        </span>
      )}
    </>
  );

  if (isLast || !item.href) {
    return <span>{content}</span>;
  }

  return (
    <Link
      to={item.href}
      style={{ textDecoration: 'none' }}
      onMouseEnter={(e) => {
        e.currentTarget.querySelector('span').style.color = '#5B005F';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.querySelector('span').style.color = '#9CA3AF';
      }}
    >
      {content}
    </Link>
  );
};

/**
 * Breadcrumbs component
 */
const Breadcrumbs = ({ items = [] }) => {
  if (items.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 8,
      }}
    >
      {items.map((item, index) => (
        <BreadcrumbItem
          key={index}
          item={item}
          isLast={index === items.length - 1}
        />
      ))}
    </div>
  );
};

/**
 * Back button component
 */
const BackButton = ({ onClick, label = 'Kembali' }) => (
  <motion.button
    onClick={onClick}
    whileTap={{ scale: 0.95 }}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '6px 12px',
      background: 'transparent',
      border: 'none',
      borderRadius: 8,
      fontFamily: 'Poppins, sans-serif',
      fontSize: 13,
      fontWeight: 500,
      color: '#5B005F',
      cursor: 'pointer',
      marginBottom: 8,
    }}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
    {label}
  </motion.button>
);

/**
 * PageHeader Component
 */
const PageHeader = ({
  // Content
  title = '',
  subtitle = '',
  icon = null,

  // Breadcrumbs
  breadcrumbs = [],

  // Back button
  onBack,
  backLabel = 'Kembali',

  // Actions
  actions = null,
  actionPosition = 'right', // 'right' | 'bottom'

  // Layout
  compact = false,
  transparent = false,

  // Styling
  className = '',
  style = {},
}) => {
  const containerStyle = {
    marginBottom: compact ? 12 : 16,
    padding: compact ? '0' : '8px 0',
    ...style,
  };

  const headerRowStyle = {
    display: 'flex',
    alignItems: compact ? 'center' : 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  };

  const titleSectionStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: compact ? 10 : 12,
    flex: 1,
    minWidth: 0,
  };

  const iconStyle = {
    width: compact ? 36 : 44,
    height: compact ? 36 : 44,
    borderRadius: compact ? 10 : 12,
    ...glassStyles.icon,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontSize: compact ? 18 : 22,
    flexShrink: 0,
  };

  const textSectionStyle = {
    flex: 1,
    minWidth: 0,
  };

  const titleStyle = {
    fontFamily: 'Poppins, sans-serif',
    fontSize: compact ? 16 : 20,
    fontWeight: 700,
    color: '#111827',
    lineHeight: 1.3,
    margin: 0,
  };

  const subtitleStyle = {
    fontFamily: 'Poppins, sans-serif',
    fontSize: compact ? 11 : 13,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 1.4,
  };

  const actionsStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  };

  return (
    <div
      className={`page-header ${className}`}
      style={containerStyle}
    >
      {/* Breadcrumbs */}
      {(breadcrumbs.length > 0 || onBack) && (
        <div style={{ marginBottom: 8 }}>
          {onBack && <BackButton onClick={onBack} label={backLabel} />}
          {breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
        </div>
      )}

      {/* Main header row */}
      <div style={headerRowStyle}>
        {/* Left: Icon + Title */}
        <div style={titleSectionStyle}>
          {icon && <div style={iconStyle}>{icon}</div>}
          <div style={textSectionStyle}>
            {title && <h1 style={titleStyle}>{title}</h1>}
            {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
          </div>
        </div>

        {/* Right: Actions */}
        {actions && actionPosition === 'right' && (
          <div style={actionsStyle}>{actions}</div>
        )}
      </div>

      {/* Bottom actions */}
      {actions && actionPosition === 'bottom' && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: compact ? 8 : 12,
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
};

/**
 * PageHeaderSkeleton - Loading placeholder
 */
export const PageHeaderSkeleton = ({ compact = false }) => (
  <div style={{ marginBottom: compact ? 12 : 16 }}>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div className="skeleton" style={{ width: compact ? 36 : 44, height: compact ? 36 : 44, borderRadius: compact ? 10 : 12 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ width: '60%', height: compact ? 16 : 20, borderRadius: 4, marginBottom: 6 }} />
        <div className="skeleton" style={{ width: '40%', height: 13, borderRadius: 4 }} />
      </div>
    </div>
  </div>
);

/**
 * SectionHeader - Smaller header for sections within a page
 */
export const SectionHeader = ({
  title = '',
  subtitle = '',
  action = null,
  actionLabel = 'Lihat semua',
  onActionClick,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    }}
  >
    <div>
      <h3
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          color: '#374151',
          margin: 0,
          lineHeight: 1.3,
        }}
      >
        {title}
      </h3>
      {subtitle && (
        <p
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 11,
            color: '#9CA3AF',
            margin: 0,
            marginTop: 2,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
    {action || onActionClick ? (
      <button
        onClick={onActionClick}
        style={{
          background: 'transparent',
          border: 'none',
          fontFamily: 'Poppins, sans-serif',
          fontSize: 12,
          fontWeight: 600,
          color: '#5B005F',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: 6,
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#5B005F10')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {actionLabel || action} →
      </button>
    ) : null}
  </div>
);

export default PageHeader;
