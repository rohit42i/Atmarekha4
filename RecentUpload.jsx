import { useState, useEffect } from 'react';
import axios from 'axios';
import { gsap } from 'gsap';
import ReviewModal from './ReviewModal';

export default function RecentUpload() {
  const [stories, setStories] = useState([]);
  const [reviewStory, setReviewStory] = useState(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const res = await axios.get(`${apiBaseUrl}/api/stories`);
        setStories(res.data);
      } catch (err) {
        console.error('Failed to fetch stories:', err);
      }
    };
    fetchStories();
  }, []);

  const handleReviewClick = (e, story) => {
    e.stopPropagation();
    setReviewStory(story);
  };

  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="mb-12 flex flex-col items-center text-center">
        <h2 className="relative inline-block text-3xl font-bold tracking-tight text-premium-royal dark:text-white sm:text-4xl">
          Latest Releases
          <span className="absolute -bottom-4 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-premium-gold"></span>
        </h2>
        <p className="mt-6 max-w-2xl text-lg text-premium-charcoal/80 dark:text-zinc-400">
          Discover our newest collection of immersive stories, updated weekly.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 xl:gap-10">
        {stories.map(story => (
          <div
            key={story._id}
            onClick={() => window.location.hash = `#reading/${story._id}`}
            className="group relative cursor-pointer overflow-hidden rounded-2xl bg-white shadow-lg transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-premium-gold/10 border border-premium-gold/20 dark:bg-zinc-900/50 dark:shadow-none dark:border-zinc-800 dark:hover:bg-zinc-800/80 dark:hover:border-zinc-700"
          >
            {/* Image Container */}
            <div className="relative aspect-[4/3] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 z-10"></div>
              <img
                src={story.coverImage}
                alt={story.title}
                className="h-full w-full object-cover transition-transform duration-700 will-change-transform group-hover:scale-110"
                loading="lazy"
              />

              {/* Category/Status Badge */}
              <div className="absolute top-4 left-4 z-20">
                <span className="rounded-full bg-premium-cream/95 px-3 py-1 text-xs font-bold uppercase tracking-wider text-premium-royal backdrop-blur-md shadow-sm border border-premium-gold/20 dark:bg-black/70 dark:text-white dark:border-zinc-700">
                  {story.status}
                </span>
              </div>

              {/* Review Button (Hover Only) */}
              <button
                onClick={(e) => handleReviewClick(e, story)}
                className="absolute top-4 right-4 z-20 flex h-8 w-8 translate-y-2 items-center justify-center rounded-full bg-white text-premium-royal opacity-0 shadow-lg transition-all duration-300 hover:bg-premium-royal hover:text-white group-hover:translate-y-0 group-hover:opacity-100 border border-premium-gold/20"
                title="Write a Review"
              >
                <i className="fa-regular fa-pen-to-square text-sm"></i>
              </button>
            </div>

            {/* Content */}
            <div className="relative p-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-premium-gold dark:text-blue-400">
                  {story.author || 'AtmaRekha Original'}
                </p>
                <div className="flex items-center gap-1 text-xs text-premium-charcoal/60 dark:text-zinc-400">
                  <i className="fa-regular fa-clock"></i>
                  <span>New</span>
                </div>
              </div>

              <h3 className="mb-2 text-xl font-bold leading-tight text-premium-royal transition-colors group-hover:text-premium-gold dark:text-white dark:group-hover:text-blue-400">
                {story.title}
              </h3>

              <p className="line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {story.description || 'Enter a world of mystery and intrigue. Follow the journey as it unfolds...'}
              </p>

              {/* Footer / CTA */}
              <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-white/10">
                <span className="text-sm font-medium text-zinc-500 transition-colors group-hover:text-zinc-900 dark:text-zinc-500 dark:group-hover:text-white">
                  Read Story
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-white/10 dark:text-white dark:group-hover:bg-blue-600">
                  <i className="fa-solid fa-arrow-right text-xs"></i>
                </div>
              </div>
            </div>
          </div>
        ))}

        {stories.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <i className="fa-solid fa-book-open text-2xl text-zinc-400 dark:text-zinc-500"></i>
            </div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white">No stories yet</h3>
            <p className="text-zinc-500 dark:text-zinc-400">Check back soon for new uploads!</p>
          </div>
        )}
      </div>

      <ReviewModal
        isOpen={!!reviewStory}
        onClose={() => setReviewStory(null)}
        storyId={reviewStory?._id}
        storyTitle={reviewStory?.title}
      />
    </section>
  );
}
