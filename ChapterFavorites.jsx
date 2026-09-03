import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase';

function chapterIdFromTarget(target) {
  const row = target?.closest?.('.chapter-row');
  if (!row) return null;

  const links = Array.from(row.querySelectorAll('a[href]'));
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    const marker = 'read-chapter/';
    const markerIndex = href.indexOf(marker);
    if (markerIndex === -1) continue;

    const rawId = href.slice(markerIndex + marker.length).split(/[?#]/, 1)[0];
    if (!rawId) continue;

    try {
      return decodeURIComponent(rawId);
    } catch {
      return rawId;
    }
  }

  const hash = window.location.hash || '';
  if (hash.startsWith('#read-chapter/')) {
    const rawId = hash.slice('#read-chapter/'.length).split(/[?#]/, 1)[0];
    if (rawId) {
      try {
        return decodeURIComponent(rawId);
      } catch {
        return rawId;
      }
    }
  }

  return null;
}

export default function ChapterFavorites() {
  const [user, setUser] = useState(null);
  const [targets, setTargets] = useState([]);
  const [saved, setSaved] = useState({});
  const [busy, setBusy] = useState({});

  useEffect(() => {
    let frame = 0;
    let retryTimer = 0;

    const scan = () => {
      const next = Array.from(document.querySelectorAll('.chapter-row-actions'))
        .map(target => ({ target, chapterId: chapterIdFromTarget(target) }))
        .filter(item => item.chapterId);

      setTargets(previous => {
        if (previous.length === next.length && previous.every((item, index) => item.target === next[index].target && item.chapterId === next[index].chapterId)) {
          return previous;
        }
        return next;
      });
    };

    const scheduleScan = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        scan();
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(scan, 150);
      });
    };

    scheduleScan();

    const observer = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation => {
        if (mutation.type === 'attributes') return true;
        return !mutation.target?.closest?.('.chapter-favorite-action');
      });
      if (relevant) scheduleScan();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'class']
    });

    window.addEventListener('hashchange', scheduleScan);
    window.addEventListener('resize', scheduleScan);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(retryTimer);
      window.removeEventListener('hashchange', scheduleScan);
      window.removeEventListener('resize', scheduleScan);
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data?.session?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setSaved({}); return; }
    supabase.from('bookmarks').select('chapter_id').eq('user_id', user.id).then(({ data, error }) => {
      if (error) return;
      const next = {};
      (data || []).forEach(row => { next[row.chapter_id] = true; });
      setSaved(next);
    });
  }, [user?.id]);

  const toggle = async chapterId => {
    if (!user) { window.dispatchEvent(new CustomEvent('atma-auth-required', { detail: { type: 'favorite' } })); return; }
    if (busy[chapterId]) return;
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
    } catch (error) { console.error('Favourite update failed:', error); }
    finally { setBusy(previous => ({ ...previous, [chapterId]: false })); }
  };

  return <>{targets.map(({ target, chapterId }) => createPortal(<button key={chapterId} type="button" className={`chapter-favorite-action${saved[chapterId] ? ' is-saved' : ''}`} onClick={event => { event.preventDefault(); event.stopPropagation(); toggle(chapterId); }} disabled={busy[chapterId]} aria-label={saved[chapterId] ? 'Remove from favourites' : 'Add to favourites'} title={saved[chapterId] ? 'Remove from favourites' : 'Add to favourites'}><span>{saved[chapterId] ? '♥' : '♡'}</span><small>{saved[chapterId] ? 'Saved' : 'Favourite'}</small></button>, target, `favorite-${chapterId}`))}</>;
}
