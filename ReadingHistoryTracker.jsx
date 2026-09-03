import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

function getChapterIdFromHash() {
  const route = window.location.hash.replace(/^#/, '');
  return route.startsWith('read-chapter/') ? decodeURIComponent(route.slice('read-chapter/'.length)) : null;
}

export default function ReadingHistoryTracker() {
  const userRef = useRef(null);
  const lastSavedRef = useRef('');
  const timerRef = useRef(null);

  useEffect(() => {
    let active = true;

    const save = async (chapterId, pageNumber) => {
      const user = userRef.current;
      if (!active || !user || !chapterId) return;
      const page = Number.isFinite(pageNumber) && pageNumber >= 1 ? pageNumber : 1;
      const key = `${user.id}:${chapterId}:${page}`;
      if (key === lastSavedRef.current) return;
      lastSavedRef.current = key;

      // One row per user (schema UNIQUE user_id): the chapter most recently read.
      const { data: existing, error: findError } = await supabase
        .from('reading_history')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (findError) {
        console.warn('Reading history lookup failed:', findError);
        return;
      }

      if (existing?.id) {
        const { error } = await supabase
          .from('reading_history')
          .update({ chapter_id: chapterId, page_number: page, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) console.warn('Reading history update failed:', error);
      } else {
        const { error } = await supabase
          .from('reading_history')
          .insert({ user_id: user.id, chapter_id: chapterId, page_number: page });
        if (error) console.warn('Reading history insert failed:', error);
      }
    };

    const schedule = (chapterId, pageNumber) => {
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => save(chapterId, pageNumber), 250);
    };

    const onProgress = (event) => {
      const detail = event?.detail || {};
      if (detail.chapterId) schedule(detail.chapterId, detail.pageNumber || 1);
    };

    const onHash = () => {
      lastSavedRef.current = '';
      const chapterId = getChapterIdFromHash();
      if (chapterId) schedule(chapterId, 1);
    };

    window.addEventListener('atma-reading-progress', onProgress);
    window.addEventListener('hashchange', onHash);

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      userRef.current = data?.session?.user || null;
      onHash();
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      userRef.current = session?.user || null;
      lastSavedRef.current = '';
      onHash();
    });

    return () => {
      active = false;
      window.removeEventListener('atma-reading-progress', onProgress);
      window.removeEventListener('hashchange', onHash);
      window.clearTimeout(timerRef.current);
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
