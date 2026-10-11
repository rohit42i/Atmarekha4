import { Component } from "react";
import { toUserMessage } from "./src/shared/errors/toUserMessage.js";

/**
 * Catches rendering and lifecycle failures so one broken view does not leave
 * the entire document blank. Async work still needs local try/catch handling.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep diagnostics in the developer console; never render a stack trace.
    console.error("Application rendering failed.", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main
        role="alert"
        style={{
          maxWidth: 640,
          margin: "12vh auto",
          padding: "24px",
          color: "var(--text-color, #111)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1>Something went wrong</h1>
        <p>
          {toUserMessage(
            this.state.error,
            "This page could not be displayed. Please reload and try again.",
          )}
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </main>
    );
  }
}
