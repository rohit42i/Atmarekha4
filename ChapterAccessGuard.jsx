import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase, getCurrentMembership } from './supabase';
import { formatChapterLabel } from './chapters';

const FREE_CHAPTER_LIMIT = 5;
const MEMBER_PLAN_IDS = new Set(['mini_member', 'supporter', 'premium']);
const isMember = planId => MEMBER_PLAN_IDS.has(String(planId || '').trim().toLowerCase());

function isLockedChapter(chapter, member) {
  if (!chapter || member) return false;
  const raw = chapter.chapter_number ?? chapter.chapterNumber;
  if (raw === null || raw === undefined || raw === '') return false; // NULL/special = free
  const number = Number(raw);
  return Number.isFinite(number) && number > FREE_CHAPTER_LIMIT;
}

export default function ChapterAccessGuard() {
  const [chapters, setChapters] = useState([]);
  const [member, setMember] = useState(false);
  const [lockedChapter, setLockedChapter] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let authSubscription;
    const loadAccess = async user => {
      if (!user) { if (!cancelled) setMember(false); return; }
      try { const planId = await getCurrentMembership(user.id); if (!cancelled) setMember(isMember(planId)); }
      catch { if (!cancelled) setMember(false); }
    };
    const init = async () => {
      const [{ data: chapterRows, error: chapterError }, { data: sessionData }] = await Promise.all([
        supabase.from('chapters').select('id,chapter_number,title,status').order('chapter_number', { ascending: true, nullsFirst: false }),
        supabase.auth.getSession()
      ]);
      if (cancelled) return;
      if (chapterError) console.error('Chapter access load failed:', chapterError);
      setChapters(chapterRows || []);
      await loadAccess(sessionData?.session?.user || null);
      if (!cancelled) setReady(true);
    };
    init();
    const listener = supabase.auth.onAuthStateChange((_event, session) => loadAccess(session?.user || null));
    authSubscription = listener.data?.subscription;
    return () => { cancelled = true; authSubscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    const getChapterFromHash = () => {
      const match = window.location.hash.match(/^#read-chapter\/(.+)$/);
      if (!match) return null;
      return chapters.find(chapter => String(chapter.id) === String(decodeURIComponent(match[1]))) || null;
    };
    const blockLockedChapter = chapter => {
      if (!isLockedChapter(chapter, member)) return false;
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#chapters`);
      setLockedChapter(chapter);
      return true;
    };
    const onHashChange = () => blockLockedChapter(getChapterFromHash());
    const onClick = event => {
      const anchor = event.target?.closest?.('a[href*="#read-chapter/"]');
      if (!anchor) return;
      const match = (anchor.getAttribute('href') || '').match(/#read-chapter\/(.+)$/);
      if (!match) return;
      const chapter = chapters.find(item => String(item.id) === String(decodeURIComponent(match[1])));
      if (blockLockedChapter(chapter)) event.preventDefault();
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('hashchange', onHashChange);
    onHashChange();
    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener('hashchange', onHashChange); };
  }, [chapters, member, ready]);

  useEffect(() => {
    if (!ready) return undefined;
    const markLocks = () => {
      document.querySelectorAll('.chapter-row').forEach(row => {
        const link = row.querySelector('a.chapter-row-main');
        const href = link?.getAttribute('href') || '';
        const match = href.match(/#read-chapter\/(.+)$/);
        if (!match) return;
        const chapter = chapters.find(item => String(item.id) === String(decodeURIComponent(match[1])));
        if (!isLockedChapter(chapter, member)) {
          row.classList.remove('chapter-row-locked');
          row.querySelector('.chapter-lock-badge')?.remove();
          return;
        }
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
  }, [ready, chapters, member]);

  if (!lockedChapter) return null;
  const label = formatChapterLabel(lockedChapter.chapter_number, { title: lockedChapter.title });
  return createPortal(
    <div className="chapter-access-overlay" role="dialog" aria-modal="true" aria-label="Membership required">
      <button className="chapter-access-backdrop" aria-label="Close" onClick={() => setLockedChapter(null)} />
      <section className="chapter-access-modal">
        <button className="chapter-access-close" type="button" onClick={() => setLockedChapter(null)} aria-label="Close">×</button>
        <div className="chapter-access-icon" aria-hidden="true">🦚</div>
        <p className="chapter-access-eyebrow">ATMA REKHA · MEMBERS ONLY</p>
        <h2>{label} is waiting for you.</h2>
        <p className="chapter-access-copy">Chapters 1–5 are free forever. From Chapter 6 onward, membership is required to continue reading.</p>
        <div className="chapter-access-perks"><span>✦ Full Chapter 6+ access</span><span>✦ UPI AutoPay membership</span><span>✦ Support Atma Rekha</span></div>
        <button className="chapter-access-cta" type="button" onClick={() => { setLockedChapter(null); window.location.hash = 'membership'; }}>Become a Member <span>→</span></button>
        <button className="chapter-access-secondary" type="button" onClick={() => setLockedChapter(null)}>Maybe later</button>
        <p className="chapter-access-note">Choose ₹19, ₹29, or ₹49 per month.</p>
      </section>
    </div>, document.body
  );
}
