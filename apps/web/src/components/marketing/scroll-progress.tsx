'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Reading progress for a long-form page.
 *
 * One passive scroll listener, throttled to animation frames, writing a transform
 * — not React state per pixel. It exists so a reader knows how much of the story
 * is left; it is hidden from assistive tech because the document position is
 * already announced by the browser.
 */
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(window.scrollY / max, 1) : 0;

      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${progress})`;
      }

      setVisible(window.scrollY > 240);
    };

    const onScroll = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-x-0 top-0 z-50 h-px transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        ref={barRef}
        className="h-px origin-left bg-gradient-to-r from-emerald-400 via-emerald-300 to-amber-300"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
}
