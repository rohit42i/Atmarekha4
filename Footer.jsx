const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://www.instagram.com/atma.rekha?igsh=MzQ2YWJ3ZW42MzYx', icon: 'instagram' },
  { label: 'YouTube', href: 'https://youtube.com/@atmarekha?si=ytUOmNPrKFtxJUwn', icon: 'youtube' },
  { label: 'Gmail', href: 'mailto:itsamritanshofficial@gmail.com', icon: 'mail' },
];

function SocialIcon({ type }) {
  if (type === 'instagram') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="17.4" cy="6.7" r="1" fill="currentColor"/></svg>;
  if (type === 'youtube') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m10 9 5 3-5 3z" fill="currentColor"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg>;
}

export default function Footer() {
  return <footer className="site-footer">
    <div className="site-footer-inner">
      <div className="footer-brand">
        <p className="footer-kicker">ATMA REKHA</p>
        <h2>An original Indian manga.</h2>
      </div>

      <nav className="footer-nav" aria-label="Footer navigation">
        <a href="#about">About</a>
        <a href="#contact">Contact</a>
        <a href="#report">Report</a>
      </nav>

      <div className="footer-socials" aria-label="Social links">
        {SOCIAL_LINKS.map(item => <a key={item.label} href={item.href} target={item.href.startsWith('mailto:') ? undefined : '_blank'} rel={item.href.startsWith('mailto:') ? undefined : 'noreferrer'} className="footer-social" aria-label={item.label} title={item.label}><SocialIcon type={item.icon}/></a>)}
      </div>

      <div className="footer-legal">
        <a href="#privacy">Privacy</a>
        <span aria-hidden="true">|</span>
        <a href="#terms">Terms</a>
      </div>

      <div className="footer-bottom">
        <span>© 2026 Atma Rekha</span>
        <span>Made in India 🇮🇳</span>
      </div>
    </div>
  </footer>;
}
