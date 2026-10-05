import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const COMMANDS = [
  { id: 'home', label: 'Home', hint: 'Go to homepage', icon: '⌂', action: () => navigate('/') },
  { id: 'chapters', label: 'Chapters', hint: 'Browse published chapters', icon: '▤', action: () => navigate('/chapters') },
  { id: 'about', label: 'About Atma Rekha', hint: 'Story, creator and release details', icon: 'i', action: () => navigate('/info/about') },
  { id: 'contact', label: 'Contact', hint: 'Feedback and publishing enquiries', icon: '↗', action: () => navigate('/info/contact') },
  { id: 'community', label: 'Community', hint: 'Open the reader community', icon: '◎', action: () => navigateHash('community') },
  { id: 'profile', label: 'Profile', hint: 'Open your reader profile', icon: '◯', action: () => navigateHash('profile') },
  { id: 'theme', label: 'Toggle theme', hint: 'Switch light / dark mode', icon: '◐', action: () => window.ArTheme?.toggle?.() },
  { id: 'top', label: 'Back to top', hint: 'Return to the top of the page', icon: '↑', action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
];

function navigate(path) {
  const target = path || '/';
  if (window.location.pathname === target && !window.location.hash) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  window.history.pushState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function navigateHash(hash) {
  const next = '#' + hash;
  if (window.location.hash !== next) window.location.hash = hash;
  else window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function getScrollState() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const progress = Math.min(100, Math.max(0, (scrollTop / max) * 100));
  return { progress, showTop: scrollTop > 360 };
}

export default function ExperienceEnhancements() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [scrollState, setScrollState] = useState({ progress: 0, showTop: false });
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return COMMANDS;
    return COMMANDS.filter(command => (command.label + ' ' + command.hint).toLowerCase().includes(needle));
  }, [query]);

  useEffect(() => {
    const onKeyDown = event => {
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        return;
      }
      if (!open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelected(value => filtered.length ? (value + 1) % filtered.length : 0);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelected(value => filtered.length ? (value - 1 + filtered.length) % filtered.length : 0);
        return;
      }
      if (event.key === 'Enter' && filtered[selected]) {
        event.preventDefault();
        const command = filtered[selected];
        setOpen(false);
        window.setTimeout(() => command.action(), 0);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, filtered, selected]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setSelected(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.children[selected]?.scrollIntoView({ block: 'nearest' });
  }, [open, selected]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrollState(getScrollState()));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(
      { reduce: '(prefers-reduced-motion: reduce)', finePointer: '(hover: hover) and (pointer: fine)' },
      context => {
        if (!context.conditions.reduce) {
          const revealTargets = gsap.utils.toArray('.home-page .hero-card, .home-page .home-announcements, .chapter-row, .info-card, .about-card, .legal-card, .profile-v2-card');
          revealTargets.forEach((element, index) => {
            gsap.fromTo(element, { autoAlpha: 0, y: 18 }, {
              autoAlpha: 1, y: 0, duration: 0.58, delay: Math.min(index * 0.025, 0.16), ease: 'power3.out',
              scrollTrigger: { trigger: element, start: 'top 90%', once: true }
            });
          });
        }
        if (context.conditions.finePointer && !context.conditions.reduce) {
          const selector = '.hero-card, .chapter-row, .info-card, .about-card, .legal-card, .profile-v2-card';
          const onPointerMove = event => {
            const card = event.target?.closest?.(selector);
            if (!card) return;
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--ar-spot-x', (event.clientX - rect.left) + 'px');
            card.style.setProperty('--ar-spot-y', (event.clientY - rect.top) + 'px');
          };
          document.addEventListener('pointermove', onPointerMove, { passive: true });
          return () => document.removeEventListener('pointermove', onPointerMove);
        }
        return undefined;
      }
    );
    return () => mm.revert();
  }, []);

  const runCommand = command => {
    setOpen(false);
    window.setTimeout(() => command.action(), 0);
  };

  return (
    <>
      <button type="button" className="ar-experience-trigger" onClick={() => setOpen(true)} aria-label="Open Atma Rekha quick actions" title="Quick actions · Ctrl K">
        <span aria-hidden="true">⌕</span><span>Quick actions</span><kbd>Ctrl K</kbd>
      </button>

      {scrollState.showTop && (
        <button type="button" className="ar-back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top" title="Back to top">
          <span>{Math.round(scrollState.progress)}%</span><strong>↑</strong>
        </button>
      )}

      {open && (
        <div className="ar-command-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="ar-command-palette" role="dialog" aria-modal="true" aria-label="Atma Rekha quick actions">
            <div className="ar-command-search">
              <span aria-hidden="true">⌕</span>
              <input ref={inputRef} value={query} onChange={event => { setQuery(event.target.value); setSelected(0); }} placeholder="Search Atma Rekha…" aria-label="Search quick actions" autoComplete="off" spellCheck="false" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close quick actions">Esc</button>
            </div>
            <div className="ar-command-list" ref={listRef}>
              {filtered.length ? filtered.map((command, index) => (
                <button type="button" key={command.id} className={'ar-command-item ' + (index === selected ? 'is-selected' : '')} onMouseEnter={() => setSelected(index)} onClick={() => runCommand(command)}>
                  <span className="ar-command-icon" aria-hidden="true">{command.icon}</span>
                  <span className="ar-command-copy"><strong>{command.label}</strong><small>{command.hint}</small></span>
                  {index === selected && <span className="ar-command-enter">↵</span>}
                </button>
              )) : <div className="ar-command-empty">No matching actions.</div>}
            </div>
            <footer className="ar-command-footer"><span>↑↓ navigate</span><span>↵ open</span><span>Esc close</span></footer>
          </section>
        </div>
      )}
    </>
  );
}
