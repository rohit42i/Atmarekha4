import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase';

function currentChapterId() {
  const route = window.location.hash.replace(/^#/, '');
  return route.startsWith('read-chapter/') ? decodeURIComponent(route.slice('read-chapter/'.length)) : null;
}

export default function ReaderBookmark() {
  const [route, setRoute] = useState(() => window.location.hash);
  const [user, setUser] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => { if (active) setUser(data?.user || null); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const chapterId = currentChapterId();
  useEffect(() => {
    let cancelled = false;
    if (!user || !chapterId) { setSaved(false); return undefined; }
    supabase.from('bookmarks').select('id').eq('user_id', user.id).eq('chapter_id', chapterId).maybeSingle().then(({ data }) => { if (!cancelled) setSaved(Boolean(data)); });
    return () => { cancelled = true; };
  }, [user?.id, chapterId, route]);

  const toggle = async () => {
    if (!user || !chapterId || busy) return;
    setBusy(true);
    if (saved) {
      const { error } = await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('chapter_id', chapterId);
      if (!error) setSaved(false);
    } else {
      const { error } = await supabase.from('bookmarks').insert({ user_id: user.id, chapter_id: chapterId });
      if (!error) setSaved(true);
    }
    setBusy(false);
  };

  const target = document.querySelector('.reader-header-inner');
  if (!user || !chapterId || !target) return null;
  return createPortal(<button type="button" className={`reader-bookmark-button${saved ? ' is-saved' : ''}`} onClick={toggle} disabled={busy} aria-label={saved ? 'Remove from favourites' : 'Add to favourites'} title={saved ? 'Remove from favourites' : 'Add to favourites'}><span>{saved ? '♥' : '♡'}</span><small>{saved ? 'Favourite' : 'Favourite'}</small></button>, target);
}
