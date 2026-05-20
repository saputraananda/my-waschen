// ─────────────────────────────────────────────────────────────────────────────
// QRCode Component — generate QR untuk label produksi & cetak nota
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

/**
 * QR Code component — render QR sebagai inline SVG / canvas.
 *
 * Props:
 * - value: string (data yang di-encode, e.g. transaction_no atau unit_no)
 * - size: number (px, default 96)
 * - level: 'L' | 'M' | 'Q' | 'H' (error correction, default 'M')
 * - margin: number (default 1)
 * - color: { dark, light }
 */
export const QRCodeView = ({ value, size = 96, level = 'M', margin = 1, color, style = {}, alt }) => {
  const canvasRef = useRef(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, String(value), {
      width: size,
      margin,
      errorCorrectionLevel: level,
      color: {
        dark: color?.dark || '#000000',
        light: color?.light || '#FFFFFF',
      },
    }, (err) => {
      if (err) {
        console.warn('[QRCodeView]', err);
        setError(true);
      }
    });
  }, [value, size, level, margin, color]);

  if (!value) return null;
  if (error) {
    return (
      <div style={{
        width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F1F5F9', borderRadius: 4, color: '#94A3B8',
        fontFamily: 'Poppins', fontSize: 9, ...style,
      }}>QR Error</div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: 'block', ...style }}
      aria-label={alt || `QR Code: ${value}`}
    />
  );
};

/**
 * QR Code as data URL (untuk cetak/print yang butuh <img src>)
 */
export async function generateQRDataURL(value, options = {}) {
  if (!value) return null;
  try {
    return await QRCode.toDataURL(String(value), {
      width: options.size || 200,
      margin: options.margin ?? 1,
      errorCorrectionLevel: options.level || 'M',
      color: {
        dark: options.color?.dark || '#000000',
        light: options.color?.light || '#FFFFFF',
      },
    });
  } catch (err) {
    console.warn('[generateQRDataURL]', err);
    return null;
  }
}
