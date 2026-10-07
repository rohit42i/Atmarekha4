import React from 'react';
import { ServerErrorPage } from './ErrorPages.jsx';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // This boundary is intentionally reserved for unexpected React render/lifecycle
    // failures. Expected network, auth, reader-access and API errors must be handled
    // by their own screens instead of turning the whole site into a 500.
    console.error('Atma Rekha frontend error:', error, info);
    window.dispatchEvent(new CustomEvent('atma:frontend-error', { detail: { error, info } }));
  }

  render() {
    if (this.state.hasError) {
      return <ServerErrorPage
        onRetry={() => window.location.reload()}
        onHome={() => {
          // A boundary cannot render its children again just because the URL changed.
          // Reload the real home route so the boundary is recreated in a clean state.
          window.location.assign('/');
        }}
      />;
    }
    return this.props.children;
  }
}