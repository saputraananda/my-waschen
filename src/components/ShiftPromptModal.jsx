/**
 * ShiftPromptModal — tampil saat kasir mau akses halaman keuangan
 * tapi shift belum dibuka / sudah ditutup.
 *
 * Bisa juga di-trigger oleh API error 403 dengan code 'SHIFT_CLOSED'.
 */
import { useState, useEffect } from 'react';
import { C } from '../utils/theme';
import { Btn } from './ui';
import { AnimatePresence, motion } from 'framer-motion';

export default function ShiftPromptModal({ visible, onOpenShift, onClose }) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!visible) { setCountdown(5); return; }
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(15,23,42,0.6)',
              zIndex: 600, // High Priority Modal — above Premium Modal (400), below GlassModal (500)
              backdropFilter: 'blur(4px)',
            }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%', maxWidth: 340,
              background: C.white,
              borderRadius: 24,
              padding: '28px 24px 24px',
              boxShadow: '0 20px 60px rgba(15,23,42,0.25)',
              zIndex: 601, // High Priority Modal content
              textAlign: 'center',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Icon */}
            <div style={{
              width: 72, height: 72,
              borderRadius: 36,
              background: '#FEE2E2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: 36,
            }}>
              ⏰
            </div>

            {/* Title */}
            <div style={{
              fontFamily: 'Poppins',
              fontSize: 18,
              fontWeight: 800,
              color: C.n900,
              marginBottom: 8,
            }}>
              Shift Belum Aktif
            </div>

            {/* Message */}
            <div style={{
              fontFamily: 'Poppins',
              fontSize: 13,
              color: '#3a3a3a',
              lineHeight: 1.6,
              marginBottom: 20,
            }}>
              Kamu harus <strong>membuka shift</strong> terlebih dahulu sebelum bisa melakukan transaksi keuangan.
            </div>

            {/* Action */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onOpenShift}
              style={{
                width: '100%',
                height: 52,
                borderRadius: 14,
                border: 'none',
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                color: 'white',
                fontFamily: 'Poppins',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: `0 8px 20px ${C.primary}40`,
                marginBottom: 10,
              }}
            >
              🚪 Buka Shift Sekarang
            </motion.button>

            {/* Cancel */}
            <button
              onClick={onClose}
              disabled={countdown > 0}
              style={{
                width: '100%',
                height: 40,
                borderRadius: 12,
                border: 'none',
                background: 'transparent',
                color: '#3a3a3a',
                fontFamily: 'Poppins',
                fontSize: 13,
                fontWeight: 600,
                cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                opacity: countdown > 0 ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              Nanti Saja {countdown > 0 ? `(${countdown}s)` : ''}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
