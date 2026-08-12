import { useEffect, useState } from 'react';
import { buildChapters } from './chapters';

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

function ContinueReading() {
  const [item, setItem] = useState(null);
  useEffect(() => {
    const hash = window.location.hash || '#home';
    if (hash !== '#home' && hash !== '') return;
    let cancelled = false;
    buildChapters().then(chapters => {
      if (cancelled) return;
      const published = chapters.filter(ch => String(ch.status || '').toLowerCase() === 'published');
      const saved = published.map(chapter => ({ chapter, page: Number(window.localStorage.getItem(`atma-reading:${chapter.id}`)) }))
        .filter(entry => Number.isInteger(entry.page) && entry.page >= 0)
        .sort((a, b) => Number(b.chapter.chapterNumber) - Number(a.chapter.chapterNumber))[0];
      if (saved) setItem(saved);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  if (!item) return null;
  return <section className="continue-reading-card" aria-label="Continue reading">
    <div><p>CONTINUE READING</p><h2>Chapter {item.chapter.chapterNumber}</h2><span>{item.chapter.title || 'Untitled chapter'} · Page {item.page + 1}</span></div>
    <a href={`#read-chapter/${encodeURIComponent(item.chapter.id)}`}>Continue <span aria-hidden="true">→</span></a>
  </section>;
}

function NotificationToggle() {
  const [enabled, setEnabled] = useState(() => window.localStorage.getItem('atma-chapter-notifications') === 'on');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return undefined;
    let cancelled = false;
    const check = async () => {
      try {
        const chapters = await buildChapters();
        const published = chapters.filter(ch => String(ch.status || '').toLowerCase() === 'published').sort((a, b) => Number(b.chapterNumber) - Number(a.chapterNumber));
        const latest = published[0];
        if (!latest || cancelled) return;
        const key = String(latest.id || latest.chapterNumber);
        const lastSeen = window.localStorage.getItem('atma-last-notified-chapter');
        if (!lastSeen) {
          window.localStorage.setItem('atma-last-notified-chapter', key);
          return;
        }
        if (key !== lastSeen) {
          window.localStorage.setItem('atma-last-notified-chapter', key);
          new Notification(`Atma Rekha · Chapter ${latest.chapterNumber} is here!`, { body: latest.title || 'A new chapter has been published.', icon: '/favicon.png', tag: 'atma-rekha-new-chapter' });
        }
      } catch (_) {}
    };
    check();
    const interval = window.setInterval(check, 5 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [enabled]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (enabled) {
        window.localStorage.setItem('atma-chapter-notifications', 'off');
        setEnabled(false);
        return;
      }
      if (!('Notification' in window)) return;
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission === 'granted') {
        try {
          const chapters = await buildChapters();
          const published = chapters.filter(ch => String(ch.status || '').toLowerCase() === 'published').sort((a, b) => Number(b.chapterNumber) - Number(a.chapterNumber));
          if (published[0]) window.localStorage.setItem('atma-last-notified-chapter', String(published[0].id || published[0].chapterNumber));
        } catch (_) {}
        window.localStorage.setItem('atma-chapter-notifications', 'on');
        setEnabled(true);
      }
    } finally { setBusy(false); }
  };
  return <button type="button" className={`footer-notification-toggle ${enabled ? 'is-on' : ''}`} onClick={toggle} disabled={busy} aria-pressed={enabled} title="Chapter notifications"><span>🔔</span>{enabled ? 'Notifications on' : 'Notify me about new chapters'}</button>;
}

export default function Footer() {
  return (
    <footer className="site-footer">
      <ContinueReading />
      <div className="site-footer-inner">
        <div className="footer-brand-block">
          <a className="footer-brand" href="#home">Atma Rekha</a>
          <p>An original Indian manga story.</p>
        </div>
        <nav className="footer-nav" aria-label="Footer navigation">
          <a href="#info/about">About</a><a href="#info/contact">Contact</a><a href="#info/report">Report</a><a href="#info/privacy">Privacy</a><a href="#info/terms">Terms</a>
        </nav>
        <NotificationToggle />
        <div className="footer-socials" aria-label="Social links">
          {SOCIAL_LINKS.map(item => <a key={item.label} href={item.href} target={item.href.startsWith('mailto:') ? undefined : '_blank'} rel={item.href.startsWith('mailto:') ? undefined : 'noreferrer'} className="footer-social" aria-label={item.label} title={item.label}><SocialIcon type={item.icon} /></a>)}
        </div>
        <div className="footer-bottom" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', textAlign: 'center' }}><span style={{ fontStyle: 'italic', transform: 'skewX(-6deg)', display: 'inline-block' }}>© 2026 Atma Rekha · Made in India 🇮🇳</span></div>
      </div>
    </footer>
  );
}
