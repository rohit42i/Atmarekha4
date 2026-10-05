import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const PAGE_SELECTORS = '.home-page, .site-shell, .reader-page';
const REVEAL_SELECTOR = '.home-page .hero-card, .home-page .home-announcements, .home-page .continue-reading-card, .chapter-row, .info-card, .about-card, .legal-card, .profile-v2-card';

function animatePage() {
  const pages = gsap.utils.toArray(PAGE_SELECTORS);
  if (!pages.length) return;
  const page = pages[pages.length - 1];
  const revealTargets = gsap.utils.toArray(REVEAL_SELECTOR);

  gsap.killTweensOf(page);
  gsap.fromTo(page, { autoAlpha: 0, y: 8 }, {
    autoAlpha: 1, y: 0, duration: 0.38, ease: 'power2.out',
    clearProps: 'transform,opacity,visibility'
  });

  revealTargets.forEach((element, index) => {
    gsap.killTweensOf(element);
    gsap.fromTo(element, { autoAlpha: 0, y: 20 }, {
      autoAlpha: 1, y: 0, duration: 0.52,
      delay: Math.min(index * 0.035, 0.18), ease: 'power3.out',
      clearProps: 'transform,opacity,visibility',
      scrollTrigger: { trigger: element, start: 'top 92%', once: true }
    });
  });

  const hero = page.querySelector('.hero-card');
  if (hero) {
    const art = hero.querySelector('.hero-art');
    const copy = hero.querySelector('.hero-copy');
    if (art) gsap.fromTo(art, { scale: 1.035 }, { scale: 1, duration: 1.05, ease: 'power3.out' });
    if (copy) gsap.fromTo(copy.children, { autoAlpha: 0, x: -14 }, {
      autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.07, delay: 0.08,
      ease: 'power3.out', clearProps: 'transform,opacity,visibility'
    });
  }

  gsap.utils.toArray('.chapter-row').forEach((row, index) => {
    gsap.fromTo(row, { x: index % 2 ? 16 : -16 }, {
      x: 0, duration: 0.5, delay: Math.min(index * 0.025, 0.14),
      ease: 'power3.out', scrollTrigger: { trigger: row, start: 'top 94%', once: true }
    });
  });
}

export default function ExperienceEnhancements() {
  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(
      { reduce: '(prefers-reduced-motion: reduce)', finePointer: '(hover: hover) and (pointer: fine)' },
      context => {
        if (!context.conditions.reduce) {
          animatePage();
          const onRoute = () => requestAnimationFrame(animatePage);
          window.addEventListener('popstate', onRoute);

          const onPointerMove = event => {
            const hero = event.target?.closest?.('.home-page .hero-card');
            if (!hero || !context.conditions.finePointer) return;
            const rect = hero.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width - 0.5;
            const y = (event.clientY - rect.top) / rect.height - 0.5;
            gsap.to(hero, {
              rotationY: x * 1.2, rotationX: y * -1.2,
              transformPerspective: 900, duration: 0.35,
              ease: 'power2.out', overwrite: true
            });
          };

          const onPointerLeave = event => {
            const hero = event.target?.closest?.('.home-page .hero-card');
            if (hero) gsap.to(hero, { rotationY: 0, rotationX: 0, duration: 0.45, ease: 'power3.out' });
          };

          document.addEventListener('pointermove', onPointerMove, { passive: true });
          document.addEventListener('pointerout', onPointerLeave, { passive: true });

          return () => {
            window.removeEventListener('popstate', onRoute);
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerout', onPointerLeave);
          };
        }
        return undefined;
      }
    );

    return () => {
      mm.revert();
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  return null;
}
