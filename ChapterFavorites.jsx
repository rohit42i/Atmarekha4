import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase';

function chapterIdFromTarget(target) {
  const link = target?.closest?.('.chapter-row')?.querySelector?.('a[href*="read-chapter/"]');
  if (!link) return null;
  const match = link.getAttribute('href')?.match(/read-chapter\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function ChapterFavorites() {
  const [user, setUser] = useState(null);
  const [targets, setTargets] = useState([]);
  const [saved, setSaved] = useState({});
  const [busy, setBusy] = useState({});

  useEffect(() => {
    const scan = () => {
      const next = Array.from(document.querySelectorAll('.chapter-row-actions')).map(target => ({ target, chapterId: chapterIdFromTarget(target) })).filter(item => item.chapterId);
      setTargets(next);
    };
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hashchange', scan);
    return () => { observer.disconnect(); window.removeEventListener('hashchange', scan); };
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setUser(data?.session?.user || null); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) { setSaved({}); return undefined; }
    supabase.from('bookmarks').select('chapter_id').eq('user_id', user.id).then(({ data, error }) => {
      if (!active || error) return;
      const next = {}; (data || []).forEach(row => { next[row.chapter_id] = true; }); setSaved(next);
    });
    return () => { active = false; };
  }, [user?.id]);

  const toggle = async chapterId => {
    if (!user || busy[chapterId]) return;
    setBusy(previous => ({ ...previous, [chapterId]: true }));
    try {
      if (saved[chapterId]) {
        const { error } = await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('chapter_id', chapterId);
        if (error) throw error;
        setSaved(previous => ({ ...previous, [chapterId]: false }));
      } else {
        const { error } = await supabase.from('bookmarks').insert({ user_id: user.id, chapter_id: chapterId });
        if (error) throw error;
        setSaved(previous => ({ ...previous, [chapterId]: true }));
      }
    } catch (error) {
      console.error('Favourite update failed:', error);
    } finally {
      setBusy(previous => ({ ...previous, [chapterId]: false }));
    }
  };

  if (!user) return null;
  return <>{targets.map(({ target, chapterId }) => createPortal(<button type="button" className={`chapter-favorite-action${saved[chapterId] ? ' is-saved' : ''}`} onClick={event => { event.preventDefault(); event.stopPropagation(); toggle(chapterId); }} disabled={busy[chapterId]} aria-label={saved[chapterId] ? 'Remove from favourites' : 'Add to favourites'} title={saved[chapterId] ? 'Remove from favourites' : 'Add to favourites'}><span>{saved[chapterId] ? '♥' : '♡'}</span><small>{saved[chapterId] ? 'Saved' : 'Favourite'}</small></button>, target))}</>;
}
