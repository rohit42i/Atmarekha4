import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase, getCurrentMembership } from './supabase';

const FREE_CHAPTER_LIMIT = 5;
const MEMBER_PLAN_IDS = new Set(['mini_member', 'supporter', 'premium']);

function isMember(planId) {
  return MEMBER_PLAN_IDS.has(String(planId || '').trim().toLowerCase());
}

export default function ChapterAccessGuard() {
  const [chapters, setChapters] = useState([]);
  const [member, setMember] = useState(false);
  const [lockedChapter, setLockedChapter] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let authSubscription;

    const loadAccess = async (user) => {
      if (!user) {
        if (!cancelled) setMember(false);
        return;
      }
      try {
        const planId = await getCurrentMembership(user.id);
        if (!cancelled) setMember(isMember(planId));
      } catch (_) {
        if (!cancelled) setMember(false);
      }
    };

    const init = async () => {
      const [{ data: chapterRows }, { data: sessionData }] = await Promise.all([
        supabase.from('chapters').select('id,chapter_number,title').order('chapter_number', { ascending: true }),
        supabase.auth.getSession(),
      ]);
      if (cancelled) return;
      setChapters(chapterRows || []);
      await loadAccess(sessionData?.session?.user || null);
      if (!cancelled) setReady(true);
    };

    init();
    const listener = supabase.auth.onAuthStateChange((_event, session) => loadAccess(session?.user || null));
    authSubscription = listener.data?.subscription;

    return () => {
      cancelled = true;
      authSubscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready) return undefined;

    const getChapterFromHash = () => {
      const match = window.location.hash.match(/^#read-chapter\/(.+)$/);
      if (!match) return null;
      const id = decodeURIComponent(match[1]);
      return chapters.find(chapter => String(chapter.id) === String(id)) || null;
    };

    const blockLockedChapter = (chapter) => {
      if (!chapter || Number(chapter.chapter_number) <= FREE_CHAPTER_LIMIT || member) return false;
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#chapters`);
      setLockedChapter(chapter);
      return true;
    };

    const onHashChange = () => blockLockedChapter(getChapterFromHash());
    const onClick = event => {
      const anchor = event.target?.closest?.('a[href*="#read-chapter/"]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      const match = href.match(/#read-chapter\/(.+)$/);
      if (!match) return;
      const chapter = chapters.find(item => String(item.id) === String(decodeURIComponent(match[1])));
      if (blockLockedChapter(chapter)) event.preventDefault();
    };

    document.addEventListener('click', onClick, true);
    window.addEventListener('hashchange', onHashChange);
    onHashChange();

    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [chapters, member, ready]);

  useEffect(() => {
    if (!ready) return undefined;
    const markLocks = () => {
      document.querySelectorAll('.chapter-row').forEach(row => {
        const numberText = row.querySelector('.chapter-row-title span')?.textContent || '';
        const match = numberText.match(/(\d+)/);
        const number = match ? Number(match[1]) : 0;
        if (number <= FREE_CHAPTER_LIMIT) return;
        row.classList.add('chapter-row-locked');
        if (!row.querySelector('.chapter-lock-badge')) {
          const badge = document.createElement('span');
          badge.className = 'chapter-lock-badge';
          badge.innerHTML = '<span aria-hidden="true">🔒</span> Members';
          row.querySelector('.chapter-row-title')?.appendChild(badge);
        }
      });
    };
    markLocks();
    const observer = new MutationObserver(markLocks);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ready]);

  if (!lockedChapter) return null;

  return createPortal(
    <div className="chapter-access-overlay" role="dialog" aria-modal="true" aria-label="Membership required">
      <button className="chapter-access-backdrop" aria-label="Close" onClick={() => setLockedChapter(null)} />
      <section className="chapter-access-modal">
        <button className="chapter-access-close" type="button" onClick={() => setLockedChapter(null)} aria-label="Close">×</button>
        <div className="chapter-access-icon" aria-hidden="true">🦚</div>
        <p className="chapter-access-eyebrow">ATMA REKHA · MEMBERS ONLY</p>
        <h2>Chapter {lockedChapter.chapter_number} is waiting for you.</h2>
        <p className="chapter-access-copy">Chapters 1–5 are free forever. From Chapter 6 onward, membership is required to continue reading.</p>
        <div className="chapter-access-perks">
          <span>✦ Full Chapter 6+ access</span>
          <span>✦ UPI AutoPay membership</span>
          <span>✦ Support Atma Rekha</span>
        </div>
        <button className="chapter-access-cta" type="button" onClick={() => { setLockedChapter(null); window.location.hash = 'membership'; }}>
          Become a Member <span>→</span>
        </button>
        <button className="chapter-access-secondary" type="button" onClick={() => setLockedChapter(null)}>Maybe later</button>
        <p className="chapter-access-note">Choose ₹29 🧸, ₹49 🌸, or ₹99 🦚 per month.</p>
      </section>
    </div>,
    document.body
  );
}
