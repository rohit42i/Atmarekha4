import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ReadingPage({
  storyId,
  onOpenComments,
  onBack,
  onSortToggle,
  isReversed
}) {
  const [chapters, setChapters] = useState([]);
  const [story, setStory] = useState(null);
  const [allStories, setAllStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localLikes, setLocalLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  useEffect(() => {
    // If no storyId, fetch all stories for Library View
    if (!storyId) {
      fetchAllStories();
      return;
    }

    // If storyId, fetch details for Detail View
    const fetchData = async () => {
      setLoading(true);
      try {
        const [storyRes, chaptersRes] = await Promise.all([
          axios.get(`${apiBaseUrl}/api/stories/detail/${storyId}`),
          axios.get(`${apiBaseUrl}/api/chapters/${storyId}`)
        ]);
        setStory(storyRes.data);
        setLocalLikes(storyRes.data.likes || 0);
        setChapters(chaptersRes.data);

        // Check local storage for liked status
        const likedStories = JSON.parse(localStorage.getItem('likedStories') || '{}');
        if (likedStories[storyId]) setHasLiked(true);

      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [storyId]);

  const handleLike = async () => {
    if (hasLiked) return;
    try {
      const res = await axios.put(`${apiBaseUrl}/api/stories/${storyId}/like`);
      setLocalLikes(res.data.likes);
      setHasLiked(true);

      const likedStories = JSON.parse(localStorage.getItem('likedStories') || '{}');
      likedStories[storyId] = true;
      localStorage.setItem('likedStories', JSON.stringify(likedStories));
    } catch (err) {
      console.error('Failed to like story:', err);
    }
  };

  const fetchAllStories = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiBaseUrl}/api/stories`);
      setAllStories(res.data);
    } catch (err) {
      console.error("Failed to fetch library:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- LIBRARY VIEW (No Story ID) ---
  if (!storyId) {
    return (
      <main className="min-h-screen bg-zinc-50 pt-24 px-6 pb-20 dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">Library</h1>
          <p className="mb-12 text-zinc-500 dark:text-zinc-400">Explore our collection of immersive stories.</p>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {allStories.map(story => (
                <div
                  key={story._id}
                  onClick={() => window.location.hash = `#reading/${story._id}`}
                  className="group relative cursor-pointer overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800"
                >
                  <div className="aspect-[3/4] w-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-40"></div>
                    <img
                      src={story.coverImage}
                      alt={story.title}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                    />
                    {/* Hover Overlay Button */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <span className="rounded-full bg-white/20 px-6 py-2.5 font-semibold text-white backdrop-blur-md transition hover:bg-white/30">
                        Read Now
                      </span>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-5 pt-12 text-white bg-gradient-to-t from-black/90 to-transparent">
                    <h3 className="line-clamp-1 text-xl font-bold leading-tight">{story.title}</h3>
                    <p className="mt-1 text-sm font-medium text-zinc-300">{story.author || 'Unknown Author'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  // --- DETAIL VIEW (With Story ID) ---
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!story) return <div className="pt-32 text-center">Story not found</div>;

  return (
    <main className="min-h-screen pb-20 bg-zinc-50 dark:bg-zinc-950">
      {/* Immersive Header */}
      <div className="relative h-[60vh] w-full overflow-hidden">
        {/* Blurred Background with Parallax feel */}
        <div
          className="absolute inset-0 bg-cover bg-center blur-3xl opacity-60 dark:opacity-40 scale-110"
          style={{ backgroundImage: `url(${story.coverImage})` }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-zinc-50 dark:to-zinc-950"></div>

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col items-center justify-end px-6 pb-12 text-center sm:flex-row sm:items-end sm:justify-start sm:gap-10 sm:px-10 sm:text-left mx-auto max-w-6xl">
          <div className="relative group shrink-0">
            <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 opacity-75 blur transition duration-500 group-hover:opacity-100"></div>
            <img
              src={story.coverImage}
              alt={story.title}
              className="relative h-64 w-44 rounded-lg object-cover shadow-2xl sm:h-80 sm:w-56"
            />
          </div>

          <div className="flex-1 pb-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-6xl drop-shadow-sm">{story.title}</h1>
            <p className="mt-3 text-xl font-medium text-zinc-700 dark:text-zinc-200">by {story.author || 'AtmaRekha Team'}</p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
              {/* Like Button */}
              <button
                onClick={handleLike}
                disabled={hasLiked}
                className={`flex items-center gap-2 rounded-full px-6 py-2 text-sm font-bold shadow-lg transition hover:scale-105 ${hasLiked
                  ? 'bg-rose-600 text-white shadow-rose-600/30'
                  : 'bg-white/80 text-rose-600 backdrop-blur hover:bg-white dark:bg-black/50 dark:text-rose-400'
                  }`}
              >
                <i className={`${hasLiked ? 'fa-solid' : 'fa-regular'} fa-heart`}></i>
                {localLikes} Likes
              </button>

              {/* Continue Reading Button */}
              {chapters.length > 0 && (() => {
                const sortedChapters = [...chapters].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                const firstChapterId = sortedChapters[0]?._id;
                return firstChapterId ? (
                  <a
                    href={`#read-chapter/${firstChapterId}`}
                    className="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 hover:scale-105"
                  >
                    <i className="fa-solid fa-book-open"></i> Continue Reading
                  </a>
                ) : null;
              })()}

              <span className="rounded-full border border-zinc-200 bg-white/50 px-4 py-2 text-sm font-semibold text-zinc-600 backdrop-blur dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
                {chapters.length} Episodes
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 -mt-8 relative z-20">
        {/* Description Card */}
        <div className="mb-10 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <h3 className="mb-3 text-lg font-bold text-zinc-900 dark:text-white">Synopsis</h3>
          <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
            {story.description || "Enter a world of mystery and intrigue. Follow the journey as it unfolds chapter by chapter..."}
          </p>
        </div>

        {/* Action Bar */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Episodes</h2>
          <button onClick={onSortToggle} className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800">
            <i className="fa-solid fa-sort"></i> {isReversed ? 'Newest First' : 'Oldest First'}
          </button>
        </div>

        {/* Chapter List */}
        <div className="flex flex-col gap-4">
          {chapters.length > 0 ? (
            [...chapters]
              .sort((a, b) => isReversed
                ? new Date(b.createdAt) - new Date(a.createdAt)
                : new Date(a.createdAt) - new Date(b.createdAt)
              )
              .map((ch, index) => (
                <div
                  key={ch._id}
                  className="group relative flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 transition-all duration-300 hover:scale-[1.01] hover:shadow-md hover:ring-blue-500/20 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-blue-500/30"
                >
                  <a href={`#read-chapter/${ch._id}`} className="flex flex-1 items-center gap-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-900/20 dark:text-blue-400">
                      {ch.chapterNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate font-bold text-zinc-900 transition-colors group-hover:text-blue-600 dark:text-white">{ch.title}</h3>
                      <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400">
                        <span>{new Date(ch.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                        <span>{Math.ceil(Math.random() * 5 + 2)} min read</span>
                      </div>
                    </div>
                  </a>

                  <button
                    className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-300 transition hover:bg-blue-50 hover:text-blue-600 dark:text-zinc-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenComments(ch.chapterNumber);
                    }}
                    title="Read & Comment"
                  >
                    <i className="fa-solid fa-message"></i>
                  </button>
                </div>
              ))
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-300 dark:bg-zinc-800 dark:text-zinc-600">
                <i className="fa-solid fa-book-open text-2xl"></i>
              </div>
              <h3 className="font-semibold text-zinc-900 dark:text-white">No episodes yet</h3>
              <p className="text-zinc-500">Check back later for updates!</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
