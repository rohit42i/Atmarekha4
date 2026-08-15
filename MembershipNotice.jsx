import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const END = new Date('2026-12-14T00:00:00+05:30');
export default function MembershipNotice() {
  const [slot, setSlot] = useState(null);
  const [route, setRoute] = useState(window.location.hash.replace(/^#/, '') || 'home');
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('atma-membership-notice-dismissed') === '1');
  useEffect(() => { const hash = () => setRoute(window.location.hash.replace(/^#/, '') || 'home'); window.addEventListener('hashchange', hash); const mount = () => { if (route !== 'home' || dismissed) return; const anchor = document.querySelector('.home-announcement') || document.querySelector('.hero-section') || document.querySelector('main.site-shell'); if (!anchor) return; let node = document.querySelector('.membership-notice-slot'); if (!node) { node = document.createElement('div'); node.className = 'membership-notice-slot'; anchor.parentNode?.insertBefore(node, anchor.nextSibling); } setSlot(node); }; mount(); const observer = new MutationObserver(mount); observer.observe(document.body, { childList: true, subtree: true }); return () => { window.removeEventListener('hashchange', hash); observer.disconnect(); }; }, [route, dismissed]);
  if (!slot || route !== 'home' || dismissed) return null;
  const dismiss = () => { sessionStorage.setItem('atma-membership-notice-dismissed', '1'); setDismissed(true); };
  return createPortal(<section className="membership-notice" aria-label="Free chapters and membership"><button type="button" className="membership-notice-close" onClick={dismiss} aria-label="Dismiss">×</button><div className="membership-notice-mark">🌸</div><div className="membership-notice-copy"><p className="membership-notice-kicker">A NOTE FROM ATMA REKHA</p><h2>Your first 7 chapters are completely free.</h2><p>Read the story without paying. For the first three months after launch, membership is completely optional. If Atma Rekha becomes a story you love, you can join a membership and help us keep creating.</p><button type="button" onClick={() => window.location.hash = 'membership'}>Explore Membership <span>→</span></button><small>Chapters 1–7 stay free forever · Membership starts at ₹29/month</small></div></section>, slot);
}
