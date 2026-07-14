/**
 * GlobalErrorBoundary.jsx — catches render errors across the app.
 * Phase 8: Technical Debt - Enhanced with backend error logging
 *
 * Usage:
 *   import { GlobalErrorBoundary } from './components/ui';
 *
 *   <GlobalErrorBoundary>
 *     <App />
 *   </GlobalErrorBoundary>
 *
 * Shows a recovery UI with "Reload App" button. Sends errors to backend.
 */
import React from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';

/**
 * Send error to backend for tracking
 * @param {Error} error
 * @param {React.ErrorInfo} errorInfo
 */
const logErrorToBackend = async (error, errorInfo) => {
  try {
    await axios.post('/api/errors/log', {
      errorType: error?.constructor?.name || 'Error',
      errorMessage: error?.message || 'Unknown error',
      stackTrace: error?.stack,
      componentStack: errorInfo?.componentStack,
      severity: 'high',
    }, {
      timeout: 5000,
      // Don't wait for response
    });
  } catch (e) {
    // Best effort - don't fail if logging fails
    // Silent fail - error logging to backend optional
  }
};

export class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log to backend for error tracking (console.error removed - errors sent to backend)
    this.setState({ errorInfo });

    // Send to backend for error tracking
    logErrorToBackend(error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: C.n50, padding: 32, fontFamily: 'Poppins',
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: '#FEE2E2', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 40, marginBottom: 20,
          }}>
            💥
          </div>
          <h2 style={{
            fontFamily: 'Poppins', fontSize: 20, fontWeight: 800,
            color: C.n900, marginBottom: 8, textAlign: 'center',
          }}>
            Terjadi Kesalahan
          </h2>
          <p style={{
            fontFamily: 'Poppins', fontSize: 13, color: '#3a3a3a',
            textAlign: 'center', maxWidth: 360, lineHeight: 1.6, marginBottom: 24,
          }}>
            Aplikasi mengalami error yang tidak terduga. Coba muat ulang atau hubungi tim teknis.
          </p>

          {error?.message && (
            <div style={{
              background: '#1E293B', color: '#F8FAFC', borderRadius: 12,
              padding: '12px 16px', marginBottom: 24, maxWidth: 400, width: '100%',
              fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5,
              wordBreak: 'break-word', overflowX: 'auto',
            }}>
              {error.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '12px 24px', borderRadius: 12, border: `1.5px solid ${C.n300}`,
                background: 'white', cursor: 'pointer', fontFamily: 'Poppins',
                fontSize: 14, fontWeight: 600, color: C.n700,
              }}
            >
              Coba Lagi
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: '12px 24px', borderRadius: 12, border: 'none',
                background: C.primary, cursor: 'pointer', fontFamily: 'Poppins',
                fontSize: 14, fontWeight: 700, color: 'white',
              }}
            >
              Muat Ulang App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * createErrorBoundary - Factory to create a named error boundary
 * @param {string} name - Component name for logging
 * @returns {React.Component} Error boundary component
 */
export const createErrorBoundary = (name) => {
  return class NamedErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
      // Errors sent to backend via logErrorToBackend
      logErrorToBackend(error, errorInfo);
    }

    render() {
      if (this.state.hasError) {
        return (
          <div style={{
            padding: 20,
            textAlign: 'center',
            background: '#FEF2F2',
            borderRadius: 12,
            border: '1px solid #FECACA',
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: '#991B1B' }}>
              Error di {name}
            </div>
            <button
              onClick={() => this.setState({ hasError: false })}
              style={{
                marginTop: 12, padding: '8px 16px', borderRadius: 8,
                border: 'none', background: '#DC2626', color: 'white',
                cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12,
              }}
            >
              Retry
            </button>
          </div>
        );
      }
      return this.props.children;
    }
  };
};
