import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Inertia smooth-scroll for marketing pages (Lenis), kept in sync with GSAP ScrollTrigger.
 * Skipped entirely when the user prefers reduced motion.
 * Elements that need native scrolling can opt out with `data-lenis-prevent`.
 */
export const useSmoothScroll = () => {
  useEffect(() => {
    // Skip in non-browser test environments (jsdom lacks these APIs)
    if (typeof window.matchMedia !== 'function' || typeof window.ResizeObserver === 'undefined') return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (document.documentElement.classList.contains('motion-off')) return undefined;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    window.__lenis = lenis;

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      if (window.__lenis === lenis) delete window.__lenis;
    };
  }, []);
};

/** Scroll to an element id, using Lenis when it is active. */
export const scrollToId = (id, offset = -88) => {
  const el = document.getElementById(id);
  if (!el) return;
  if (window.__lenis) {
    window.__lenis.scrollTo(el, { offset });
  } else {
    const top = el.getBoundingClientRect().top + window.pageYOffset + offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }
};
