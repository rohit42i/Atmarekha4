export default function MorePage() {
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
        <button type="button" className="more-page-button" onClick={() => { window.location.hash='community'; }}>
          <span><strong>Community</strong><small>Creator updates and messages from the Atma Rekha community.</small></span>
          <b>→</b>
        </button>
        <button type="button" className="more-page-button" onClick={() => { window.location.hash='info/contact'; }}>
          <span><strong>Contact</strong><small>Questions, feedback and publishing enquiries.</small></span>
          <b>→</b>
        </button>
        <button type="button" className="more-page-button" onClick={() => { window.location.hash='info/report'; }}>
          <span><strong>Report</strong><small>Report content or a site issue.</small></span>
          <b>→</b>
        </button>
        <button type="button" className="more-page-button" onClick={() => { window.location.hash='info/terms'; }}>
          <span><strong>Terms</strong><small>Read the current terms and conditions.</small></span>
          <b>→</b>
        </button>
      </div>
    </section>
  </main>;
}
