import React, { useEffect, useState } from 'react';
import './more-page-pwa.css';

const initialPwaState = () => window.__atmaPwaState || {
  installed: Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true),
  canInstall: false,
  ios: /iphone|ipad|ipod/i.test(window.navigator.userAgent || ''),
};

export default function MorePage() {
  const [pwa, setPwa] = useState(initialPwaState);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const onPwaState = event => setPwa(event.detail || initialPwaState());
    window.addEventListener('atma:pwa-state', onPwaState);
    if (window.__atmaPwaState) setPwa(window.__atmaPwaState);
    return () => window.removeEventListener('atma:pwa-state', onPwaState);
  }, []);

  useEffect(() => {
    if (!showInstallHelp) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') setShowInstallHelp(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showInstallHelp]);

  const handleInstall = async () => {
    setNotice('');
    const result = await window.__atmaPwaInstall?.();
    if (!result || result.status === 'manual') {
      setShowInstallHelp(true);
    } else if (result.status === 'accepted' || result.status === 'installed') {
      setNotice('Atma Rekha is ready as an installed app.');
    }
  };

  return <main className="site-shell more-page">
    <header className="subpage-header">
      <button className="back-button" type="button" onClick={() => { window.location.hash = 'profile'; }} aria-label="Back to profile">←</button>
      <div><p className="header-kicker">PROFILE</p><h1>More</h1></div>
    </header>

    <section className="more-page-content">
      <p className="section-eyebrow">ATMA REKHA</p>
      <h2>More options</h2>
      <p className="more-page-intro">Useful settings and features for your Atma Rekha experience.</p>

      <div className="more-page-list">
        <button type="button" className="more-page-button" onClick={() => { window.location.hash = 'community'; }}>
          <span className="more-page-button-icon" aria-hidden="true">→</span>
          <span><strong>Community</strong><small>Creator updates and messages from the Atma Rekha community.</small></span>
          <b aria-hidden="true">→</b>
        </button>

        <button type="button" className="more-page-button" onClick={() => { window.location.hash = 'group-chat'; }}>
          <span className="more-page-button-icon" aria-hidden="true">💬</span>
          <span><strong>Group Chat</strong><small>Talk with the Atma Rekha community.</small></span>
          <b aria-hidden="true">→</b>
        </button>

        <button type="button" className="more-page-button" onClick={() => { window.location.hash = 'security'; }}>
          <span className="more-page-button-icon" aria-hidden="true">•</span>
          <span><strong>Security</strong><small>Two-step verification and account security.</small></span>
          <b aria-hidden="true">→</b>
        </button>

        <button type="button" className="more-page-button more-page-install-button" onClick={handleInstall} disabled={pwa.installed} aria-describedby="more-page-install-note">
          <span className="more-page-button-icon" aria-hidden="true">↧</span>
          <span><strong>{pwa.installed ? 'App installed' : 'Install App'}</strong><small>{pwa.installed ? 'Atma Rekha is already installed on this device.' : 'Add Atma Rekha to your home screen for a faster, app-like experience.'}</small></span>
          <b aria-hidden="true">{pwa.installed ? '✓' : '→'}</b>
        </button>
      </div>

      <p id="more-page-install-note" className="more-page-notice" role="status" aria-live="polite">{notice}</p>
    </section>

    {showInstallHelp && <div className="more-page-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowInstallHelp(false); }}>
      <section className="more-page-modal" role="dialog" aria-modal="true" aria-labelledby="more-page-modal-title">
        <div className="more-page-modal-header">
          <div><p className="section-eyebrow">ATMA REKHA</p><h2 id="more-page-modal-title">Install the app</h2></div>
          <button type="button" className="more-page-modal-close" onClick={() => setShowInstallHelp(false)} aria-label="Close install instructions">×</button>
        </div>
        {pwa.ios ? <ol>
          <li>Open the browser Share menu.</li>
          <li>Choose <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong> to finish.</li>
        </ol> : <ol>
          <li>Open your browser menu for this site.</li>
          <li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
          <li>Confirm the installation when your browser asks.</li>
        </ol>}
        <p className="more-page-modal-footnote">Once installed, the app loads the latest Atma Rekha website build whenever you are online.</p>
      </section>
    </div>}
  </main>;
}
