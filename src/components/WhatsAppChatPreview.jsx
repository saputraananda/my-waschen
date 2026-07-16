import { useState } from 'react';
import { useResponsive } from '../utils/hooks';
import { C } from '../utils/theme';
import { buildWaMeLink } from '../utils/helpers';

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Chat Template Preview Component
// Used in: Production queue, Transaction detail, Notification preview
// ─────────────────────────────────────────────────────────────────────────────

// Build message from template variables (matches backend whatsappService.js)
export function buildProductionReadyMessage(variables) {
  const {
    customerName,
    transactionNo,
    pickupType = 'pickup',
    pickupScheduleAt = null,
    outletName = 'Outlet Kami',
    outletAddress = '',
    outletPhone = '',
  } = variables;

  const lines = [];

  // Header
  lines.push(`Hai ${customerName}! 👋`);
  lines.push('');
  lines.push('🥳 Pesanan Anda sudah SIAP!');

  if (pickupType === 'delivery') {
    lines.push('');
    lines.push('📋 No. Nota: ' + transactionNo);
    lines.push('🏪 Outlet: ' + outletName);
    if (outletAddress) lines.push('📍 Alamat: ' + outletAddress);
    if (outletPhone) lines.push('📞 Kontak: ' + outletPhone);
    lines.push('');
    lines.push('Kami akan segera mengantarkan pesanan Anda. Mohon bersiap untuk menerima delivery.');
    lines.push('');
    lines.push('Terima kasih sudah percaya pada ' + outletName + '! 🙏');
  } else {
    // Pickup
    if (pickupScheduleAt) {
      const pickupDate = new Date(pickupScheduleAt);
      const timeStr = pickupDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const dateStr = pickupDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
      lines.push('');
      lines.push('📅 Jadwal Ambil: ' + dateStr + ' pukul ' + timeStr);
    }
    lines.push('');
    lines.push('📋 No. Nota: ' + transactionNo);
    lines.push('🏪 Outlet: ' + outletName);
    if (outletAddress) lines.push('📍 Alamat: ' + outletAddress);
    if (outletPhone) lines.push('📞 Kontak: ' + outletPhone);
    lines.push('');
    lines.push('Silakan datang ke outlet kami untuk mengambil pesanan. Jangan lupa membawa nota sebagai bukti pengambilan ya!');
    lines.push('');
    lines.push('Terima kasih sudah percaya pada ' + outletName + '! 🙏');
  }

  return lines.join('\n');
}

// ─── Preview Component ──────────────────────────────────────────────────────
export function WhatsAppChatPreview({ variables, compact = false, onSend }) {
  const { isMobile } = useResponsive();
  const [copied, setCopied] = useState(false);

  const message = buildProductionReadyMessage(variables);
  const waMeUrl = buildWaMeLink(variables?.customerPhone, message);

  const handleCopy = () => {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSend = () => {
    if (onSend) {
      onSend({ message, waMeUrl });
    } else if (waMeUrl) {
      window.open(waMeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Phone display format
  const phoneDisplay = variables?.customerPhone
    ? (() => {
        const p = variables.customerPhone.replace(/\D/g, '');
        if (p.length > 4) {
          return '62' + p.slice(p.startsWith('0') ? 1 : 0);
        }
        return p;
      })()
    : null;

  if (compact) {
    return (
      <div style={{
        background: '#DCF8C6',
        borderRadius: 10,
        padding: '10px 12px',
        maxWidth: 280,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 13,
        lineHeight: 1.4,
        color: '#111',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {message}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      padding: isMobile ? 12 : 16,
    }}>
      {/* Chat bubble preview */}
      <div style={{
        background: '#ECE5DD',
        borderRadius: 12,
        padding: '8px 12px',
        position: 'relative',
        maxWidth: '100%',
      }}>
        {/* WhatsApp header bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
          paddingBottom: 6,
          borderBottom: '1px solid rgba(0,0,0,0.08)',
        }}>
          {/* WhatsApp green circle */}
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            background: '#25D366',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            flexShrink: 0,
          }}>
            ✓
          </div>
          <div>
            <div style={{
              fontFamily: 'Segoe UI, system-ui, sans-serif',
              fontSize: 12,
              fontWeight: 600,
              color: '#111',
            }}>
              Wäschen Laundry
            </div>
            {phoneDisplay && (
              <div style={{
                fontFamily: 'Segoe UI, system-ui, sans-serif',
                fontSize: 10,
                color: '#666',
              }}>
                {phoneDisplay}
              </div>
            )}
          </div>
        </div>

        {/* Message bubble */}
        <div style={{
          background: '#DCF8C6',
          borderRadius: 8,
          borderTopRightRadius: 2,
          padding: '8px 10px',
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: 13,
          lineHeight: 1.5,
          color: '#111',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
        }}>
          {message}
        </div>

        {/* Timestamp */}
        <div style={{
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: 10,
          color: '#999',
          textAlign: 'right',
          marginTop: 4,
        }}>
          {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ✓✓
        </div>
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        gap: 8,
      }}>
        <button
          onClick={handleCopy}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: copied ? '#e8f5e9' : '#f5f5f5',
            border: '1px solid',
            borderColor: copied ? '#4caf50' : '#e0e0e0',
            borderRadius: 8,
            fontFamily: 'Poppins, sans-serif',
            fontSize: 12,
            fontWeight: 500,
            color: copied ? '#2e7d32' : '#555',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {copied ? '✓ Tersalin' : '📋 Salin'}
        </button>
        <button
          onClick={handleSend}
          disabled={!waMeUrl}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: waMeUrl ? '#25D366' : '#e0e0e0',
            border: 'none',
            borderRadius: 8,
            fontFamily: 'Poppins, sans-serif',
            fontSize: 12,
            fontWeight: 500,
            color: waMeUrl ? '#fff' : '#999',
            cursor: waMeUrl ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Kirim WA
        </button>
      </div>

      {/* No phone warning */}
      {!variables?.customerPhone && (
        <div style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 11,
          color: '#ff9800',
          textAlign: 'center',
          background: '#fff3e0',
          padding: '6px 10px',
          borderRadius: 6,
        }}>
          ⚠️ Nomor HP tidak tersedia
        </div>
      )}
    </div>
  );
}

export default WhatsAppChatPreview;
