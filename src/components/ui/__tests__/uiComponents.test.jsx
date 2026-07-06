/**
 * Session 3 — Test: UI Components
 * GlobalErrorBoundary, GlobalLoading, Skeleton, QRCode
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { GlobalErrorBoundary } from '../GlobalErrorBoundary';
import { GlobalLoading } from '../GlobalLoading';
import {
  SkeletonBar, SkeletonCard, SkeletonList,
  SkeletonStat, SkeletonStatGrid, SkeletonTable,
} from '../Skeleton';

// ── GlobalErrorBoundary ─────────────────────────────────────────────────────
describe('GlobalErrorBoundary', () => {
  // Suppress React error boundary console output in tests
  let consoleErrorSpy;
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when no error', () => {
    render(
      <GlobalErrorBoundary>
        <div>Child content</div>
      </GlobalErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('catches render errors and shows error UI', () => {
    const BadComponent = () => {
      throw new Error('Test crash');
    };

    render(
      <GlobalErrorBoundary>
        <BadComponent />
      </GlobalErrorBoundary>
    );

    expect(screen.getByText('Terjadi Kesalahan')).toBeInTheDocument();
    expect(screen.getByText('Test crash')).toBeInTheDocument();
    expect(screen.getByText('Coba Lagi')).toBeInTheDocument();
    expect(screen.getByText('Muat Ulang App')).toBeInTheDocument();
  });

  it('shows default error message when error has no message', () => {
    const BadComponent = () => {
      throw new Error(''); // empty message
    };

    render(
      <GlobalErrorBoundary>
        <BadComponent />
      </GlobalErrorBoundary>
    );

    expect(screen.getByText('Terjadi Kesalahan')).toBeInTheDocument();
    // Error message div should not render for empty message
    expect(screen.queryByText('Test crash')).not.toBeInTheDocument();
  });

  it('shows help text in error state', () => {
    const BadComponent = () => { throw new Error('Boom'); };

    render(
      <GlobalErrorBoundary>
        <BadComponent />
      </GlobalErrorBoundary>
    );

    expect(screen.getByText(/Aplikasi mengalami error/)).toBeInTheDocument();
  });
});

// ── GlobalLoading ───────────────────────────────────────────────────────────
describe('GlobalLoading', () => {
  it('returns null when visible is false', () => {
    const { container } = render(<GlobalLoading visible={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null by default (visible defaults to false)', () => {
    const { container } = render(<GlobalLoading />);
    expect(container.innerHTML).toBe('');
  });

  it('renders loading overlay when visible', () => {
    render(<GlobalLoading visible={true} />);
    expect(screen.getByText('Memuat...')).toBeInTheDocument();
  });

  it('shows custom message', () => {
    render(<GlobalLoading visible={true} message="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('renders spinner element', () => {
    const { container } = render(<GlobalLoading visible={true} />);
    // Should have a div with spin animation
    const styles = container.querySelector('style');
    expect(styles?.textContent).toContain('spin');
  });
});

// ── Skeleton Components ─────────────────────────────────────────────────────
describe('SkeletonBar', () => {
  it('renders a div', () => {
    const { container } = render(<SkeletonBar />);
    expect(container.firstChild.tagName).toBe('DIV');
  });

  it('applies custom width and height', () => {
    const { container } = render(<SkeletonBar width={200} height={30} />);
    const el = container.firstChild;
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('30px');
  });

  it('defaults to 100% width and 14px height', () => {
    const { container } = render(<SkeletonBar />);
    const el = container.firstChild;
    expect(el.style.width).toBe('100%');
    expect(el.style.height).toBe('14px');
  });

  it('applies custom radius', () => {
    const { container } = render(<SkeletonBar radius={20} />);
    expect(container.firstChild.style.borderRadius).toBe('20px');
  });
});

describe('SkeletonCard', () => {
  it('renders default 2 lines', () => {
    const { container } = render(<SkeletonCard />);
    // First child is the main bar (60%), second bar is 40%
    const bars = container.querySelectorAll('[style*="shimmer"]');
    expect(bars.length).toBeGreaterThanOrEqual(2);
  });

  it('renders with avatar when specified', () => {
    const { container } = render(<SkeletonCard avatar={true} />);
    // Avatar is a 40x40 circle
    const bars = container.querySelectorAll('[style*="shimmer"]');
    expect(bars.length).toBeGreaterThanOrEqual(3); // avatar + 2 text bars
  });

  it('renders custom number of lines', () => {
    const { container } = render(<SkeletonCard lines={4} />);
    const bars = container.querySelectorAll('[style*="shimmer"]');
    expect(bars.length).toBeGreaterThanOrEqual(4);
  });

  it('applies custom height', () => {
    const { container } = render(<SkeletonCard height={80} />);
    expect(container.firstChild.style.height).toBe('80px');
  });
});

describe('SkeletonList', () => {
  it('renders default 4 cards', () => {
    const { container } = render(<SkeletonList />);
    // Each card is a direct child
    const cards = container.firstChild.children;
    expect(cards.length).toBe(4);
  });

  it('renders custom count', () => {
    const { container } = render(<SkeletonList count={7} />);
    const cards = container.firstChild.children;
    expect(cards.length).toBe(7);
  });
});

describe('SkeletonStat', () => {
  it('renders 3 bars', () => {
    const { container } = render(<SkeletonStat />);
    const bars = container.querySelectorAll('[style*="shimmer"]');
    expect(bars.length).toBe(3);
  });
});

describe('SkeletonStatGrid', () => {
  it('renders default 4 stats', () => {
    const { container } = render(<SkeletonStatGrid />);
    const stats = container.firstChild.children;
    expect(stats.length).toBe(4);
  });

  it('renders custom count and columns', () => {
    const { container } = render(<SkeletonStatGrid count={6} columns={3} />);
    const stats = container.firstChild.children;
    expect(stats.length).toBe(6);
    expect(container.firstChild.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
  });
});

describe('SkeletonTable', () => {
  it('renders default 5 rows and 4 columns', () => {
    const { container } = render(<SkeletonTable />);
    // Header row + 5 data rows = 6 flex divs with bars
    const bars = container.querySelectorAll('[style*="shimmer"]');
    // header (4 bars) + 5 rows (4 bars each) = 24
    expect(bars.length).toBe(24);
  });

  it('renders custom rows and columns', () => {
    const { container } = render(<SkeletonTable rows={3} columns={2} />);
    const bars = container.querySelectorAll('[style*="shimmer"]');
    // header (2) + 3 rows × 2 = 8
    expect(bars.length).toBe(8);
  });
});
