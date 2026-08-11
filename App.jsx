import { useEffect, useState } from 'react';
import { buildChapters, buildChapterPages } from './chapters';
import AdminLogin from './AdminLogin';
import AdminPanel from './AdminPanel';

const SITE_STORY = {
  title: 'Atma Rekha',
  description:
    'In an age when divine light has long faded, two destined souls rise against the return of the ancient Asurs.',
};

function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-400" aria-hidden="true" />
        <p className="text-zinc-500 dark:text-zinc-400">{label}</p>
      </div>
    </div>
  );
}

function ChapterReader({ chapterId, onBack }) {
  const [chapter, setChapter] = useState(null);
  const [pages, setPages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadChapter() {
      setLoading(true); setError(''); setChapter(null); setPages([]); setCurrentIndex(0);
      try {
        const chapters = await buildChapters();
        const found = chapters.find(item => String(item.id) === String(chapterId));
        if (!found) throw new Error('Chapter not found.');
        const livePages = await buildChapterPages(found.id);
        if (!cancelled) { setChapter(found); setPages(livePages); }
      } catch (err) {
        console.error('Failed to load chapter:', err);
        if (!cancelled) setError(err?.message === 'Chapter not found.' ? 'Chapter not found.' : 'Unable to load this chapter right now.');
      } finally { if (!cancelled) setLoading(false); }
    }
    loadChapter();
    return () => { cancelled = true; };
  }, [chapterId]);

  if (loading) return <LoadingState label="Loading chapter..." />;
  if (!chapter) return <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-950"><div className="mb-4 text-4xl">📖</div><h2 className="text-xl font-bold">{error || 'Chapter not found'}</h2><button onClick={onBack} className="mt-6 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white">Go Back</button></div>;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="fixed top-0 z-50 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95"><div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4"><button onClick={onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-zinc-100 dark:hover:bg-zinc-800">←</button><div className="min-w-0 flex-1"><h1 className="truncate text-lg font-bold">Chapter {chapter.chapterNumber}</h1><p className="truncate text-sm text-zinc-500">{chapter.title || 'Untitled chapter'}</p></div></div></header>
      <main className="px-6 pb-24 pt-28">
        {pages.length ? <div className="mx-auto max-w-3xl"><img src={pages[currentIndex]} alt={`Chapter ${chapter.chapterNumber}, page ${currentIndex + 1}`} className="mx-auto w-full rounded-lg object-contain shadow-sm" draggable="false" /><div className="mt-6 flex items-center justify-between gap-4"><button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0} className="flex-1 rounded-xl bg-zinc-200 py-3 font-medium disabled:opacity-30 dark:bg-zinc-800">← Prev</button><span className="whitespace-nowrap text-sm text-zinc-500">Page {currentIndex + 1} of {pages.length}</span><button onClick={() => setCurrentIndex(i => Math.min(pages.length - 1, i + 1))} disabled={currentIndex === pages.length - 1} className="flex-1 rounded-xl bg-zinc-900 py-3 font-medium text-white disabled:opacity-30 dark:bg-white dark:text-black">Next →</button></div></div> : <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-white px-6 text-center dark:border-zinc-800 dark:bg-zinc-900"><div className="mb-4 text-4xl">📄</div><h3 className="font-semibold">Chapter content is not uploaded yet</h3><p className="mt-2 max-w-md text-zinc-500">This chapter exists in Supabase, but no manga pages are attached to it yet.</p><button onClick={onBack} className="mt-6 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white">Back to Chapters</button></div>}
      </main>
    </div>
  );
}

function ChapterCard({ chapter }) {
  return <a href={`#read-chapter/${encodeURIComponent(chapter.id)}`} className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 transition hover:-translate-y-1 hover:shadow-xl dark:bg-zinc-900 dark:ring-zinc-800"><div className="aspect-[3/4] overflow-hidden bg-zinc-100 dark:bg-zinc-950">{chapter.cover ? <img src={chapter.cover} alt={chapter.title || `Chapter ${chapter.chapterNumber}`} className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]" loading="lazy" draggable="false" /> : <div className="flex h-full items-center justify-center text-zinc-400">No cover</div>}</div><div className="p-5"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-blue-600">Chapter {chapter.chapterNumber}</p>{chapter.status && <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-500 dark:bg-zinc-800">{chapter.status}</span>}</div><h3 className="mt-1 text-xl font-bold">{chapter.title || 'Untitled chapter'}</h3>{chapter.description && <p className="mt-2 line-clamp-3 text-sm text-zinc-500">{chapter.description}</p>}{chapter.releaseDate && <p className="mt-3 text-xs text-zinc-400">Release: {new Date(chapter.releaseDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p>}</div></a>;
}

function PublicHome({ chapters, loading, loadError }) {
  return <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-white"><header className="border-b border-zinc-200 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950"><div className="mx-auto flex max-w-7xl items-center justify-between"><a href="#index" className="text-xl font-bold">Atma Rekha</a><nav className="flex gap-5 text-sm text-zinc-600 dark:text-zinc-300"><a href="#index">Home</a><a href="#reading">Chapters</a><a href="#admin">Admin</a></nav></div></header><section className="mx-auto max-w-7xl px-6 py-16"><h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">{SITE_STORY.title}</h1><p className="mt-5 max-w-2xl text-lg text-zinc-600 dark:text-zinc-300">{SITE_STORY.description}</p><a href="#reading" className="mt-8 inline-flex rounded-full bg-blue-600 px-7 py-3 font-semibold text-white">Start Reading</a></section><section id="reading" className="mx-auto max-w-7xl scroll-mt-8 px-6 pb-20"><h2 className="text-3xl font-bold">Chapters</h2><p className="mt-2 text-zinc-500 dark:text-zinc-400">Live from Supabase.</p>{loading && <LoadingState label="Loading chapters..." />}{!loading && loadError && <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700"><p className="font-semibold">Could not load chapters</p><p className="mt-1 text-sm">{loadError}</p></div>}{!loading && !loadError && !chapters.length && <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700"><h3 className="font-semibold">No chapters published yet</h3><p className="mt-2 text-sm text-zinc-500">Publish a chapter from the admin dashboard.</p></div>}{!loading && !loadError && chapters.length > 0 && <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{chapters.map(chapter => <ChapterCard key={chapter.id} chapter={chapter} />)}</div>}</section></main>;
}

export default function App() {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [route, setRoute] = useState(() => window.location.hash || '#index');
  const [adminSession, setAdminSession] = useState(false);

  useEffect(() => { const onHash = () => setRoute(window.location.hash || '#index'); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setLoadError('');
      try { const data = await buildChapters(); if (!cancelled) setChapters(Array.isArray(data) ? data : []); }
      catch (error) { console.error(error); if (!cancelled) { setChapters([]); setLoadError(error?.message || 'Unable to load chapters from Supabase.'); } }
      finally { if (!cancelled) setLoading(false); }
    }
    if (!route.startsWith('#read-chapter/') && !route.startsWith('#admin')) load();
    return () => { cancelled = true; };
  }, [route]);

  useEffect(() => {
    if (!route.startsWith('#admin')) return;
    import('./supabase').then(({ supabase }) => supabase.auth.getUser().then(({ data }) => setAdminSession(Boolean(data.user))));
  }, [route]);

  if (route === '#admin') return adminSession ? <AdminPanel onLogout={() => setAdminSession(false)} /> : <AdminLogin onLoginSuccess={() => setAdminSession(true)} />;
  const readerMatch = route.match(/^#read-chapter\/(.+)$/);
  if (readerMatch) return <ChapterReader chapterId={decodeURIComponent(readerMatch[1])} onBack={() => { window.location.hash = '#reading'; }} />;
  return <PublicHome chapters={chapters} loading={loading} loadError={loadError} />;
}
