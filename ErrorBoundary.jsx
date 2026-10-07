import React from 'react';

const RECOVERY_KEY = 'atma-recovery-attempt';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Atma Rekha frontend error:', error, info);
    window.dispatchEvent(new CustomEvent('atma:frontend-error', { detail: { error, info } }));
    try {
      if (!sessionStorage.getItem(RECOVERY_KEY)) {
        sessionStorage.setItem(RECOVERY_KEY, '1');
        window.location.assign('/');
      } else {
        sessionStorage.removeItem(RECOVERY_KEY);
      }
    } catch {}
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <main style={{minHeight:'100dvh',display:'grid',placeItems:'center',padding:24,background:'var(--page-bg,#fff)',color:'var(--text-primary,#111)'}}>
      <div style={{textAlign:'center',maxWidth:420}}>
        <h1 style={{margin:0,fontSize:28}}>Atma Rekha</h1>
        <p style={{margin:'12px 0 20px',lineHeight:1.6}}>Please refresh the page to continue.</p>
        <button type="button" className="primary-button" onClick={() => window.location.reload()}>Refresh</button>
      </div>
    </main>;
  }
}
