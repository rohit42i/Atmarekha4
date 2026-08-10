import { useState, useEffect } from 'react';
import axios from 'axios';

const DEFAULT_HERO_IMAGES = []; // No defaults as per user request

export default function HeroSection({ isDark }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [heroImages, setHeroImages] = useState(DEFAULT_HERO_IMAGES);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchHeroImages = async () => {
      try {
        const res = await axios.get(`${apiBaseUrl}/api/hero-images`);
        if (res.data && res.data.length > 0) {
          setHeroImages(res.data.map(img => img.imageUrl));
        }
      } catch (err) {
        console.error('Failed to fetch hero images:', err);
      }
    };
    fetchHeroImages();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages]); // Re-run effect when images change

  return (
    <section
      className="relative flex min-h-[80vh] flex-col items-center justify-center px-6 text-center overflow-hidden"
      style={{ marginTop: 72 }}
    >
      {/* Background Slideshow */}
      <div className="absolute inset-0 z-0 bg-zinc-900">
        {heroImages.length > 0 ? (
          heroImages.map((img, index) => (
            <div
              key={index}
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'
                }`}
              style={{ backgroundImage: `url(${img})` }}
            />
          ))
        ) : (
          <div className="absolute inset-0 bg-zinc-900" />
        )}
      </div>

      {/* Overlay Gradient */}
      <div
        className={`absolute inset-0 z-10 transition-colors duration-500 ${isDark
          ? 'bg-gradient-to-b from-black/80 via-black/60 to-zinc-950'
          : 'bg-gradient-to-b from-premium-cream/90 via-premium-cream/70 to-premium-cream'
          }`}
      />

      <div className="relative z-20 max-w-4xl">
        <h1 className="hero-title text-5xl font-extrabold tracking-tight text-premium-royal drop-shadow-sm dark:text-white md:text-8xl mb-6">
          Atma Rekha
        </h1>
        <p className="hero-sub mx-auto mt-4 max-w-2xl text-lg font-medium leading-relaxed text-premium-charcoal/80 dark:text-zinc-300 md:text-xl">
          In an age when divine light has long faded, two destined souls rise against the return of the ancient Asurs.
        </p>

        <div className="hero-cta mt-10 flex flex-col items-center justify-center gap-6">
          <button
            onClick={() => window.location.hash = '#reading'}
            className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-premium-royal px-8 py-3 text-white transition-all duration-300 hover:bg-premium-royal/90 hover:scale-105 active:scale-95 shadow-lg shadow-premium-royal/30"
          >
            <span className="font-semibold text-lg">Start Reading</span>
            <i className="fas fa-arrow-right transition-transform group-hover:translate-x-1"></i>
          </button>

          <div className="flex items-center gap-2 rounded-full bg-white/80 backdrop-blur px-4 py-1.5 text-xs font-semibold text-premium-royal ring-1 ring-premium-gold/30 dark:bg-zinc-900/50 dark:text-zinc-300 dark:ring-zinc-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-premium-gold opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-premium-gold"></span>
            </span>
            Work in Progress
          </div>
        </div>
      </div>

    </section>
  );
}
// End of HeroSection
