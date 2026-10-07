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

  componentDidCatch(error) {
    window.dispatchEvent(new CustomEvent('atma:frontend-error', { detail: { error } }));
  }

  render() {
    if (this.state.hasError) {
      return <ServerErrorPage onRetry={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}