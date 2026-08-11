import { useEffect, useState } from 'react';
import { buildChapters, buildChapterPages } from './chapters';

const SITE_STORY = {
  id: 'atma-rekha',
  title: 'Atma Rekha',
  author: 'Atma Rekha Team',
  category: 'Fantasy',
  status: 'Work in Progress',
  coverImage: '',
  description:
    'In an age when divine light has long faded, two destined souls rise against the return of the ancient Asurs.',
  likes: 0,
};

function ChapterReader({ chapterId, onBack }) {
  const [chapter, setChapter] = useState(null);
  const [pages, setPages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadChapter() {
      setLoading(true);
      setError('');
      setCurrentIndex(0);

      try {
        const chapters = await buildChapters();
        const found = chapters.find(
          (item) => String(item.id) === String(chapterId)
        );

        if (!found) {
          if (!cancelled) {
            setChapter(null);
            setPages([]);
            setError('Chapter not found.');
            setLoading(false);
          }
          return;
        }

        const livePages = await buildChapterPages(found.id);

        if (!cancelled) {
          setChapter(found);
          setPages(livePages);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load chapter:', err);

        if (!cancelled) {
          setChapter(null);
          setPages([]);
          setError('Unable to load this chapter right now.');
          setLoading(false);
        }
      }
    }

    loadChapter();

    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <i className="fa-solid fa-spinner fa-spin mb-4 text-3xl text-blue-600" />
          <p className="text-zinc-500 dark:text-zinc-400">
            Loading chapter...
          </p>
        </div>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-950">
        <i className="fa-solid fa-book-open mb-4 text-3xl text-zinc-400" />

        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
          {error || 'Chapter not found'}
        </h2>

        <button
          onClick={onBack}
          className="mt-6 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="fixed top-0 z-50 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <button
            onClick={onBack}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <i className="fa-solid fa-arrow-left" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-zinc-900 dark:text-white">
              Chapter {chapter.chapterNumber}
            </h1>

            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
              {chapter.title || 'Untitled chapter'}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-24 pt-28">
        {pages.length > 0 ? (
          <div className="mx-auto max-w-3xl">
            <img
              src={pages[currentIndex]}
              alt={`Page ${currentIndex + 1}`}
              className="mx-auto max-h-[80vh] w-full rounded-lg object-contain shadow-sm"
            />

            <div className="mt-6 flex items-center justify-between gap-4">
              <button
                onClick={() =>
                  setCurrentIndex((i) => Math.max(0, i - 1))
                }
                disabled={currentIndex === 0}
                className="flex-1 rounded-xl bg-zinc-200 py-3 font-medium disabled:opacity-30 dark:bg-zinc-800 dark:text-white"
              >
                ← Prev
              </button>

              <span className="whitespace-nowrap text-sm text-zinc-500">
                Page {currentIndex + 1} of {pages.length}
              </span>

              <button
                onClick={() =>
                  setCurrentIndex((i) =>
                    Math.min(pages.length - 1, i + 1)
                  )
                }
                disabled={currentIndex === pages.length - 1}
                className="flex-1 rounded-xl bg-zinc-900 py-3 font-medium text-white disabled:opacity-30 dark:bg-white dark:text-black"
              >
                Next →
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-white px-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-300 dark:bg-zinc-800 dark:text-zinc-600">
              <i className="fa-solid fa-file-circle-xmark text-2xl" />
            </div>

            <h3 className="font-semibold text-zinc-900 dark:text-white">
              Chapter content is not uploaded yet
            </h3>

            <p className="mt-2 max-w-md text-zinc-500">
              The chapter exists, but no manga pages are currently attached
              to it.
            </p>

            <button
              onClick={onBack}
              className="mt-6 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white"
            >
              Back to Chapters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [route, setRoute] = useState(
    () => window.location.hash || '#index'
  );

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash || '#index');
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadChapters() {
      setLoading(true);
      setLoadError('');

      try {
        const data = await buildChapters();

        if (!cancelled) {
          setChapters(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load chapters:', err);

        if (!cancelled) {
          setLoadError('Unable to load chapters right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadChapters();

    return () => {
      cancelled = true;
    };
  }, []);

  const readerMatch = route.match(/^#read-chapter\/(.+)$/);

  if (readerMatch) {
    return (
      <ChapterReader
        chapterId={decodeURIComponent(readerMatch[1])}
        onBack={() => {
          window.location.hash = '#reading';
        }}
      />
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-white">
      <header className="border-b border-zinc-200 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <a href="#index" className="text-xl font-bold">
            Atma Rekha
          </a>

          <nav className="flex gap-5 text-sm text-zinc-600 dark:text-zinc-300">
            <a href="#index">Home</a>
            <a href="#reading">Chapters</a>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
          Atma Rekha
        </h1>

        <p className="mt-5 max-w-2xl text-lg text-zinc-600 dark:text-zinc-300">
          {SITE_STORY.description}
        </p>

        <a
          href="#reading"
          className="mt-8 inline-flex rounded-full bg-blue-600 px-7 py-3 font-semibold text-white"
        >
          Start Reading
        </a>
      </section>

      <section
        id="reading"
        className="mx-auto max-w-7xl scroll-mt-8 px-6 pb-20"
      >
        <h2 className="text-3xl font-bold">Chapters</h2>

        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Explore the Atma Rekha story universe.
        </p>

        {loading && (
          <p className="mt-8 text-zinc-500">
            Loading chapters...
          </p>
        )}

        {!loading && loadError && (
          <p className="mt-8 text-red-500">
            {loadError}
          </p>
        )}

        {!loading && !loadError && chapters.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
            <h3 className="font-semibold">
              No chapters published yet
            </h3>

            <p className="mt-2 text-sm text-zinc-500">
              Upload a chapter from the admin panel and it will appear here
              automatically.
            </p>
          </div>
        )}

        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {chapters.map((chapter) => (
            <a
              key={chapter.id}
              href={`#read-chapter/${encodeURIComponent(chapter.id)}`}
              className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 transition hover:-translate-y-1 hover:shadow-xl dark:bg-zinc-900 dark:ring-zinc-800"
            >
              <div className="aspect-[3/4] overflow-hidden bg-zinc-100 dark:bg-zinc-950">
                {chapter.cover ? (
                  <img
                    src={chapter.cover}
                    alt={
                      chapter.title ||
                      `Chapter ${chapter.chapterNumber}`
                    }
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-400">
                    No cover
                  </div>
                )}
              </div>

              <div className="p-5">
                <p className="text-sm font-semibold text-blue-600">
                  Chapter {chapter.chapterNumber}
                </p>

                <h3 className="mt-1 text-xl font-bold">
                  {chapter.title || 'Untitled chapter'}
                </h3>

                {chapter.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-zinc-500">
                    {chapter.description}
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
