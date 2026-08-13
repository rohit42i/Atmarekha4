import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

function routeNow() { return window.location.hash.replace(/^#/, '') || 'home'; }

export default function ChapterCompletionPrompt() {
  const [route, setRoute] = useState(routeNow);
  const [open, setOpen] = useState(null);
  const shown = useRef(new Set());

  useEffect(() => {
    const onHash = () => setRoute(routeNow());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!route.startsWith('read-chapter/')) return undefined;
    const chapterId = decodeURIComponent(route.slice('read-chapter/'.length));
    let active = true;

    const check = async () => {
      if (!active) return;
      const reader = document.querySelector('.reader-page');
      if (!reader) return;
      const counter = Array.from(reader.querySelectorAll('span')).find(node => /^Page\s+\d+$/i.test(node.textContent.trim()));
      const totalNode = Array.from(reader.querySelectorAll('span')).find(node => /^of\s+\d+$/i.test(node.textContent.trim()));
      if (!counter || !totalNode) return;
      const current = Number(counter.textContent.match(/\d+/)?.[0]);
      const total = Number(totalNode.textContent.match(/\d+/)?.[0]);
      if (!current || !total || current !== total) return;
      const key = `${chapterId}:${total}`;
      if (shown.current.has(key)) return;
      shown.current.add(key);

      const { data: chapter } = await supabase.from('chapters').select('chapter_number,status').eq('id', chapterId).maybeSingle();
      if (!active || !chapter) return;
      const { data: latest } = await supabase.from('chapters').select('chapter_number').eq('status', 'published').order('chapter_number', { ascending: false }).limit(1).maybeSingle();
      if (!active) return;
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        setOpen('notifications');
      } else if (Number(latest?.chapter_number) === Number(chapter.chapter_number)) {
        setOpen('login');
      } else {
        setOpen('notifications');
      }
    };

    const timer = window.setInterval(check, 700);
    check();
    return () => { active = false; window.clearInterval(timer); };
  }, [route]);

  if (!open) return null;

  const enableNotifications = async () => {
    try {
      if (!('Notification' in window)) throw new Error('Notifications are not supported on this device.');
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        localStorage.setItem('atma-notifications-enabled', '1');
      }
    } catch (_) {}
    setOpen(null);
  };

  const goLogin = () => {
    setOpen(null);
    window.location.hash = 'home';
    window.setTimeout(() => {
      const button = Array.from(document.querySelectorAll('button')).find(node => /sign in/i.test(node.textContent || ''));
      button?.click();
    }, 150);
  };

  const isLogin = open === 'login';
  return <div className="chapter-completion-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(null); }}>
    <section className="chapter-completion-modal" role="dialog" aria-modal="true">
      <div className="chapter-completion-icon">{isLogin ? '📖' : '🔔'}</div>
      <p className="section-eyebrow">ATMA REKHA</p>
      <h2>{isLogin ? "You've caught up!" : 'Keep up with new chapters'}</h2>
      <p>{isLogin ? 'Log in to keep your reading history, favourites and ratings synced.' : 'Turn on notifications so you can know when a new chapter is uploaded.'}</p>
      <div className="chapter-completion-actions">
        {isLogin ? <><button type="button" className="primary-button" onClick={goLogin}>Log In</button><button type="button" className="chapter-completion-secondary" onClick={() => setOpen(null)}>Not Now</button></> : <><button type="button" className="primary-button" onClick={enableNotifications}>Turn On Notifications</button><button type="button" className="chapter-completion-secondary" onClick={() => setOpen(null)}>Not Now</button></>}
      </div>
    </section>
  </div>;
}
