const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://www.instagram.com/atma.rekha?igsh=MzQ2YWJ3ZW42MzYx', icon: 'instagram' },
  { label: 'YouTube', href: 'https://youtube.com/@atmarekha?si=ytUOmNPrKFtxJUwn', icon: 'youtube' },
  { label: 'Gmail', href: 'mailto:atmarekhasupport@gmail.com', icon: 'mail' },
];

function SocialIcon({ type }) {
  if (type === 'instagram') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="17.4" cy="6.7" r="1" fill="currentColor"/></svg>;
  if (type === 'youtube') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m10 9 5 3-5 3z" fill="currentColor"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg>;
}

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand-block">
          <a className="footer-brand" href="#home">Atma Rekha</a>
          <p>An original Indian manga story.</p>
        </div>

        <nav className="footer-nav" aria-label="Footer navigation">
          <a href="#info/about">About</a>
          <a href="#info/contact">Contact</a>
          <a href="#info/report">Report</a>
          <a href="#info/privacy">Privacy</a>
          <a href="#info/terms">Terms</a>
          <a href="#admin" className="footer-admin-link">Admin Login</a>
        </nav>

        <div className="footer-socials" aria-label="Social links">
          {SOCIAL_LINKS.map(item => (
            <a
              key={item.label}
              href={item.href}
              target={item.href.startsWith('mailto:') ? undefined : '_blank'}
              rel={item.href.startsWith('mailto:') ? undefined : 'noreferrer'}
              className="footer-social"
              aria-label={item.label}
              title={item.label}
            >
              <SocialIcon type={item.icon} />
            </a>
          ))}
        </div>

        <div className="footer-bottom" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', textAlign: 'center' }}>
          <span style={{ fontStyle: 'italic', transform: 'skewX(-6deg)', display: 'inline-block' }}>© 2026 Atma Rekha · Made in India 🇮🇳</span>
        </div>
      </div>
    </footer>
  );
}
