/**
 * DailyReportPage.jsx
 * Halaman Auto Daily Report untuk WhatsApp
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { useResponsive, useWindowSize } from '../../utils/hooks';
import { buildWaMeLink } from '../../utils/helpers';
import {
  ChevronRight,
  RefreshCw,
  Send,
  Calendar,
  MessageCircle,
  Copy,
  Check,
} from 'lucide-react';

export default function DailyReportPage() {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const { width } = useWindowSize();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [copied, setCopied] = useState(false);

  // Form
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');

  // Load report
  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/daily-reports/generate?date=${date}`);
      if (res.data.success) {
        setReportData(res.data.data);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [date]);

  // Copy to clipboard
  const handleCopy = () => {
    if (reportData?.content) {
      navigator.clipboard.writeText(reportData.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Send via WhatsApp
  const handleSendWA = () => {
    if (!recipientPhone) {
      alert('Masukkan nomor WhatsApp');
      return;
    }

    if (reportData?.content) {
      const waLink = buildWaMeLink(recipientPhone, reportData.content);
      if (waLink) window.open(waLink, '_blank', 'noopener,noreferrer');
    }
  };

  // Generate shareable link
  const getWALink = () => {
    if (!recipientPhone || !reportData?.content) return null;
    return buildWaMeLink(recipientPhone, reportData.content);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8F4FF', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
        padding: 12,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: isMobile ? 10 : 11, color: 'rgba(255,255,255,0.7)' }}>Manajemen</div>
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: 'white' }}>
              Laporan Harian
            </div>
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

      {/* Date Selector */}
      <div style={{
        background: 'white',
        margin: isMobile ? 8 : 12,
        borderRadius: 12,
        padding: isMobile ? 10 : 12,
        boxShadow: SHADOW.sm,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Calendar size={18} color="#6B7280" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              flex: 1,
              minWidth: 0,
              width: isMobile ? 'calc(100% - 60px)' : 'auto',
              height: isMobile ? 40 : 40,
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              padding: '0 8px',
              fontSize: isMobile ? 12 : 14,
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={loadReport}
            disabled={loading}
            style={{
              height: isMobile ? 36 : 40,
              padding: '0 12px',
              borderRadius: 8,
              background: '#059669',
              border: 'none',
              color: 'white',
              fontSize: isMobile ? 11 : 12,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            <span style={{ display: isMobile ? 'none' : 'inline' }}>Refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#9CA3AF' }} />
          <div style={{ marginTop: 8, color: '#9CA3AF', fontSize: 12 }}>Memuat laporan...</div>
        </div>
      ) : reportData ? (
        <>
          {/* Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: isMobile ? 6 : 8,
            padding: `0 ${isMobile ? 8 : 12}px ${isMobile ? 8 : 12}px`,
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #059669, #047857)',
              borderRadius: 12,
              padding: isMobile ? 12 : 16,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: isMobile ? 10 : 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Total Penjualan</div>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: 'white' }}>
                Rp {reportData.formatted?.total_sales || '0'}
              </div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
              borderRadius: 12,
              padding: isMobile ? 12 : 16,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: isMobile ? 10 : 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Transaksi</div>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: 'white' }}>
                {reportData.formatted?.total_count || 0} nota
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div style={{
            background: 'white',
            margin: `0 ${isMobile ? 8 : 12}px ${isMobile ? 8 : 12}px`,
            borderRadius: 12,
            padding: isMobile ? 12 : 16,
            boxShadow: SHADOW.sm,
          }}>
            <h3 style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: '#1F2937', marginBottom: 12 }}>
              💵 Ringkasan Pembayaran
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#6B7280' }}>💵 Tunai</span>
                <span style={{ fontWeight: 600 }}>Rp {reportData.formatted?.cash_amount || '0'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#6B7280' }}>📱 Non Tunai</span>
                <span style={{ fontWeight: 600 }}>Rp {reportData.formatted?.non_cash_amount || '0'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#6B7280' }}>💳 QRIS</span>
                <span style={{ fontWeight: 600 }}>Rp {reportData.formatted?.qris_amount || '0'}</span>
              </div>
            </div>
          </div>

          {/* Expenses Summary */}
          <div style={{
            background: 'white',
            margin: `0 ${isMobile ? 8 : 12}px ${isMobile ? 8 : 12}px`,
            borderRadius: 12,
            padding: isMobile ? 12 : 16,
            boxShadow: SHADOW.sm,
          }}>
            <h3 style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: '#1F2937', marginBottom: 12 }}>
              📤 Ringkasan Pengeluaran
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#6B7280' }}>🍽️ Biaya Makan</span>
                <span style={{ fontWeight: 600 }}>Rp {reportData.formatted?.makan_amount || '0'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#6B7280' }}>🚗 Transport</span>
                <span style={{ fontWeight: 600 }}>Rp {reportData.formatted?.transport_amount || '0'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#6B7280' }}>📦 Biaya Kantor</span>
                <span style={{ fontWeight: 600 }}>Rp {reportData.formatted?.kantor_amount || '0'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#6B7280' }}>📝 Biaya Lain</span>
                <span style={{ fontWeight: 600 }}>Rp {reportData.formatted?.lain_amount || '0'}</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                paddingTop: 8, borderTop: '1px solid #E5E7EB',
                fontSize: 13, fontWeight: 600,
              }}>
                <span>💸 Total</span>
                <span style={{ color: '#DC2626' }}>Rp {reportData.formatted?.total_expense || '0'}</span>
              </div>
            </div>
          </div>

          {/* Transaction Summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: isMobile ? 6 : 8,
            padding: `0 ${isMobile ? 8 : 12}px ${isMobile ? 8 : 12}px`,
          }}>
            <div style={{
              background: 'white',
              borderRadius: 12,
              padding: isMobile ? 10 : 12,
              textAlign: 'center',
              boxShadow: SHADOW.sm,
            }}>
              <div style={{ fontSize: isMobile ? 9 : 10, color: '#6B7280', marginBottom: 4 }}>✅ Lunas</div>
              <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: '#10B981' }}>
                {reportData.formatted?.lunas_count || 0}
              </div>
            </div>
            <div style={{
              background: 'white',
              borderRadius: 12,
              padding: isMobile ? 10 : 12,
              textAlign: 'center',
              boxShadow: SHADOW.sm,
            }}>
              <div style={{ fontSize: isMobile ? 9 : 10, color: '#6B7280', marginBottom: 4 }}>⏳ Belum Lunas</div>
              <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: '#F59E0B' }}>
                {reportData.formatted?.unpaid_count || 0}
              </div>
            </div>
          </div>

          {/* Report Preview */}
          <div style={{
            background: 'white',
            margin: `0 ${isMobile ? 8 : 12}px ${isMobile ? 8 : 12}px`,
            borderRadius: 12,
            padding: isMobile ? 12 : 16,
            boxShadow: SHADOW.sm,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: '#1F2937' }}>
                📋 Preview Laporan
              </h3>
              <button
                onClick={handleCopy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: copied ? '#D1FAE5' : '#F3F4F6',
                  border: 'none',
                  fontSize: 12,
                  color: copied ? '#059669' : '#6B7280',
                  cursor: 'pointer',
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Tersalin!' : 'Copy'}
              </button>
            </div>
            <div style={{
              background: '#F9FAFB',
              borderRadius: 8,
              padding: 12,
              fontSize: 11,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              maxHeight: 300,
              overflowY: 'auto',
            }}>
              {reportData.content}
            </div>
          </div>

          {/* WhatsApp Form */}
          <div style={{
            background: 'white',
            margin: `0 ${isMobile ? 8 : 12}px ${isMobile ? 16 : 24}px`,
            borderRadius: 12,
            padding: isMobile ? 12 : 16,
            boxShadow: SHADOW.sm,
          }}>
            <h3 style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: '#1F2937', marginBottom: 12 }}>
              📱 Kirim via WhatsApp
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 12 }}>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Nama Penerima (opsional)"
                style={{
                  width: '100%',
                  minWidth: 0,
                  height: isMobile ? 40 : 44,
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
                  padding: '0 12px',
                  fontSize: isMobile ? 12 : 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                style={{
                  width: '100%',
                  minWidth: 0,
                  height: isMobile ? 40 : 44,
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
                  padding: '0 12px',
                  fontSize: isMobile ? 12 : 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <a
                href={getWALink()}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  height: isMobile ? 44 : 48,
                  borderRadius: 10,
                  background: recipientPhone ? '#25D366' : '#D1D5DB',
                  textDecoration: 'none',
                  color: 'white',
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  cursor: recipientPhone ? 'pointer' : 'not-allowed',
                }}
                onClick={(e) => {
                  if (!recipientPhone) {
                    e.preventDefault();
                    alert('Masukkan nomor WhatsApp terlebih dahulu');
                  }
                }}
              >
                <MessageCircle size={isMobile ? 16 : 18} />
                Kirim Laporan via WhatsApp
              </a>
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
          Gagal memuat laporan
        </div>
      )}

      {/* Spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
