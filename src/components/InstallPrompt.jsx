/**
 * InstallPrompt Component
 * PWA Install Banner with glassmorphism effect
 *
 * @description
 * Shows a dismissible banner prompting users to install the app
 * to their home screen. Uses beforeinstallprompt event.
 *
 * @example
 * <InstallPrompt />
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';

const INSTALL_STORAGE_KEY = 'waschen_install_prompt_dismissed';

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if previously dismissed
    const dismissed = localStorage.getItem(INSTALL_STORAGE_KEY);
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstall = (e) => {
      // Prevent Chrome's default prompt
      e.preventDefault();
      // Store event for later use
      setDeferredPrompt(e);
      // Show prompt after a short delay
      setTimeout(() => setIsVisible(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for user's choice
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response: ${outcome}`);

    // Clear the prompt
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    // Remember dismissal for this session
    localStorage.setItem(INSTALL_STORAGE_KEY, 'true');
    setIsDismissed(true);
    setIsVisible(false);
  };

  // Don't render if:
  // - Already dismissed
  // - No install prompt available
  // - Not visible
  if (isDismissed || !deferredPrompt || !isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            padding: '12px 16px',
            paddingTop: 'max(12px, env(safe-area-inset-top))',
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 16,
              border: '1px solid rgba(255, 255, 255, 0.6)',
              boxShadow: '0 8px 32px rgba(110, 46, 120, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {/* App Icon */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(145deg, #6e2e78, #5B005F)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(110, 46, 120, 0.3)',
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 'bold', color: '#fff' }}>W</span>
            </div>

            {/* Text Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#111827',
                  lineHeight: 1.3,
                }}
              >
                Pasang Wäschen di Homescreen
              </div>
              <div
                style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: 12,
                  color: '#6B7280',
                  lineHeight: 1.4,
                  marginTop: 2,
                }}
              >
                Akses cepat & tampil seperti aplikasi
              </div>
            </div>

            {/* Install Button */}
            <button
              onClick={handleInstall}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(145deg, #6e2e78, #5B005F)',
                color: '#fff',
                fontFamily: 'Poppins, sans-serif',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(110, 46, 120, 0.25)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(110, 46, 120, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(110, 46, 120, 0.25)';
              }}
            >
              <Download size={14} />
              Pasang
            </button>

            {/* Dismiss Button */}
            <button
              onClick={handleDismiss}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                border: 'none',
                background: 'rgba(0, 0, 0, 0.04)',
                color: '#6B7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
              }}
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InstallPrompt;
