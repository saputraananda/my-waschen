/**
 * Session 3 — Test: Barrel UI Components (index.jsx)
 * TopBar, useToast, Btn, Input, Badge, Avatar, Toast, SearchBar,
 * StatCard, Chip, Divider, EmptyState, BottomSheet, Modal, SectionHeader
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  useToast, TopBar, Btn, Input, Badge, Avatar, Toast,
  SearchBar, StatCard, Chip, Divider, EmptyState,
  BottomSheet, Modal, SectionHeader, Select, Textarea,
} from '../index';

// Helper: wrap hook test
function renderHook(hook) {
  let result;
  function TestComponent() {
    result = hook();
    return null;
  }
  render(<TestComponent />);
  return result;
}

// ── useToast ────────────────────────────────────────────────────────────────
describe('useToast()', () => {
  it('initializes with hidden state', () => {
    const [toast] = renderHook(() => useToast());
    expect(toast.visible).toBe(false);
    expect(toast.message).toBe('');
    expect(toast.type).toBe('success');
  });

  it('showToast sets visible and message', () => {
    const [toast, showToast] = renderHook(() => useToast());
    showToast('Data saved!');
    expect(toast.visible).toBe(true);
    expect(toast.message).toBe('Data saved!');
    expect(toast.type).toBe('success');
  });

  it('showToast accepts custom type', () => {
    const [toast, showToast] = renderHook(() => useToast());
    showToast('Error!', 'error');
    expect(toast.type).toBe('error');
  });
});

// ── TopBar ──────────────────────────────────────────────────────────────────
describe('TopBar', () => {
  it('renders title', () => {
    render(<TopBar title="Dashboard" />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<TopBar title="Orders" subtitle="12 active" />);
    expect(screen.getByText('12 active')).toBeInTheDocument();
  });

  it('renders back button when onBack is provided', () => {
    const onBack = vi.fn();
    render(<TopBar title="Detail" onBack={onBack} />);
    const btn = screen.getByLabelText('Kembali');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onBack).toHaveBeenCalled();
  });

  it('hides back button when onBack is not provided', () => {
    render(<TopBar title="Home" />);
    expect(screen.queryByLabelText('Kembali')).not.toBeInTheDocument();
  });

  it('renders right action button', () => {
    const rightAction = vi.fn();
    render(<TopBar title="Page" rightAction={rightAction} rightIcon={<span>🔔</span>} />);
    const btn = screen.getByLabelText('Aksi');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(rightAction).toHaveBeenCalled();
  });

  it('has banner role', () => {
    render(<TopBar title="Test" />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});

// ── Btn ─────────────────────────────────────────────────────────────────────
describe('Btn', () => {
  it('renders children text', () => {
    render(<Btn>Save</Btn>);
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Btn onClick={onClick}>Click Me</Btn>);
    fireEvent.click(screen.getByText('Click Me'));
    expect(onClick).toHaveBeenCalled();
  });

  it('is disabled when disabled prop is true', () => {
    const onClick = vi.fn();
    render(<Btn disabled onClick={onClick}>Disabled</Btn>);
    fireEvent.click(screen.getByText('Disabled'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows loading text when loading', () => {
    render(<Btn loading>Submit</Btn>);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('is disabled during loading', () => {
    const onClick = vi.fn();
    render(<Btn loading onClick={onClick}>Submit</Btn>);
    fireEvent.click(screen.getByText('Loading...'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders icon when provided', () => {
    render(<Btn icon={<span>+</span>}>Add</Btn>);
    expect(screen.getByText('+')).toBeInTheDocument();
  });
});

// ── Input ───────────────────────────────────────────────────────────────────
describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Username" value="" onChange={() => {}} />);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('renders without label', () => {
    const { container } = render(<Input value="" onChange={() => {}} />);
    expect(container.querySelector('input')).toBeInTheDocument();
  });

  it('calls onChange on input', () => {
    const onChange = vi.fn();
    render(<Input value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('displays error message', () => {
    render(<Input value="" onChange={() => {}} error="Required field" />);
    expect(screen.getByText('Required field')).toBeInTheDocument();
  });

  it('sets placeholder', () => {
    render(<Input value="" onChange={() => {}} placeholder="Enter name" />);
    expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument();
  });

  it('sets input type', () => {
    const { container } = render(<Input value="" onChange={() => {}} type="email" />);
    expect(container.querySelector('input').type).toBe('email');
  });
});

// ── Select ──────────────────────────────────────────────────────────────────
describe('Select', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
    { value: 'c', label: 'Charlie' },
  ];

  it('renders with label', () => {
    render(<Select label="Category" value="" onChange={() => {}} options={options} />);
    expect(screen.getByText('Category')).toBeInTheDocument();
  });

  it('renders all options', () => {
    render(<Select value="" onChange={() => {}} options={options} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('shows placeholder option', () => {
    render(<Select value="" onChange={() => {}} options={options} placeholder="Pick one" />);
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('displays error', () => {
    render(<Select value="" onChange={() => {}} options={options} error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});

// ── Textarea ────────────────────────────────────────────────────────────────
describe('Textarea', () => {
  it('renders with label', () => {
    render(<Textarea label="Notes" value="" onChange={() => {}} />);
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('renders textarea element', () => {
    const { container } = render(<Textarea value="" onChange={() => {}} />);
    expect(container.querySelector('textarea')).toBeInTheDocument();
  });

  it('calls onChange', () => {
    const onChange = vi.fn();
    render(<Textarea value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'note' } });
    expect(onChange).toHaveBeenCalled();
  });
});

// ── Badge ───────────────────────────────────────────────────────────────────
describe('Badge', () => {
  it('renders label', () => {
    render(<Badge status="paid" label="Lunas" />);
    expect(screen.getByText('Lunas')).toBeInTheDocument();
  });

  it('renders without crashing for unknown status', () => {
    render(<Badge status="unknown_status" label="Unknown" />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});

// ── Avatar ──────────────────────────────────────────────────────────────────
describe('Avatar', () => {
  it('renders initials', () => {
    render(<Avatar initials="AW" />);
    expect(screen.getByText('AW')).toBeInTheDocument();
  });

  it('applies custom size', () => {
    const { container } = render(<Avatar initials="B" size={60} />);
    const el = container.firstChild;
    expect(el.style.width).toBe('60px');
    expect(el.style.height).toBe('60px');
  });

  it('calls onClick when provided', () => {
    const onClick = vi.fn();
    render(<Avatar initials="X" onClick={onClick} />);
    fireEvent.click(screen.getByText('X'));
    expect(onClick).toHaveBeenCalled();
  });
});

// ── Toast ───────────────────────────────────────────────────────────────────
describe('Toast', () => {
  it('renders message when visible', () => {
    render(<Toast message="Saved!" visible={true} />);
    expect(screen.getByText('Saved!')).toBeInTheDocument();
  });

  it('returns null when not visible', () => {
    const { container } = render(<Toast message="Hidden" visible={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders with different types', () => {
    const { rerender } = render(<Toast message="ok" visible type="success" />);
    expect(screen.getByText('ok')).toBeInTheDocument();
    rerender(<Toast message="err" visible type="error" />);
    expect(screen.getByText('err')).toBeInTheDocument();
  });
});

// ── SearchBar ───────────────────────────────────────────────────────────────
describe('SearchBar', () => {
  it('renders input with placeholder', () => {
    render(<SearchBar value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('Cari...')).toBeInTheDocument();
  });

  it('renders custom placeholder', () => {
    render(<SearchBar value="" onChange={() => {}} placeholder="Cari pelanggan..." />);
    expect(screen.getByPlaceholderText('Cari pelanggan...')).toBeInTheDocument();
  });

  it('calls onChange on input', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('sets the value', () => {
    render(<SearchBar value="hello" onChange={() => {}} />);
    expect(screen.getByRole('searchbox').value).toBe('hello');
  });
});

// ── StatCard ────────────────────────────────────────────────────────────────
describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Revenue" value="Rp 50.000" />);
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('Rp 50.000')).toBeInTheDocument();
  });

  it('renders sub text', () => {
    render(<StatCard label="Orders" value="42" sub="+10%" />);
    expect(screen.getByText('+10%')).toBeInTheDocument();
  });

  it('calls onClick when provided', () => {
    const onClick = vi.fn();
    render(<StatCard label="Click" value="1" onClick={onClick} />);
    fireEvent.click(screen.getByText('Click').closest('div'));
    expect(onClick).toHaveBeenCalled();
  });
});

// ── Chip ────────────────────────────────────────────────────────────────────
describe('Chip', () => {
  it('renders label', () => {
    render(<Chip label="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('calls onClick', () => {
    const onClick = vi.fn();
    render(<Chip label="Filter" onClick={onClick} />);
    fireEvent.click(screen.getByText('Filter'));
    expect(onClick).toHaveBeenCalled();
  });
});

// ── Divider ─────────────────────────────────────────────────────────────────
describe('Divider', () => {
  it('renders a div', () => {
    const { container } = render(<Divider />);
    expect(container.firstChild.tagName).toBe('DIV');
  });
});

// ── EmptyState ──────────────────────────────────────────────────────────────
describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No data" />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<EmptyState title="Empty" subtitle="Try adding items" />);
    expect(screen.getByText('Try adding items')).toBeInTheDocument();
  });

  it('renders action button', () => {
    const action = vi.fn();
    render(<EmptyState title="Empty" action={{ label: "Add Item", onClick: action }} />);
    expect(screen.getByText('Add Item')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Add Item'));
    expect(action).toHaveBeenCalled();
  });
});

// ── BottomSheet ─────────────────────────────────────────────────────────────
describe('BottomSheet', () => {
  it('renders when visible', () => {
    render(<BottomSheet visible={true} onClose={() => {}} title="Options">Content here</BottomSheet>);
    expect(screen.getByText('Options')).toBeInTheDocument();
    expect(screen.getByText('Content here')).toBeInTheDocument();
  });

  it('returns null when not visible', () => {
    const { container } = render(<BottomSheet visible={false} onClose={() => {}} title="Hidden">Nope</BottomSheet>);
    expect(container.innerHTML).toBe('');
  });
});

// ── Modal ───────────────────────────────────────────────────────────────────
describe('Modal', () => {
  it('renders when visible', () => {
    render(<Modal visible={true} onClose={() => {}} title="Confirm">Are you sure?</Modal>);
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('returns null when not visible', () => {
    const { container } = render(<Modal visible={false} onClose={() => {}} title="Hidden">Nope</Modal>);
    expect(container.innerHTML).toBe('');
  });
});

// ── SectionHeader ───────────────────────────────────────────────────────────
describe('SectionHeader', () => {
  it('renders title', () => {
    render(<SectionHeader title="Recent Orders" />);
    expect(screen.getByText('Recent Orders')).toBeInTheDocument();
  });

  it('renders action label', () => {
    const action = vi.fn();
    render(<SectionHeader title="Orders" action={action} actionLabel="View All" />);
    expect(screen.getByText('View All')).toBeInTheDocument();
  });
});
