import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { getRenderedChapterId, getSiteRoute, legacyChapterIdFromHash } from './routes';

function routeNow() { return getSiteRoute(); }

export default function ChapterCompletionPrompt() {
  const [route, setRoute] = useState(routeNow);
  const [open, setOpen] = useState(null);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const shown = useRef(new Set());

  useEffect(() => {
    const onLocation = () => setRoute(routeNow());
    window.addEventListener('hashchange', onLocation);
    window.addEventListener('popstate', onLocation);
    return () => { window.removeEventListener('hashchange', onLocation); window.removeEventListener('popstate', onLocation); };
  }, []);

  useEffect(() => {
    if (!route.startsWith('chapter/') && !route.startsWith('read-chapter/')) return undefined;
    let active = true;
    const check = async () => {
      const reader = document.querySelector('.reader-page');
      if (!reader) return;
      const chapterId = reader.getAttribute('data-chapter-id') || getRenderedChapterId() || legacyChapterIdFromHash('#' + route);
      if (!chapterId) return;
      const counter = Array.from(reader.querySelectorAll('span')).find(node => /^Page\s+\d+$/i.test(node.textContent.trim()));
      const totalNode = Array.from(reader.querySelectorAll('span')).find(node => /^of\s+\d+$/i.test(node.textContent.trim()));
      if (!counter || !totalNode) return;
      const current = Number(counter.textContent.match(/\d+/)?.[0]);
      const total = Number(totalNode.textContent.match(/\d+/)?.[0]);
      if (!current || !total || current !== total) return;
      const key = `${chapterId}:${total}`;
      if (shown.current.has(key)) return;
      shown.current.add(key);
      const { data: chapter } = await supabase.from('chapters').select('chapter_number').eq('id', chapterId).maybeSingle();
      const { data: latest } = await supabase.from('chapters').select('chapter_number').eq('status', 'published').order('chapter_number', { ascending: false }).limit(1).maybeSingle();
      if (!active || !chapter) return;
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user || Number(latest?.chapter_number) !== Number(chapter.chapter_number)) setOpen('notifications');
      else setOpen('login');
    };
    const timer = window.setInterval(check, 700);
    check();
    return () => { active = false; window.clearInterval(timer); };
  }, [route]);

  if (!open) return null;
  const enableNotifications = async () => {
    if (notificationBusy) return;
    setNotificationBusy(true);
    setNotificationError('');
    try {
      const enable = window.__atmaRekhaEnableNotifications;
      if (typeof enable !== 'function') {
        throw new Error('Notification setup is unavailable. Refresh the page and try again.');
      }
      const subscription = await enable();
      if (!subscription) {
        setNotificationError('Permission was not granted. Allow notifications for this site in your browser settings, then try again.');
        return;
      }
      localStorage.setItem('atma-notifications-enabled', '1');
      setOpen(null);
    } catch (error) {
      setNotificationError(error?.message || 'Unable to turn on notifications. Please try again.');
    } finally {
      setNotificationBusy(false);
    }
  };
  const goLogin = () => {
    setOpen(null); window.location.hash = 'home';
    window.setTimeout(() => Array.from(document.querySelectorAll('button')).find(node => /sign in/i.test(node.textContent || ''))?.click(), 150);
  };
  const login = open === 'login';
  return <div className="chapter-completion-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(null); }}><section className="chapter-completion-modal" role="dialog" aria-modal="true"><div className="chapter-completion-icon">{login ? '📖' : '🔔'}</div><p className="section-eyebrow">ATMA REKHA</p><h2>{login ? "You've caught up!" : 'Keep up with new chapters'}</h2><p>{login ? 'Log in to keep your reading history, favourites and ratings synced.' : 'Turn on notifications so you can know when a new chapter is uploaded.'}</p>{notificationError && !login && <p className="chapter-completion-error" role="alert" aria-live="assertive">{notificationError}</p>}<div className="chapter-completion-actions">{login ? <><button type="button" className="primary-button" onClick={goLogin}>Log In</button><button type="button" className="chapter-completion-secondary" onClick={() => setOpen(null)}>Not Now</button></> : <><button type="button" className="primary-button" onClick={enableNotifications} disabled={notificationBusy}>{notificationBusy ? 'Turning On…' : 'Turn On Notifications'}</button><button type="button" className="chapter-completion-secondary" onClick={() => setOpen(null)} disabled={notificationBusy}>Not Now</button></>}</div></section></div>;
}
