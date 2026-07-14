// ─────────────────────────────────────────────────────────────────────────────
// AnimatedList — Premium animated scrollable list with gradient overlays
// Features:
// - Staggered entrance animations
// - Hover/selection state
// - Keyboard navigation (arrow keys)
// - Top/bottom gradient fade indicators
// - Smooth scroll behavior
// - Custom render support
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useInView } from 'framer-motion';
import { C } from '../utils/theme';

// Animated Item wrapper with entrance animation
export const AnimatedListItem = ({
  children,
  delay = 0,
  index,
  onMouseEnter,
  onClick,
  isSelected,
  style = {},
  isMobile = false,
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { amount: 0.1, triggerOnce: false });

  return (
    <motion.div
      ref={ref}
      data-index={index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      initial={{ opacity: 0, y: isMobile ? 8 : 12 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: isMobile ? 8 : 12 }}
      transition={{
        duration: 0.3,
        delay: delay * 0.03,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{ scale: isMobile ? 1 : 1.005, y: isMobile ? 0 : -2 }}
      whileTap={{ scale: 0.99 }}
      style={{
        position: 'relative', // Prevent layout shift during animation
        willChange: 'opacity, transform', // Hardware acceleration
        marginBottom: isMobile ? '8px' : '10px',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
};

// Main AnimatedList Component
const AnimatedList = ({
  items = [],
  onItemSelect,
  showGradients = true,
  enableArrowNavigation = false,
  className = '',
  itemClassName = '',
  displayScrollbar = true,
  initialSelectedIndex = -1,
  itemStyle = {},
  selectedStyle = {},
  renderItem = null,
  renderSkeleton = null,
  emptyMessage = 'Tidak ada data',
  emptyIcon = '📋',
  maxHeight = null,
  showLoadMore = false,
  loadingMore = false,
}) => {
  const listRef = useRef(null);
  const containerRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [topGradientOpacity, setTopGradientOpacity] = useState(0);
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState(1);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleItemMouseEnter = useCallback((index) => {
    setSelectedIndex(index);
  }, []);

  const handleItemClick = useCallback((item, index) => {
    setSelectedIndex(index);
    if (onItemSelect) {
      onItemSelect(item, index);
    }
  }, [onItemSelect]);

  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const gradientHeight = isMobile ? 30 : 50;
    setTopGradientOpacity(Math.min(scrollTop / gradientHeight, 1));
    const bottomDistance = scrollHeight - (scrollTop + clientHeight);
    setBottomGradientOpacity(scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / gradientHeight, 1));
  }, [isMobile]);

  // Keyboard navigation
  useEffect(() => {
    if (!enableArrowNavigation || isMobile) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          e.preventDefault();
          if (onItemSelect) {
            onItemSelect(items[selectedIndex], selectedIndex);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedIndex, onItemSelect, enableArrowNavigation, isMobile]);

  // Auto-scroll to selected item
  useEffect(() => {
    if (!keyboardNav || selectedIndex < 0 || !listRef.current) return;

    const container = listRef.current;
    const selectedItem = container.querySelector(`[data-index="${selectedIndex}"]`);

    if (selectedItem) {
      const extraMargin = 50;
      const containerScrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const itemTop = selectedItem.offsetTop;
      const itemBottom = itemTop + selectedItem.offsetHeight;

      if (itemTop < containerScrollTop + extraMargin) {
        container.scrollTo({ top: itemTop - extraMargin, behavior: 'smooth' });
      } else if (itemBottom > containerScrollTop + containerHeight - extraMargin) {
        container.scrollTo({
          top: itemBottom - containerHeight + extraMargin,
          behavior: 'smooth',
        });
      }
    }
    setKeyboardNav(false);
  }, [selectedIndex, keyboardNav]);

  const scrollbarStyle = !displayScrollbar ? {
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  } : {};

  const gradientHeight = isMobile ? 30 : 50;

  const defaultItemStyle = {
    padding: isMobile ? '12px 14px' : '14px 16px',
    background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
    borderRadius: isMobile ? 12 : 14,
    border: '1px solid rgba(0, 0, 0, 0.05)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  };

  const defaultSelectedStyle = {
    background: 'linear-gradient(145deg, rgba(91, 0, 95, 0.08), rgba(91, 0, 95, 0.03))',
    border: '1.5px solid rgba(91, 0, 95, 0.25)',
    boxShadow: '0 4px 12px rgba(91, 0, 95, 0.12), 0 2px 4px rgba(91, 0, 95, 0.08)',
  };

  return (
    <div ref={containerRef} className={`animated-list-container ${className}`} style={{ position: 'relative' }}>
      <div
        ref={listRef}
        className={`animated-list-scroll ${!displayScrollbar ? 'no-scrollbar' : ''}`}
        onScroll={handleScroll}
        style={{
          maxHeight: maxHeight || (isMobile ? 'calc(100vh - 280px)' : 'none'),
          overflowY: maxHeight ? 'auto' : 'visible',
          ...scrollbarStyle,
        }}
      >
        {items.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '40px 20px' : '60px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: isMobile ? 40 : 48, marginBottom: 12 }}>{emptyIcon}</div>
            <div style={{
              fontFamily: 'Poppins',
              fontSize: isMobile ? 14 : 15,
              fontWeight: 600,
              color: C.n700,
              marginBottom: 4,
            }}>
              {emptyMessage}
            </div>
          </div>
        ) : (
          items.map((item, index) => {
            const isSelected = selectedIndex === index;
            const combinedItemStyle = {
              ...defaultItemStyle,
              ...itemStyle,
              ...(isSelected ? defaultSelectedStyle : {}),
              ...(isSelected ? selectedStyle : {}),
            };

            return (
              <AnimatedListItem
                key={index}
                delay={index}
                index={index}
                onMouseEnter={() => handleItemMouseEnter(index)}
                onClick={() => handleItemClick(item, index)}
                isSelected={isSelected}
                isMobile={isMobile}
              >
                {renderItem ? (
                  renderItem(item, index, isSelected)
                ) : (
                  <div style={combinedItemStyle}>
                    <div style={{
                      fontFamily: 'Poppins',
                      fontSize: isMobile ? 13 : 14,
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? C.primary : C.n800,
                    }}>
                      {typeof item === 'string' ? item : JSON.stringify(item)}
                    </div>
                  </div>
                )}
              </AnimatedListItem>
            );
          })
        )}

        {showLoadMore && loadingMore && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px 0',
            color: C.n600,
            fontFamily: 'Poppins',
            fontSize: 12,
          }}>
            Memuat data berikutnya...
          </div>
        )}
      </div>

      {/* Gradient overlays */}
      {showGradients && items.length > 3 && (
        <>
          <div
            className="top-gradient"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: gradientHeight,
              background: 'linear-gradient(to bottom, rgba(248, 244, 255, 1), transparent)',
              pointerEvents: 'none',
              transition: 'opacity 0.3s ease',
              opacity: topGradientOpacity,
              zIndex: 1,
            }}
          />
          <div
            className="bottom-gradient"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: gradientHeight * 1.5,
              background: 'linear-gradient(to top, rgba(248, 244, 255, 1), transparent)',
              pointerEvents: 'none',
              transition: 'opacity 0.3s ease',
              opacity: bottomGradientOpacity,
              zIndex: 1,
            }}
          />
        </>
      )}
    </div>
  );
};

export default AnimatedList;
