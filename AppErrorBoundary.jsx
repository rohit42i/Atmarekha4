import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Atma Rekha application error:', error, info);
  }

  reload = () => window.location.reload();

  goHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="app-crash-screen" role="alert" aria-live="assertive">
        <div className="app-crash-card">
          <span className="app-crash-kicker">ATMA REKHA</span>
          <h1>Something went wrong.</h1>
          <p>The site hit an unexpected error. Your account and reading progress are safe.</p>
          <div className="app-crash-actions">
            <button type="button" className="primary-button" onClick={this.reload}>
              Reload
            </button>
            <button type="button" className="secondary-button" onClick={this.goHome}>
              Home
            </button>
          </div>
        </div>
      </main>
    );
  }
}
