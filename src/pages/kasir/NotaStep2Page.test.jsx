import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotaStep2Page from './NotaStep2Page';
import { AppProvider } from '../../context/AppContext';
import axios from 'axios';

// Mock axios
vi.mock('axios');

// Mock AppContext with necessary values
const mockNavigate = vi.fn();
const mockSetNotaCart = vi.fn();

const mockContextValue = {
  navigate: mockNavigate,
  notaCustomer: { id: 1, name: 'Test Customer', deposit: 50000 },
  notaCart: [],
  setNotaCart: mockSetNotaCart,
};

const TestWrapper = ({ children }) => (
  <AppProvider value={mockContextValue}>
    {children}
  </AppProvider>
);

describe('NotaStep2Page - M² Service Length × Width Input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock API responses
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/services')) {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 1,
                name: 'Cuci Karpet',
                unit: 'm2',
                price: 35000,
                category: 'Karpet',
                categoryCode: 'KARPET',
                expressMultiplier: 1.5,
                active: 1,
                requiresMaterial: 1, // Requires material selection
              },
              {
                id: 2,
                name: 'Cuci Gordin',
                unit: 'm2',
                price: 45000,
                category: 'Gordin',
                categoryCode: 'GORDIN',
                expressMultiplier: 1.5,
                active: 1,
                requiresMaterial: 0, // Does not require material
              },
              {
                id: 3,
                name: 'Cuci Kemeja',
                unit: 'pcs',
                price: 8000,
                category: 'Satuan',
                categoryCode: 'SATUAN',
                active: 1,
                requiresMaterial: 1, // Requires material selection
              },
            ],
          },
        });
      } else if (url.includes('/api/master/materials')) {
        return Promise.resolve({
          data: {
            data: [
              { id: 1, name: 'Katun' },
              { id: 2, name: 'Sutra' },
            ],
          },
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('should detect m² services and show measurement button', async () => {
    render(<NotaStep2Page goBack={vi.fn()} />, { wrapper: TestWrapper });

    // Wait for services to load
    await waitFor(() => {
      expect(screen.getByText('Cuci Karpet')).toBeInTheDocument();
    });

    // Should show "per m²" for m² services
    expect(screen.getByText(/per m²/)).toBeInTheDocument();
    
    // Should show measurement badge
    expect(screen.getByText('📐 Ukuran m²')).toBeInTheDocument();
    
    // Should show "Ukur" button for m² service
    expect(screen.getByText('Ukur')).toBeInTheDocument();
  });

  it('should show length and width input fields when Ukur button is clicked', async () => {
    render(<NotaStep2Page goBack={vi.fn()} />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Cuci Karpet')).toBeInTheDocument();
    });

    // Click "Ukur" button
    const ukurButton = screen.getByText('Ukur');
    fireEvent.click(ukurButton);

    // Should show measurement inputs in meters
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/mis\. 2\.5/)).toBeInTheDocument(); // Panjang input (m)
      expect(screen.getByPlaceholderText(/mis\. 1\.5/)).toBeInTheDocument(); // Lebar input (m)
    });

    // Should show labels
    expect(screen.getByText(/Panjang \(m\)/)).toBeInTheDocument();
    expect(screen.getByText(/Lebar \(m\)/)).toBeInTheDocument();
  });

  it('should auto-calculate m² from length × width in meters', async () => {
    render(<NotaStep2Page goBack={vi.fn()} />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Cuci Karpet')).toBeInTheDocument();
    });

    // Click "Ukur" button
    const ukurButton = screen.getByText('Ukur');
    fireEvent.click(ukurButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/mis\. 2\.5/)).toBeInTheDocument();
    });

    // Input length and width in meters
    const panjangInput = screen.getByPlaceholderText(/mis\. 2\.5/);
    const lebarInput = screen.getByPlaceholderText(/mis\. 1\.5/);

    fireEvent.change(panjangInput, { target: { value: '2' } }); // 2 m
    fireEvent.change(lebarInput, { target: { value: '1.5' } }); // 1.5 m

    // Should calculate: 2 * 1.5 = 3.00 m²
    await waitFor(() => {
      expect(screen.getByText(/Luas:/)).toBeInTheDocument();
      expect(screen.getByText(/3\.00 m²/)).toBeInTheDocument();
    });

    // Should show price calculation: 3.00 * 35000 = 105000
    expect(screen.getByText(/Rp 105\.000/)).toBeInTheDocument();
  });

  it('should validate that both fields are filled before enabling add button', async () => {
    render(<NotaStep2Page goBack={vi.fn()} />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Cuci Karpet')).toBeInTheDocument();
    });

    // Click "Ukur" button
    const ukurButton = screen.getByText('Ukur');
    fireEvent.click(ukurButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/mis\. 2\.5/)).toBeInTheDocument();
    });

    // Add button should be disabled initially
    const addButton = screen.getByText(/\+ Tambah/);
    expect(addButton).toBeDisabled();

    // Fill only panjang
    const panjangInput = screen.getByPlaceholderText(/mis\. 2\.5/);
    fireEvent.change(panjangInput, { target: { value: '2' } });

    // Button should still be disabled
    expect(addButton).toBeDisabled();

    // Fill lebar
    const lebarInput = screen.getByPlaceholderText(/mis\. 1\.5/);
    fireEvent.change(lebarInput, { target: { value: '1.5' } });

    // Button should now be enabled
    await waitFor(() => {
      expect(addButton).not.toBeDisabled();
    });
  });

  it('should add m² service to cart with calculated qty', async () => {
    const setNotaCartMock = vi.fn();
    const contextWithCart = {
      ...mockContextValue,
      setNotaCart: setNotaCartMock,
    };

    render(<NotaStep2Page goBack={vi.fn()} />, { 
      wrapper: ({ children }) => (
        <AppProvider value={contextWithCart}>{children}</AppProvider>
      )
    });

    await waitFor(() => {
      expect(screen.getByText('Cuci Karpet')).toBeInTheDocument();
    });

    // Click "Ukur" button
    const ukurButton = screen.getByText('Ukur');
    fireEvent.click(ukurButton);

    // Input dimensions in meters
    const panjangInput = screen.getByPlaceholderText(/mis\. 2\.5/);
    const lebarInput = screen.getByPlaceholderText(/mis\. 1\.5/);

    fireEvent.change(panjangInput, { target: { value: '2' } });
    fireEvent.change(lebarInput, { target: { value: '1.5' } });

    await waitFor(() => {
      expect(screen.getByText(/3\.00 m²/)).toBeInTheDocument();
    });

    // Click add button
    const addButton = screen.getByText(/\+ Tambah/);
    fireEvent.click(addButton);

    // Should call setNotaCart with correct data
    expect(setNotaCartMock).toHaveBeenCalled();
    const callArg = setNotaCartMock.mock.calls[0][0];
    
    // Verify the function would add correct item
    const mockPrev = [];
    const result = callArg(mockPrev);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      name: 'Cuci Karpet',
      qty: 3.00, // 2 * 1.5 = 3.00
      carpetPanjangCm: 200, // 2m converted to cm for backend
      carpetLebarCm: 150, // 1.5m converted to cm for backend
      carpetInputUnit: 'm',
    });
  });

  it('should work for any service with unit m², not just carpet', async () => {
    render(<NotaStep2Page goBack={vi.fn()} />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Cuci Gordin')).toBeInTheDocument();
    });

    // Gordin (curtain) service should also have m² measurement
    const gordinCard = screen.getByText('Cuci Gordin').closest('div');
    
    // Should show "per m²"
    expect(gordinCard).toHaveTextContent(/per m²/);
    
    // Should show measurement badge
    expect(gordinCard).toHaveTextContent('📐 Ukuran m²');
  });

  it('should have proper styling with glassmorphism design', async () => {
    render(<NotaStep2Page goBack={vi.fn()} />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Cuci Karpet')).toBeInTheDocument();
    });

    // Click "Ukur" button
    const ukurButton = screen.getByText('Ukur');
    fireEvent.click(ukurButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/mis\. 2\.5/)).toBeInTheDocument();
    });

    // Check input styling - should match design requirements
    const panjangInput = screen.getByPlaceholderText(/mis\. 2\.5/);
    
    // Verify border radius (10px per design requirements)
    expect(panjangInput.style.borderRadius).toBe('10px');
    
    // Verify height (48px per design requirements)
    expect(panjangInput.style.height).toBe('48px');
    
    // Verify border
    expect(panjangInput.style.border).toContain('1.5px solid');
  });
});

describe('NotaStep2Page - Material Selection Validation (Bug #3 Fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock API responses with requiresMaterial field
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/services')) {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 1,
                name: 'Cuci Karpet',
                unit: 'pcs',
                price: 35000,
                category: 'Satuan',
                categoryCode: 'SATUAN',
                requiresMaterial: 1, // Requires material
                active: 1,
              },
              {
                id: 2,
                name: 'Cuci Kilat',
                unit: 'kg',
                price: 10000,
                category: 'Kiloan',
                categoryCode: 'KILOAN',
                requiresMaterial: 0, // Does not require material
                active: 1,
              },
            ],
          },
        });
      } else if (url.includes('/api/master/materials')) {
        return Promise.resolve({
          data: {
            data: [
              { id: 1, name: 'Katun' },
              { id: 2, name: 'Sutra' },
              { id: 3, name: 'Wol' },
            ],
          },
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('should show material dropdown with red asterisk only for services with requiresMaterial=1', async () => {
    const contextWithCart = {
      ...mockContextValue,
      notaCart: [
        { id: 1, name: 'Cuci Karpet', qty: 1, requiresMaterial: 1 },
      ],
    };

    render(<NotaStep2Page goBack={vi.fn()} />, { 
      wrapper: ({ children }) => (
        <AppProvider value={contextWithCart}>{children}</AppProvider>
      )
    });

    await waitFor(() => {
      expect(screen.getByText('Cuci Karpet')).toBeInTheDocument();
    });

    // Should show "Jenis Bahan *" label with red asterisk
    expect(screen.getByText(/Jenis Bahan/)).toBeInTheDocument();
    
    // Red asterisk should be present
    const labelDiv = screen.getByText(/Jenis Bahan/).parentElement;
    expect(labelDiv).toHaveTextContent('*');
  });

  it('should NOT show material dropdown for services with requiresMaterial=0', async () => {
    const contextWithCart = {
      ...mockContextValue,
      notaCart: [
        { id: 2, name: 'Cuci Kilat', qty: 2, requiresMaterial: 0 },
      ],
    };

    render(<NotaStep2Page goBack={vi.fn()} />, { 
      wrapper: ({ children }) => (
        <AppProvider value={contextWithCart}>{children}</AppProvider>
      )
    });

    await waitFor(() => {
      expect(screen.getByText('Cuci Kilat')).toBeInTheDocument();
    });

    // Should NOT show "Jenis Bahan" label
    expect(screen.queryByText(/Jenis Bahan/)).not.toBeInTheDocument();
  });

  it('should display inline error message when material not selected for required service', async () => {
    const contextWithCart = {
      ...mockContextValue,
      notaCart: [
        { id: 1, name: 'Cuci Karpet', qty: 1, requiresMaterial: 1, materialId: null },
      ],
    };

    render(<NotaStep2Page goBack={vi.fn()} />, { 
      wrapper: ({ children }) => (
        <AppProvider value={contextWithCart}>{children}</AppProvider>
      )
    });

    await waitFor(() => {
      expect(screen.getByText('Cuci Karpet')).toBeInTheDocument();
    });

    // Should show inline error message
    expect(screen.getByText(/Pilih jenis bahan untuk layanan ini/)).toBeInTheDocument();
  });

  it('should disable Next button when material is missing for required services', async () => {
    const contextWithCart = {
      ...mockContextValue,
      notaCart: [
        { id: 1, name: 'Cuci Karpet', qty: 1, requiresMaterial: 1, materialId: null },
      ],
    };

    render(<NotaStep2Page goBack={vi.fn()} />, { 
      wrapper: ({ children }) => (
        <AppProvider value={contextWithCart}>{children}</AppProvider>
      )
    });

    await waitFor(() => {
      expect(screen.getByText('Cuci Karpet')).toBeInTheDocument();
    });

    // Next button should be disabled
    const nextButton = screen.getByText(/Lanjut/);
    expect(nextButton).toBeDisabled();

    // Should show validation error message
    expect(screen.getByText(/1 layanan belum memilih jenis bahan/)).toBeInTheDocument();
  });

  it('should enable Next button when all required materials are selected', async () => {
    const contextWithCart = {
      ...mockContextValue,
      notaCart: [
        { id: 1, name: 'Cuci Karpet', qty: 1, requiresMaterial: 1, materialId: 1 },
      ],
    };

    render(<NotaStep2Page goBack={vi.fn()} />, { 
      wrapper: ({ children }) => (
        <AppProvider value={contextWithCart}>{children}</AppProvider>
      )
    });

    await waitFor(() => {
      expect(screen.getByText('Cuci Karpet')).toBeInTheDocument();
    });

    // Next button should be enabled
    const nextButton = screen.getByText(/Lanjut/);
    expect(nextButton).not.toBeDisabled();

    // Should NOT show validation error message
    expect(screen.queryByText(/layanan belum memilih jenis bahan/)).not.toBeInTheDocument();
  });

  it('should handle mixed cart with required and non-required material services', async () => {
    const contextWithCart = {
      ...mockContextValue,
      notaCart: [
        { id: 1, name: 'Cuci Karpet', qty: 1, requiresMaterial: 1, materialId: 1 },
        { id: 2, name: 'Cuci Kilat', qty: 2, requiresMaterial: 0 },
      ],
    };

    render(<NotaStep2Page goBack={vi.fn()} />, { 
      wrapper: ({ children }) => (
        <AppProvider value={contextWithCart}>{children}</AppProvider>
      )
    });

    await waitFor(() => {
      expect(screen.getByText('Cuci Karpet')).toBeInTheDocument();
    });

    // Next button should be enabled (all required materials selected)
    const nextButton = screen.getByText(/Lanjut/);
    expect(nextButton).not.toBeDisabled();
  });

  it('should show validation error count correctly for multiple missing materials', async () => {
    const contextWithCart = {
      ...mockContextValue,
      notaCart: [
        { id: 1, name: 'Cuci Karpet', qty: 1, requiresMaterial: 1, materialId: null },
        { id: 2, name: 'Cuci Kilat', qty: 2, requiresMaterial: 0 },
        { id: 3, name: 'Cuci Sofa', qty: 1, requiresMaterial: 1, materialId: null },
      ],
    };

    render(<NotaStep2Page goBack={vi.fn()} />, { 
      wrapper: ({ children }) => (
        <AppProvider value={contextWithCart}>{children}</AppProvider>
      )
    });

    await waitFor(() => {
      expect(screen.getByText('Cuci Karpet')).toBeInTheDocument();
    });

    // Should show correct count of missing materials (2)
    expect(screen.getByText(/2 layanan belum memilih jenis bahan/)).toBeInTheDocument();

    // Next button should be disabled
    const nextButton = screen.getByText(/Lanjut/);
    expect(nextButton).toBeDisabled();
  });

  it('should show the same validation in cart modal', async () => {
    const contextWithCart = {
      ...mockContextValue,
      notaCart: [
        { id: 1, name: 'Cuci Karpet', qty: 1, requiresMaterial: 1, materialId: null },
      ],
    };

    render(<NotaStep2Page goBack={vi.fn()} />, { 
      wrapper: ({ children }) => (
        <AppProvider value={contextWithCart}>{children}</AppProvider>
      )
    });

    await waitFor(() => {
      expect(screen.getByText('Cuci Karpet')).toBeInTheDocument();
    });

    // Open cart modal
    const cartTrigger = screen.getByText(/Keranjang/);
    fireEvent.click(cartTrigger);

    await waitFor(() => {
      expect(screen.getByText(/Keranjang Belanja/)).toBeInTheDocument();
    });

    // Should show validation error in modal
    const errorMessages = screen.getAllByText(/1 layanan belum memilih jenis bahan/);
    expect(errorMessages.length).toBeGreaterThan(0);

    // Modal's "Lanjut ke Pembayaran" button should be disabled
    const modalNextButton = screen.getByText(/Lanjut ke Pembayaran/);
    expect(modalNextButton).toBeDisabled();
  });
});
