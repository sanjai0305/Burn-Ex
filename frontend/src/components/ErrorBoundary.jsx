/**
 * src/components/ErrorBoundary.jsx
 * Burn-Ex — Global React Error Boundary Component
 * 
 * Catches unhandled React rendering errors, prevents blank white screens,
 * logs detailed diagnostics to console, and provides recovery action buttons.
 */

import React from 'react';
import { ShieldAlert, RefreshCw, RotateCcw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[BX ErrorBoundary Caught]', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  getFormattedErrorMessage = () => {
    const err = this.state.error;
    if (!err) return 'An unexpected UI error occurred.';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message || err.toString();
    if (typeof err === 'object') {
      try {
        if (err.msg) return String(err.msg);
        if (err.message) return String(err.message);
        return JSON.stringify(err);
      } catch (e) {
        return 'Object error (unable to stringify)';
      }
    }
    return String(err);
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.getFormattedErrorMessage();

      return (
        <div className="min-h-screen bg-[#F7F8FF] flex items-center justify-center p-4 font-sans text-[#10183F] select-none">
          <div className="w-full max-w-md bg-white border border-[#E6E8F5] rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 text-center">
            
            <div className="w-14 h-14 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mx-auto text-red-500 shadow-sm">
              <ShieldAlert size={28} />
            </div>

            <div>
              <h1 className="text-xl font-black tracking-tight text-[#10183F]">Something Went Wrong</h1>
              <p className="text-[#66729B] text-xs mt-1.5 font-medium leading-relaxed">
                Burn-Ex caught an unexpected UI rendering error. Your entered data is preserved where possible.
              </p>
            </div>

            {/* Error Message Snippet */}
            <div className="bg-[#F7F8FF] p-3.5 rounded-2xl border border-[#E6E8F5] text-left font-mono text-[11px] text-red-600 overflow-x-auto max-h-32">
              <strong className="block break-words">{errorMessage}</strong>
              {this.state.errorInfo?.componentStack && (
                <pre className="text-[10px] text-[#66729B] mt-2 whitespace-pre-wrap font-mono">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-[#6345FF] to-[#8B5CF6] hover:from-[#5235E8] hover:to-[#7C3AED] text-white font-bold text-xs rounded-xl shadow-md shadow-[#6345FF]/20 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <RotateCcw size={14} />
                Try Again
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 bg-[#F7F8FF] hover:bg-[#EEF0FF] text-[#10183F] font-bold text-xs rounded-xl border border-[#E6E8F5] transition active:scale-95 flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} />
                Reload
              </button>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
