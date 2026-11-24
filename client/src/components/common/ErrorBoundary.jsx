import React, { Component } from 'react';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import Button from '../ui/Button';
import { Aura } from '../studio';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative isolate overflow-hidden min-h-screen flex items-center justify-center bg-bg-canvas p-4">
          <Aura intensity={0.7} />
          <div className="relative max-w-md w-full bg-bg-surface p-8 sm:p-10 rounded-[28px] text-center border border-border-subtle shadow-lg">
            <div className="w-14 h-14 rounded-[18px] bg-danger-bg flex items-center justify-center mx-auto mb-6">
              <FiAlertTriangle className="w-6 h-6 text-danger" />
            </div>
            <span className="inline-flex px-3 py-1 rounded-full bg-danger-bg text-danger font-mono text-[11px] uppercase tracking-[0.14em]">
              Arena Interruption
            </span>
            <h1 className="font-display font-normal text-[28px] leading-tight tracking-[-0.04em] text-text-primary mt-4 mb-3">
              Something went <span className="serif italic text-[#1D9E4B]">wrong</span>
            </h1>
            <p className="text-sm text-text-secondary mb-7 leading-relaxed">
              An unexpected client error occurred while rendering this view. Refreshing the session will restore your workspace.
            </p>
            <Button onClick={this.handleReset} icon={FiRefreshCw} fullWidth>
              Reload Workspace
            </Button>
            {import.meta.env.DEV && this.state.error && (
              <div className="mt-6 text-left bg-bg-elevated p-4 rounded-[14px] overflow-auto max-h-40 border border-border-subtle">
                <code className="text-danger font-mono text-xs break-words">
                  {this.state.error.toString()}
                </code>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
