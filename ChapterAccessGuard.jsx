import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase, getCurrentMembership } from "./supabase";
import { formatChapterLabel } from "./chapters";
import {
  findChapterForPath,
  isChapterPath,
  legacyChapterIdFromHash,
} from "./routes";
import { getAdminRole } from "./src/features/auth/adminAuthorizationService.js";
import {
  hasAtmaMembershipAccess,
  requiresAtmaMembership,
} from "./src/features/membership/membershipDomain.js";

function isLockedChapter(chapter, member) {
  return Boolean(chapter && !member && requiresAtmaMembership(chapter));
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
        const [planId, role] = await Promise.all([
          getCurrentMembership(user.id),
          getAdminRole(user.id),
        ]);
        if (!cancelled) setMember(hasAtmaMembershipAccess(planId, role));
      } catch (error) {
        console.error("Chapter access lookup failed.", error);
        if (!cancelled) setMember(false);
      }
    };

    const init = async () => {
      try {
        const [
          { data: chapterRows, error: chapterError },
          { data: sessionData, error: sessionError },
        ] = await Promise.all([
          supabase
            .from("chapters")
            .select("id,chapter_number,title,status")
            .order("chapter_number", { ascending: true, nullsFirst: false }),
          supabase.auth.getSession(),
        ]);

        if (cancelled) return;
        if (chapterError) throw chapterError;
        if (sessionError) throw sessionError;

        setChapters(chapterRows || []);
        await loadAccess(sessionData?.session?.user || null);
      } catch (error) {
        console.error("Chapter access initialization failed.", error);
        if (!cancelled) {
          setChapters([]);
          setMember(false);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    init();
    const listener = supabase.auth.onAuthStateChange((_event, session) => loadAccess(session?.user || null));
    authSubscription = listener.data?.subscription;
    return () => { cancelled = true; authSubscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    const handler = event => {
      const chapter = event?.detail?.chapter;
      if (isLockedChapter(chapter, member)) setLockedChapter(chapter);
    };
    window.addEventListener('atma:open-chapter-access', handler);
    return () => window.removeEventListener('atma:open-chapter-access', handler);
  }, [ready, member]);

  useEffect(() => {
    if (!ready) return undefined;

    const getChapterFromLocation = () => {
      const fromPath = findChapterForPath(window.location.pathname, chapters);
      if (fromPath) return fromPath;
      const legacyId = legacyChapterIdFromHash(window.location.hash);
      if (!legacyId) return null;
      return chapters.find(chapter => String(chapter.id) === String(legacyId)) || null;
    };

    const blockLockedChapter = chapter => {
      if (!isLockedChapter(chapter, member)) return false;
      window.history.replaceState(null, '', '/#chapters');
      window.dispatchEvent(new PopStateEvent('popstate'));
      setLockedChapter(chapter);
      return true;
    };

    const onLocationChange = () => blockLockedChapter(getChapterFromLocation());

    const onClick = event => {
      if (event.target?.closest?.('.pdlpl-page-list,.pdlpl-reader')) return;
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';

      if (href.startsWith('#read-chapter/')) {
        const legacyId = legacyChapterIdFromHash(href);
        const chapter = chapters.find(item => String(item.id) === String(legacyId));
        if (blockLockedChapter(chapter)) event.preventDefault();
        return;
      }

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin || !isChapterPath(url.pathname)) return;
      const chapter = findChapterForPath(url.pathname, chapters);
      if (blockLockedChapter(chapter)) event.preventDefault();
    };

    document.addEventListener('click', onClick, true);
    window.addEventListener('hashchange', onLocationChange);
    window.addEventListener('popstate', onLocationChange);
    onLocationChange();

    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('hashchange', onLocationChange);
      window.removeEventListener('popstate', onLocationChange);
    };
  }, [chapters, member, ready]);

  useEffect(() => {
    if (!ready) return undefined;
    const markLocks = () => {
      Array.from(document.querySelectorAll('.chapter-row')).filter(row => !row.closest('.pdlpl-page-list,.pdlpl-reader')).forEach(row => {
        const link = row.querySelector('a.chapter-row-main');
        const chapterId = row.getAttribute('data-chapter-id');
        if (!chapterId) return;
        const chapter = chapters.find(item => String(item.id) === String(chapterId));
        if (!isLockedChapter(chapter, member)) {
          row.classList.remove('chapter-row-locked');
          row.querySelector('.chapter-lock-badge')?.remove();
          return;
        }
        row.classList.add('chapter-row-locked');
        if (!row.querySelector('.chapter-lock-badge')) {
          const badge = document.createElement('span');
          badge.className = 'chapter-lock-badge';
          badge.innerHTML = '<span class="chapter-lock-badge-icon" aria-hidden="true">🔒</span><span>Members</span>';
          row.querySelector('.chapter-row-title h2')?.appendChild(badge);
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
        <p className="chapter-access-copy">Chapters 1–8 are free forever. From Chapter 9 onward, membership is required to continue reading.</p>
        <div className="chapter-access-perks"><span>✦ Full Chapter 9+ access</span><span>✦ UPI AutoPay membership</span><span>✦ Support Atma Rekha</span></div>
        <button className="chapter-access-cta" type="button" onClick={() => { setLockedChapter(null); window.location.hash = 'membership'; }}>Become a Member <span>→</span></button>
        <button className="chapter-access-secondary" type="button" onClick={() => setLockedChapter(null)}>Maybe later</button>
        <p className="chapter-access-note">Choose ₹19, ₹29, or ₹49 per month.</p>
      </section>
    </div>, document.body
  );
}
