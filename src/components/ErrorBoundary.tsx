import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'An unexpected error occurred.' };
  }

  override render() {
    if (this.state.hasError) {
      let displayMsg = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && parsed.error) {
          displayMsg = `${parsed.error} (${parsed.operationType || 'operation'} on ${parsed.path || 'database'})`;
        }
      } catch {
        // Keep raw message
      }

      return (
        <div className="min-h-screen bg-[#FAF5EC] text-[#1D0E30] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#E8DEC8] rounded-2xl p-8">
            <p className="text-xs font-medium text-[#B7720A] mb-2">SOHBAT Sanctuary Notice</p>
            <h1 className="text-2xl font-semibold text-[#1D0E30] mb-3">
              Darbar connection interrupted
            </h1>
            <p className="text-sm text-[#4A3B5C] leading-relaxed mb-6 break-words">
              {displayMsg}
            </p>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="px-5 py-2.5 rounded-lg bg-[#1D0E30] text-[#FAF5EC] text-sm font-medium hover:bg-[#2B1547] transition-colors"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
