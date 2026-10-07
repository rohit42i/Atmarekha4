import { useEffect, useState } from 'react';

export default function MorePage() {
  const [available, setAvailable] = useState(() => Boolean(window.__atmaInstallPrompt));
  const [installed, setInstalled] = useState(false);
  const install = async () => {
    const prompt = window.__atmaInstallPrompt;
    if (!prompt) return;
    try {
      prompt.prompt();
      const result = await prompt.userChoice;
      if (result?.outcome === 'accepted') {
        setInstalled(true);
        window.__atmaInstallPrompt = null;
      }
    } catch {}
  };

  useEffect(() => {
    const onAvailable = () => setAvailable(true);
    const onComplete = () => {
      setAvailable(false);
      setInstalled(true);
    };
    window.addEventListener('atma:install-available', onAvailable);
    window.addEventListener('atma:install-complete', onComplete);
    return () => {
      window.removeEventListener('atma:install-available', onAvailable);
      window.removeEventListener('atma:install-complete', onComplete);
    };
  }, []);

  return <main className="site-shell more-page">
    <header className="subpage-header">
      <button className="back-button" type="button" onClick={() => { window.location.hash='profile'; }} aria-label="Back to profile">←</button>
      <div><p className="header-kicker">PROFILE</p><h1>More</h1></div>
    </header>
    <section className="more-page-content">
      <p className="section-eyebrow">ATMA REKHA</p>
      <h2>More options</h2>
      <p className="more-page-intro">Useful settings and features for your Atma Rekha experience.</p>
      <div className="more-page-list">
        <button type="button" className="more-page-button" onClick={install} disabled={!available || installed}>
          <span><strong>{installed ? 'Atma Rekha installed' : 'Install Atma Rekha'}</strong><small>{installed ? 'Atma Rekha is already on your device.' : available ? 'Add Atma Rekha to your home screen for faster access.' : 'Use your browser menu to add Atma Rekha to your home screen.'}</small></span>
          <b>{installed ? '✓' : '→'}</b>
        </button>
      </div>
    </section>
  </main>;
}
