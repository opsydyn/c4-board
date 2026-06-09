import React from "react";

interface AppErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorId: string | null;
  errorMessage: string | null;
  errorStack: string | null;
  componentStack: string | null;
}

const toErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

const toErrorStack = (error: unknown): string | null => error instanceof Error ? (error.stack ?? null) : null;

const initialState: AppErrorBoundaryState = {
  hasError: false,
  errorId: null,
  errorMessage: null,
  errorStack: null,
  componentStack: null,
};

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  override state: AppErrorBoundaryState = initialState;

  static getDerivedStateFromError(error: unknown): Partial<AppErrorBoundaryState> {
    return {
      hasError: true,
      errorId: `ui-${Date.now().toString(36)}`,
      errorMessage: toErrorMessage(error),
      errorStack: toErrorStack(error),
    };
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    const context = {
      errorId: this.state.errorId,
      pathname: typeof window === "undefined" ? "server" : window.location.pathname,
      timestampIso: new Date().toISOString(),
      errorMessage: toErrorMessage(error),
      errorStack: toErrorStack(error),
      componentStack: info.componentStack,
    };
    console.error("UI boundary caught render failure", context);
    this.setState({
      componentStack: info.componentStack ?? null,
    });
  }

  private readonly handleReset = (): void => {
    this.setState(initialState);
  };

  private readonly handleReload = (): void => {
    if (typeof window === "undefined") {
      return;
    }
    window.location.reload();
  };

  override render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "radial-gradient(circle at top, rgba(200,40,40,0.22), rgba(7,10,18,1) 55%)",
          color: "#f6f7fb",
          fontFamily: "\"Fira Code\", \"JetBrains Mono\", monospace",
        }}
      >
        <section
          style={{
            width: "min(960px, 100%)",
            border: "1px solid rgba(255, 90, 90, 0.55)",
            background: "rgba(12, 16, 26, 0.92)",
            padding: "1.25rem",
            boxShadow: "0 24px 80px rgba(0, 0, 0, 0.45)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.2rem", letterSpacing: "0.06em" }}>
            {this.props.title ?? "OPSYDYN // WORKSPACE ERROR"}
          </h1>
          <p style={{ marginTop: "0.5rem", opacity: 0.86 }}>
            {this.props.subtitle
              ?? "The interface hit an unrecoverable render error. You can reset or reload."}
          </p>
          <p style={{ marginTop: "0.75rem", color: "#ff8080" }}>
            {this.state.errorMessage ?? "Unknown render error"}
          </p>
          <p style={{ marginTop: "0.2rem", opacity: 0.8 }}>
            Error ID: {this.state.errorId ?? "unassigned"}
          </p>
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.6rem" }}>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                border: "1px solid rgba(230, 230, 230, 0.45)",
                background: "transparent",
                color: "#ffffff",
                padding: "0.45rem 0.8rem",
                cursor: "pointer",
              }}
            >
              Reset Boundary
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                border: "1px solid rgba(255, 90, 90, 0.8)",
                background: "rgba(255, 70, 70, 0.15)",
                color: "#ffffff",
                padding: "0.45rem 0.8rem",
                cursor: "pointer",
              }}
            >
              Reload Workspace
            </button>
          </div>
          <details style={{ marginTop: "1rem" }}>
            <summary style={{ cursor: "pointer" }}>Diagnostics</summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: "0.76rem",
                lineHeight: 1.45,
                marginTop: "0.5rem",
                opacity: 0.9,
              }}
            >
{`message: ${this.state.errorMessage ?? "n/a"}

stack:
${this.state.errorStack ?? "n/a"}

componentStack:
${this.state.componentStack ?? "n/a"}`}
            </pre>
          </details>
        </section>
      </div>
    );
  }
}
