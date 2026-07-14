/**
 * PengajuanBelanjaPage.jsx
 * Unified expense/purchase request page
 * Consolidates: Petty Cash + Kas Operasional + AP Request
 *
 * Features:
 * - Multiple items per request
 * - Auto-approve for ≤ Rp 500.000
 * - Admin approval required for > Rp 500.000
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { rp } from '../../utils/helpers';
import { C, SHADOW } from '../../utils/theme';
import { useResponsive } from '../../utils/hooks';
import { EmptyState } from '../../components/ui';
import {
  ChevronRight,
  RefreshCw,
  Plus,
  X,
  Check,
  Trash2,
  ShoppingCart,
} from 'lucide-react';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7' },
  auto_approved: { label: 'Auto-Approve', color: '#10B981', bg: '#D1FAE5' },
  approved: { label: 'Disetujui', color: '#3B82F6', bg: '#DBEAFE' },
  rejected: { label: 'Ditolak', color: '#EF4444', bg: '#FEE2E2' },
  cancelled: { label: 'Batal', color: '#6B7280', bg: '#F3F4F6' },
};

const AUTO_APPROVE_LIMIT = 500000;

export default function PengajuanBelanjaPage() {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();

  const [pengajuans, setPengajuans] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [filters, setFilters] = useState({
    status: 'all',
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  const [summary, setSummary] = useState({
    statusSummary: [],
    categorySummary: [],
    pendingApprovalCount: 0,
  });

  // Form state - multiple items
  const [form, setForm] = useState({
    items: [{ categoryId: '', itemName: '', qty: 1, unit: 'pcs', estimatedPrice: '' }],
    description: '',
    periodMonth: new Date().getMonth() + 1,
    periodYear: new Date().getFullYear(),
  });

  const loadData = async () => {
    setLoading(true);
    try {
      // Load categories
      const catRes = await axios.get('/api/pengajuan-belanja/categories');
      if (catRes.data.success) {
        setCategories(catRes.data.data);
      }

      // Load pengajuans
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.search) params.set('search', filters.search);

      const res = await axios.get(`/api/pengajuan-belanja?${params.toString()}`);
      setPengajuans(res.data.data || []);

      if (res.data.summary) {
        setSummary(prev => ({ ...prev, statusSummary: res.data.summary || [] }));
      }

      // Load dashboard summary
      const dashRes = await axios.get('/api/pengajuan-belanja/dashboard');
      if (dashRes.data.success) {
        setSummary(prev => ({
          ...prev,
          categorySummary: dashRes.data.data.categorySummary || [],
          pendingApprovalCount: dashRes.data.data.pendingApprovalCount || 0,
        }));
      }
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ status: 'all', dateFrom: '', dateTo: '', search: '' });
  };

  // Calculate total from items
  const calculateTotal = () => {
    return form.items.reduce((sum, item) => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.estimatedPrice) || 0;
      return sum + (qty * price);
    }, 0);
  };

  const needsApproval = calculateTotal() > AUTO_APPROVE_LIMIT;

  // Add new item to form
  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { categoryId: '', itemName: '', qty: 1, unit: 'pcs', estimatedPrice: '' }],
    }));
  };

  // Remove item from form
  const removeItem = (index) => {
    if (form.items.length <= 1) return;
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Update item field
  const updateItem = (index, field, value) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleSubmit = async () => {
    // Validate
    const total = calculateTotal();
    if (total <= 0) {
      alert('Minimal harus ada 1 item dengan harga');
      return;
    }

    const validItems = form.items.filter(item =>
      item.categoryId && item.itemName && parseFloat(item.estimatedPrice) > 0
    );

    if (validItems.length === 0) {
      alert('Lengkapi semua item dengan kategori, nama barang, dan harga');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('/api/pengajuan-belanja', {
        items: form.items.map(item => ({
          categoryId: parseInt(item.categoryId),
          itemName: item.itemName,
          qty: parseFloat(item.qty) || 1,
          unit: item.unit,
          estimatedPrice: parseFloat(item.estimatedPrice),
        })),
        description: form.description,
        periodMonth: form.periodMonth,
        periodYear: form.periodYear,
      });

      if (res.data.success) {
        setShowModal(false);
        setForm({
          items: [{ categoryId: '', itemName: '', qty: 1, unit: 'pcs', estimatedPrice: '' }],
          description: '',
          periodMonth: new Date().getMonth() + 1,
          periodYear: new Date().getFullYear(),
        });
        loadData();
        alert(res.data.message || 'Pengajuan berhasil!');
      } else {
        alert(res.data.message || 'Gagal menyimpan');
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryConfig = (category) => {
    const code = category?.code || category?.category_code || '';
    return {
      uang_makan: { label: 'Biaya Uang Makan', icon: '🍽️', color: '#F59E0B', bg: '#FEF3C7' },
      bbm_transport: { label: 'BBM / Biaya Transport', icon: '🚗', color: '#6366F1', bg: '#EEF2FF' },
      biaya_kantor: { label: 'Biaya Kantor', icon: '📦', color: '#10B981', bg: '#D1FAE5' },
      biaya_lain: { label: 'Biaya Lainnya', icon: '📝', color: '#8B5CF6', bg: '#EDE9FE' },
      lpg: { label: 'Biaya LPG / Gas Alam', icon: '🔥', color: '#F59E0B', bg: '#FEF3C7' },
      galon: { label: 'Biaya Galon Air Mineral', icon: '💧', color: '#3B82F6', bg: '#DBEAFE' },
      listrik: { label: 'Biaya Listrik', icon: '⚡', color: '#FACC15', bg: '#FEF9C3' },
      internet: { label: 'Biaya Internet', icon: '📶', color: '#8B5CF6', bg: '#EDE9FE' },
    }[code] || { label: category?.name || 'Unknown', icon: '📋', color: '#6B7280', bg: '#F3F4F6' };
  };

  const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  // Calculate summary stats
  const stats = useMemo(() => {
    const pending = pengajuans.filter(p => ['pending'].includes(p.status)).length;
    const approved = pengajuans.filter(p => ['approved', 'auto_approved'].includes(p.status)).length;
    const totalAmount = pengajuans.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);
    return { pending, approved, totalAmount };
  }, [pengajuans]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8F4FF', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #6e2e78 0%, #5B005F 100%)',
        padding: 12,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: isMobile ? 10 : 11, color: 'rgba(255,255,255,0.7)' }}>Manajemen Kas</div>
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: 'white' }}>Pengajuan Belanja</div>
          </div>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: isMobile ? 36 : 40, height: isMobile ? 36 : 40, borderRadius: isMobile ? 10 : 12,
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ChevronRight size={isMobile ? 18 : 20} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: isMobile ? 6 : 8,
        padding: isMobile ? 8 : 12,
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          borderRadius: 12,
          padding: isMobile ? 10 : 14,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: isMobile ? 10 : 11, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Pending</div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: 'white' }}>{stats.pending}</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #10B981, #059669)',
          borderRadius: 12,
          padding: isMobile ? 10 : 14,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: isMobile ? 10 : 11, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Disetujui</div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: 'white' }}>{stats.approved}</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #6e2e78, #5B005F)',
          borderRadius: 12,
          padding: isMobile ? 10 : 14,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: isMobile ? 10 : 11, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Total</div>
          <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: 'white' }}>{rp(stats.totalAmount)}</div>
        </div>
      </div>

      {/* Info Banner */}
      <div style={{
        background: 'white',
        margin: `0 ${isMobile ? 8 : 12}px ${isMobile ? 8 : 12}px`,
        borderRadius: 12,
        padding: isMobile ? 10 : 14,
        boxShadow: SHADOW.sm,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
      }}>
        <div style={{
          background: '#EDE9FE',
          borderRadius: 10,
          padding: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: 24 }}>💡</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: '#1F2937' }}>
            ≤ Rp 500.000 auto-approve
          </div>
          <div style={{ fontSize: isMobile ? 10 : 11, color: '#6B7280', marginTop: 2 }}>
            Pengajuan di atas Rp 500.000 memerlukan persetujuan admin
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: 'white',
        margin: `0 ${isMobile ? 8 : 12}px ${isMobile ? 8 : 12}px`,
        borderRadius: 12,
        padding: isMobile ? 10 : 12,
        boxShadow: SHADOW.sm,
        overflowX: 'hidden',
      }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            style={{
              flex: '1 1 100px',
              minWidth: 0,
              width: isMobile ? '100%' : 'auto',
              height: isMobile ? 36 : 40,
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              padding: '0 8px',
              fontSize: isMobile ? 11 : 12,
              background: 'white',
            }}
          >
            <option value="all">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="auto_approved">Auto-Approve</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
          </select>

          <button
            onClick={resetFilters}
            style={{
              width: isMobile ? '100%' : 'auto',
              height: isMobile ? 36 : 40,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              background: 'white',
              fontSize: isMobile ? 11 : 12,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            style={{
              flex: 1,
              minWidth: 100,
              width: isMobile ? 'calc(50% - 4px)' : 'auto',
              height: isMobile ? 36 : 40,
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              padding: '0 8px',
              fontSize: isMobile ? 11 : 12,
            }}
          />
          <span style={{ color: '#9CA3AF', display: 'flex', alignItems: 'center' }}>s/d</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            style={{
              flex: 1,
              minWidth: 100,
              width: isMobile ? 'calc(50% - 4px)' : 'auto',
              height: isMobile ? 36 : 40,
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              padding: '0 8px',
              fontSize: isMobile ? 11 : 12,
            }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `0 ${isMobile ? 8 : 12}px 100px` }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#9CA3AF' }} />
            <div style={{ marginTop: 8, color: '#9CA3AF', fontSize: 12 }}>Memuat...</div>
          </div>
        ) : pengajuans.length === 0 ? (
          <EmptyState
            type="transactions"
            title="Belum ada pengajuan"
            description="Ajukan belanja di sini"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pengajuans.map((item) => {
              const statusCfg = getStatusConfig(item.status);
              const firstItem = item.items?.[0];
              const catCfg = firstItem ? getCategoryConfig(firstItem) : { icon: '📋', color: '#6B7280' };

              return (
                <div
                  key={item.id}
                  style={{
                    background: 'white',
                    borderRadius: 12,
                    padding: 14,
                    boxShadow: SHADOW.sm,
                    borderLeft: `4px solid ${catCfg.color}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 28 }}>{catCfg.icon}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2937' }}>
                          {item.description || 'Pengajuan Belanja'}
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                          {item.request_no} • {item.items?.length || 0} item
                        </div>
                        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
                          {item.requester_name} • {new Date(item.created_at).toLocaleDateString('id-ID')}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1F2937' }}>
                        {rp(parseFloat(item.total_amount))}
                      </div>
                      <div style={{
                        display: 'inline-block',
                        marginTop: 4,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: statusCfg.bg,
                        fontSize: 10,
                        color: statusCfg.color,
                        fontWeight: 600,
                      }}>
                        {statusCfg.label}
                      </div>
                    </div>
                  </div>

                  {/* Items Preview */}
                  {item.items && item.items.length > 1 && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 6 }}>Item lainnya:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {item.items.slice(1).map((subItem, idx) => {
                          const subCat = getCategoryConfig(subItem);
                          return (
                            <div key={idx} style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              background: subCat.bg, padding: '2px 8px', borderRadius: 6,
                            }}>
                              <span style={{ fontSize: 12 }}>{subCat.icon}</span>
                              <span style={{ fontSize: 10, color: subCat.color, fontWeight: 600 }}>
                                {subItem.item_name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowModal(true)}
        style={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          width: 56,
          height: 56,
          borderRadius: 28,
          background: 'linear-gradient(135deg, #6e2e78, #5B005F)',
          border: 'none',
          boxShadow: '0 4px 12px rgba(110, 46, 120, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus size={24} color="white" />
      </button>

      {/* Add Modal */}
      {showModal && (
        <>
          <div
            onClick={() => setShowModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 200,
            }}
          />

          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'white',
            borderRadius: '20px 20px 0 0',
            padding: 20,
            zIndex: 201,
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1F2937' }}>
                <ShoppingCart size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Pengajuan Belanja Baru
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  width: 32, height: 32,
                  borderRadius: 16,
                  background: '#F3F4F6',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={18} color="#6B7280" />
              </button>
            </div>

            {/* Items */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                  Item *
                </label>
                <button
                  onClick={addItem}
                  style={{
                    fontSize: 11,
                    color: '#6e2e78',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Plus size={14} /> Tambah Item
                </button>
              </div>

              {form.items.map((item, index) => {
                const catCfg = getCategoryConfig({ code: categories.find(c => c.id === parseInt(item.categoryId))?.code });

                return (
                  <div key={index} style={{
                    background: '#F9FAFB',
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 8,
                    border: '1px solid #E5E7EB',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>
                        Item {index + 1}
                      </span>
                      {form.items.length > 1 && (
                        <button
                          onClick={() => removeItem(index)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#EF4444',
                            padding: 4,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Category */}
                    <select
                      value={item.categoryId}
                      onChange={(e) => updateItem(index, 'categoryId', e.target.value)}
                      style={{
                        width: '100%',
                        height: 40,
                        borderRadius: 8,
                        border: '1.5px solid #E5E7EB',
                        padding: '0 8px',
                        fontSize: 12,
                        background: 'white',
                        marginBottom: 8,
                      }}
                    >
                      <option value="">Pilih Kategori</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {getCategoryConfig(cat).icon} {cat.name}
                        </option>
                      ))}
                    </select>

                    {/* Item Name */}
                    <input
                      type="text"
                      value={item.itemName}
                      onChange={(e) => updateItem(index, 'itemName', e.target.value)}
                      placeholder="Nama barang"
                      style={{
                        width: '100%',
                        height: 40,
                        borderRadius: 8,
                        border: '1.5px solid #E5E7EB',
                        padding: '0 8px',
                        fontSize: 12,
                        marginBottom: 8,
                      }}
                    />

                    {/* Qty & Price */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => updateItem(index, 'qty', e.target.value)}
                        placeholder="Qty"
                        min="1"
                        style={{
                          width: '100%',
                          height: 40,
                          borderRadius: 8,
                          border: '1.5px solid #E5E7EB',
                          padding: '0 8px',
                          fontSize: 12,
                        }}
                      />
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#6B7280', fontSize: 12 }}>
                          Rp
                        </span>
                        <input
                          type="number"
                          value={item.estimatedPrice}
                          onChange={(e) => updateItem(index, 'estimatedPrice', e.target.value)}
                          placeholder="Harga"
                          style={{
                            width: '100%',
                            height: 40,
                            borderRadius: 8,
                            border: '1.5px solid #E5E7EB',
                            padding: '0 8px 0 32px',
                            fontSize: 12,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total & Approval Info */}
            <div style={{
              background: needsApproval ? '#FEF3C7' : '#D1FAE5',
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>Total Pengajuan</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: needsApproval ? '#D97706' : '#059669' }}>
                  {rp(calculateTotal())}
                </div>
              </div>
              <div style={{
                background: needsApproval ? '#F59E0B' : '#10B981',
                padding: '6px 12px',
                borderRadius: 20,
                color: 'white',
                fontSize: 11,
                fontWeight: 600,
              }}>
                {needsApproval ? '⚠️ Butuh Approve' : '✅ Auto-Approve'}
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8, display: 'block' }}>
                Catatan (opsional)
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Tambahkan catatan jika diperlukan"
                rows={2}
                style={{
                  width: '100%',
                  borderRadius: 10,
                  border: '1.5px solid #E5E7EB',
                  padding: '8px 12px',
                  fontSize: 12,
                  resize: 'none',
                }}
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: '100%',
                height: 52,
                borderRadius: 12,
                background: submitting ? '#D1D5DB' : 'linear-gradient(135deg, #6e2e78, #5B005F)',
                border: 'none',
                color: 'white',
                fontSize: 15,
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Ajukan Belanja
                </>
              )}
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
