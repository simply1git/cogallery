import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { reportError } from '@/lib/observability';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportError(error, { componentStack: errorInfo.componentStack });

    // Auto-recover from PWA chunk mismatch or React Hook mismatch (Error 310)
    if (
      error.message.includes('Minified React error #310') || 
      error.message.includes('Rendered more hooks') ||
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('ChunkLoadError')
    ) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
          for(let registration of registrations) {
            registration.unregister();
          }
        });
      }
      setTimeout(() => window.location.reload(), 1000);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-[#141414] border border-red-500/20 p-8 rounded-2xl max-w-md shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-zinc-400 text-sm mb-8">
              An unexpected error occurred while rendering this view. If the issue persists, please try clearing your browser cache.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-zinc-200 transition-colors shadow-lg"
            >
              <RefreshCcw size={18} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
