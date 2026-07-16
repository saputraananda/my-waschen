// ─────────────────────────────────────────────────────────────────────────────
// KeranjangPanel.jsx — Keranjang belanja di sisi kanan Nota
// Compact, selalu visible di desktop, collapsible di mobile
// ─────────────────────────────────────────────────────────────────────────────
import { C } from '../utils/theme';
import { rp, getCartLineSubtotal } from '../utils/helpers';

export default function KeranjangPanel({
  items,           // notaCart array
  onRemove,        // removeItem(id)
  onToggleExpress, // toggleExpress(id)
  subtotal,        // total harga
  onNext,          // lanjut ke step 3
  canProceed,
  nextLabel = 'Lanjut ke Pembayaran',
  customerName,     // nama customer
  estimateTime,     // estimasi selesai (optional)
}) {
  const itemCount = items.length;

  return (
    <div style={{
      width: 320,
      minWidth: 320,
      background: '#ffffff',
      borderLeft: '1px solid #f0f0f0',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🛒</span>
          <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
            Keranjang
          </span>
          <span style={{
            background: itemCount > 0 ? '#5B005F' : '#e5e5e5',
            color: itemCount > 0 ? 'white' : '#999',
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 999,
          }}>
            {itemCount}
          </span>
        </div>
      </div>

      {/* Customer info */}
      {customerName && (
        <div style={{
          padding: '8px 16px',
          background: '#f3e8f0',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#999' }}>Pelanggan</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: '#5B005F' }}>
            {customerName}
          </div>
        </div>
      )}

      {/* Items list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: '#999' }}>
              Keranjang kosong
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#ccc', marginTop: 4 }}>
              Pilih layanan di sebelah kiri
            </div>
          </div>
        ) : (
          items.map(item => {
            const lineTotal = getCartLineSubtotal(item);
            const isM2 = item.unit === 'm2';

            return (
              <div key={item.id} style={{
                padding: '10px 16px',
                borderBottom: '1px solid #fafafa',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: '#1a1a1a',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {item.name}
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#999', marginTop: 2 }}>
                      {isM2 ? `${item.qty?.toFixed(2)} m²` : `${item.qty}x`}
                      {item.express && (
                        <span style={{ marginLeft: 6, background: '#fef3c7', color: '#92400e', padding: '1px 4px', borderRadius: 4, fontSize: 9, fontWeight: 600 }}>
                          EXPRESS
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>
                      {rp(lineTotal)}
                    </div>
                    <button
                      onClick={() => onRemove(item.id)}
                      style={{
                        width: 22, height: 22, borderRadius: 6,
                        border: '1px solid #fca5a5',
                        background: '#fee2e2',
                        color: '#dc2626',
                        cursor: 'pointer',
                        fontSize: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Express toggle */}
                {item.expressEligible === 1 && (
                  <div style={{ marginTop: 6 }}>
                    <button
                      onClick={() => onToggleExpress(item.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: 'none',
                        background: item.express ? '#fef3c7' : '#f5f5f5',
                        color: item.express ? '#92400e' : '#666',
                        cursor: 'pointer',
                        fontSize: 10,
                        fontFamily: 'Poppins',
                        fontWeight: 600,
                      }}
                    >
                      ⚡ {item.express ? 'EXPRESS' : 'Jadi Express'}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Estimate time */}
      {estimateTime && (
        <div style={{
          padding: '10px 16px',
          background: '#e0f2fe',
          borderTop: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>⏱️</span>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#666' }}>Estimasi Selesai</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: '#0369a1' }}>
              {estimateTime}
            </div>
          </div>
        </div>
      )}

      {/* Footer: total + button */}
      <div style={{
        padding: '12px 16px',
        borderTop: '2px solid #f0f0f0',
        background: '#fafafa',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 10,
        }}>
          <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Total
          </span>
          <span style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: '#5B005F' }}>
            {rp(subtotal)}
          </span>
        </div>
        <button
          onClick={onNext}
          disabled={!canProceed || items.length === 0}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 12,
            border: 'none',
            background: canProceed && items.length > 0 ? '#5B005F' : '#e5e5e5',
            color: canProceed && items.length > 0 ? 'white' : '#999',
            fontFamily: 'Poppins',
            fontSize: 13,
            fontWeight: 700,
            cursor: canProceed && items.length > 0 ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {nextLabel} →
        </button>
      </div>
    </div>
  );
}
