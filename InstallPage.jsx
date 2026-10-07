import { useEffect, useState } from 'react';

export default function InstallPage() {
  const [available, setAvailable] = useState(() => Boolean(window.__atmaInstallPrompt));
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const onAvailable = () => setAvailable(Boolean(window.__atmaInstallPrompt));
    const onInstalled = () => { setInstalled(true); setAvailable(false); };
    window.addEventListener('atma:install-available', onAvailable);
    window.addEventListener('atma:install-complete', onInstalled);
    return () => {
      window.removeEventListener('atma:install-available', onAvailable);
      window.removeEventListener('atma:install-complete', onInstalled);
    };
  }, []);
  const install = async () => {
    const promptEvent = window.__atmaInstallPrompt;
    if (!promptEvent) return;
    try { await promptEvent.prompt(); await promptEvent.userChoice; }
    catch (error) { console.warn('Install prompt failed:', error); }
    finally { window.__atmaInstallPrompt = null; setAvailable(false); }
  };
  return <main className="info-page install-page">
    <header className="subpage-header info-page-header">
      <button className="back-button" onClick={() => { window.location.hash='profile'; }} aria-label="Back">←</button>
      <div><p className="header-kicker">ATMA REKHA</p><h1>Install Atma Rekha</h1></div>
    </header>
    <section className="info-card about-card install-card">
      <p className="section-eyebrow">APP</p>
      <h2>Keep Atma Rekha close</h2>
      <p className="install-lead">Add Atma Rekha to your home screen for faster access. It works like an app while keeping your reading experience connected to the website.</p>
      {installed ? <div className="install-success" role="status">Atma Rekha has been installed.</div> :
        available ? <button type="button" className="primary-button install-button" onClick={install}>Install Atma Rekha</button> :
        <div className="install-help"><strong>Install from your browser</strong><p>Open your browser menu and choose <b>Add to Home screen</b> or <b>Install app</b>.</p></div>}
    </section>
  </main>;
}
