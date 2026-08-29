import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

function getChapterId() {
  const route = window.location.hash.replace(/^#/, '');
  return route.startsWith('read-chapter/') ? decodeURIComponent(route.slice('read-chapter/'.length)) : null;
}

export default function ReadingHistoryTracker() {
  const userRef = useRef(null);
  const lastSavedRef = useRef('');
  const timerRef = useRef(null);

  useEffect(() => {
    let active = true;
    const save = async () => {
      const user = userRef.current;
      const chapterId = getChapterId();
      if (!active || !user || !chapterId) return;
      const pill = document.querySelector('.reader-page-pill');
      const text = pill?.textContent || '';
      const match = text.match(/(\d+)\s*\/\s*(\d+)/);
      const pageNumber = match ? Number(match[1]) : 1;
      if (!Number.isFinite(pageNumber) || pageNumber < 1) return;
      const key = `${user.id}:${chapterId}:${pageNumber}`;
      if (key === lastSavedRef.current) return;
      lastSavedRef.current = key;

      const { data: existing, error: findError } = await supabase
        .from('reading_history')
        .select('id')
        .eq('user_id', user.id)
        .eq('chapter_id', chapterId)
        .maybeSingle();
      if (findError) { console.warn('Reading history lookup failed:', findError); return; }

      if (existing?.id) {
        const { error } = await supabase
          .from('reading_history')
          .update({ page_number: pageNumber, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) { console.warn('Reading history update failed:', error); return; }
      } else {
        const { error } = await supabase
          .from('reading_history')
          .insert({ user_id: user.id, chapter_id: chapterId, page_number: pageNumber });
        if (error) { console.warn('Reading history insert failed:', error); return; }
      }

      // Keep only the user's latest/last-read chapter in reading history.
      const { error: cleanupError } = await supabase
        .from('reading_history')
        .delete()
        .eq('user_id', user.id)
        .neq('chapter_id', chapterId);
      if (cleanupError) console.warn('Reading history cleanup failed:', cleanupError);
    };
    const schedule = () => { window.clearTimeout(timerRef.current); timerRef.current = window.setTimeout(save, 250); };
    const onHash = () => { lastSavedRef.current = ''; schedule(); };
    window.addEventListener('hashchange', onHash);
    supabase.auth.getSession().then(({ data }) => { if (active) { userRef.current = data?.session?.user || null; schedule(); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { userRef.current = session?.user || null; lastSavedRef.current = ''; schedule(); });
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule();
    return () => { active = false; window.removeEventListener('hashchange', onHash); window.clearTimeout(timerRef.current); observer.disconnect(); listener.subscription.unsubscribe(); };
  }, []);
  return null;
}
