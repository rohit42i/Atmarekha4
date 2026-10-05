import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function ExperienceEnhancements() {
  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(
      { reduce: '(prefers-reduced-motion: reduce)', finePointer: '(hover: hover) and (pointer: fine)' },
      context => {
        if (!context.conditions.reduce) {
          const revealTargets = gsap.utils.toArray(
            '.home-page .hero-card, .home-page .home-announcements, .chapter-row, .info-card, .about-card, .legal-card, .profile-v2-card'
          );

          revealTargets.forEach((element, index) => {
            gsap.fromTo(element, { autoAlpha: 0, y: 18 }, {
              autoAlpha: 1,
              y: 0,
              duration: 0.58,
              delay: Math.min(index * 0.025, 0.16),
              ease: 'power3.out',
              scrollTrigger: { trigger: element, start: 'top 90%', once: true }
            });
          });
        }

        if (context.conditions.finePointer && !context.conditions.reduce) {
          const selector = '.hero-card, .chapter-row, .info-card, .about-card, .legal-card, .profile-v2-card';
          const onPointerMove = event => {
            const card = event.target?.closest?.(selector);
            if (!card) return;
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--ar-spot-x', String(event.clientX - rect.left) + 'px');
            card.style.setProperty('--ar-spot-y', String(event.clientY - rect.top) + 'px');
          };
          document.addEventListener('pointermove', onPointerMove, { passive: true });
          return () => document.removeEventListener('pointermove', onPointerMove);
        }

        return undefined;
      }
    );

    return () => mm.revert();
  }, []);

  return null;
}
