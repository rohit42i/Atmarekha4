import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import HomeAnnouncement from './HomeAnnouncement';

const DEFAULT_HERO_IMAGES = [];

export default function HeroSection({ isDark }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [heroImages, setHeroImages] = useState(DEFAULT_HERO_IMAGES);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  useEffect(() => {
    let cancelled = false;
    const fetchHeroImages = async () => {
      try {
        const res = await axios.get(`${apiBaseUrl}/api/hero-images`);
        if (!cancelled && Array.isArray(res.data) && res.data.length > 0) {
          setHeroImages(res.data.map(img => img.imageUrl).filter(Boolean));
        }
      } catch (err) {
        console.error('Failed to fetch hero images:', err);
      }
    };
    fetchHeroImages();
    return () => { cancelled = true; };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (heroImages.length < 2) return undefined;
    const interval = setInterval(() => {
      setCurrentImageIndex(prev => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  const activeHeroImages = useMemo(() => {
    if (!heroImages.length) return [];
    const current = currentImageIndex % heroImages.length;
    const next = (current + 1) % heroImages.length;
    return heroImages.length === 1 ? [{ url: heroImages[current], index: current }] : [
      { url: heroImages[current], index: current },
      { url: heroImages[next], index: next }
    ];
  }, [heroImages, currentImageIndex]);

  return (
    <section className="relative flex min-h-[80vh] flex-col items-center justify-center px-6 text-center overflow-hidden" style={{ marginTop: 72 }}>
      <div className="absolute inset-0 z-0 bg-zinc-900">
        {activeHeroImages.map(({ url, index }) => (
          <div
            key={`${url}-${index}`}
            aria-hidden="true"
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`}
            style={{ backgroundImage: `url(${url})` }}
          />
        ))}
        {!heroImages.length && <div className="absolute inset-0 bg-zinc-900" />}
      </div>

      <div className={`absolute inset-0 z-10 transition-colors duration-500 ${isDark
        ? 'bg-gradient-to-b from-black/80 via-black/60 to-zinc-950'
        : 'bg-gradient-to-b from-premium-cream/90 via-premium-cream/70 to-premium-cream'}`}
      />

      <div className="relative z-20 max-w-4xl">
        <h1 className="hero-title text-5xl font-extrabold tracking-tight text-premium-royal drop-shadow-sm dark:text-[var(--text-color)] md:text-8xl mb-6">
          Atma Rekha
        </h1>
        <p className="hero-sub mx-auto mt-4 max-w-2xl text-lg font-medium leading-relaxed text-premium-charcoal/80 dark:text-zinc-300 md:text-xl" />

        <div className="hero-cta mt-10 flex flex-col items-center justify-center gap-6">
          <button
            onClick={() => { window.location.hash = '#reading'; }}
            className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-premium-royal px-8 py-3 text-[var(--text-color)] transition-all duration-300 hover:bg-premium-royal/90 hover:scale-105 active:scale-95 shadow-lg shadow-premium-royal/30"
          >
            <span className="font-semibold text-lg">Start Reading</span>
            <i className="fas fa-arrow-right transition-transform group-hover:translate-x-1" />
          </button>

          <div className="flex items-center gap-2 rounded-full bg-[var(--card-bg)]/80 backdrop-blur px-4 py-1.5 text-xs font-semibold text-premium-royal ring-1 ring-premium-gold/30 dark:bg-zinc-900/50 dark:text-zinc-300 dark:ring-zinc-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-premium-gold opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-premium-gold" />
            </span>
            Work in Progress
          </div>
        </div>
      </div>

      <div className="relative z-20 w-full">
        <HomeAnnouncement />
      </div>
    </section>
  );
}
