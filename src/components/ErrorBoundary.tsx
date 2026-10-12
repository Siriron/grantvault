import { Component, type ErrorInfo, type ReactNode } from "react";

type State = { error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("GrantVault render error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="display text-xl font-bold mb-2" style={{ color: "var(--ink)" }}>Something went wrong</h1>
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            The app hit an unexpected error. Your funds are not affected; all state lives on-chain.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-2xl px-6 py-2.5 text-sm font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
