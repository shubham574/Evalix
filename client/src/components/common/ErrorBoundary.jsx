import React, { Component } from 'react';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import Button from '../ui/Button';

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
        <div className="min-h-screen flex items-center justify-center bg-bg-canvas p-4">
          <div className="max-w-md w-full bg-bg-surface p-8 rounded-[22px] text-center border-2 border-[#151515] shadow-[0_6px_0_0_#151515]">
            <div className="w-14 h-14 rounded-[14px] bg-[#EF4444]/15 border border-[#EF4444]/30 flex items-center justify-center mx-auto mb-5">
              <FiAlertTriangle className="w-7 h-7 text-[#EF4444]" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#EF4444]/15 text-[#EF4444] font-mono text-[11px] uppercase tracking-widest font-bold">
              Arena Interruption
            </span>
            <h1 className="heading-card text-text-primary mt-2 mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              An unexpected client error occurred while rendering this view. Refreshing the session will restore your workspace.
            </p>
            <Button onClick={this.handleReset} icon={FiRefreshCw} fullWidth>
              Reload Workspace
            </Button>
            {import.meta.env.DEV && this.state.error && (
              <div className="mt-6 text-left bg-[#151515] text-[#F8F5EF] p-3.5 rounded-[12px] overflow-auto max-h-40 border border-[#2E2E2E]">
                <code className="text-[#EF4444] font-mono text-xs">
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
