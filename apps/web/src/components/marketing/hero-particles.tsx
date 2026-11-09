'use client';

import { useEffect, useRef } from 'react';

/**
 * Hero field: the drifting particle cloud from the reference frame, rebuilt.
 *
 * What the reference is doing, and what is reproduced here: a few thousand small triangles
 * suspended in a slow swirl, dense at the core and breaking up at the edges, lit from within so
 * the whole thing reads as a body rather than as scattered dots. Only the motion is taken —
 * none of the frame's content (its nav, its headline, its CTA) exists here.
 *
 * Canvas rather than CSS: a few thousand independently drifting specks is not something a
 * stylesheet can do. The loop is deliberately cheap —
 *   · one path per colour, not per particle
 *   · positions from arithmetic, no noise library
 *   · device pixel ratio capped at 2
 *   · the loop stops when the hero scrolls out of view or the tab is hidden
 * so it holds frame rate on a laptop with no discrete GPU.
 *
 * Colour is the prism spectrum, index by angle, so the cloud turns through the palette as it
 * rotates instead of settling on one hue the way the reference's gold/violet does.
 *
 * `prefers-reduced-motion` paints a single still frame and never starts the loop.
 */

const SPECTRUM = [
  '#7B00FF',
  '#3300FF',
  '#0055FF',
  '#0099FF',
  '#00DDAA',
  '#AAFF00',
  '#FFDD00',
  '#FF8800',
  '#FF2200',
];

/** Interpolate the spectrum into a continuous wheel, so bands blend instead of stepping. */
const BANDS = 24;

const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
};

const BAND_COLOURS = (() => {
  const stops = SPECTRUM.map(hexToRgb);
  const out: string[] = [];

  for (let band = 0; band < BANDS; band += 1) {
    const position = (band / BANDS) * stops.length;
    const from = stops[Math.floor(position) % stops.length]!;
    const to = stops[(Math.floor(position) + 1) % stops.length]!;
    const mix = position - Math.floor(position);

    out.push(
      `rgb(${Math.round(from[0] + (to[0] - from[0]) * mix)},${Math.round(
        from[1] + (to[1] - from[1]) * mix,
      )},${Math.round(from[2] + (to[2] - from[2]) * mix)})`,
    );
  }

  return out;
})();

type Speck = {
  angle: number;
  radius: number; // fraction of the blob's radius
  speed: number; // radians per second around the core
  phase: number;
  size: number;
  spin: number;
  band: number;
  alpha: number;
};

const buildSpecks = (count: number, seed = 1): Speck[] => {
  // Deterministic pseudo-random: the same cloud every load, and no hydration mismatch risk.
  let state = seed;
  const rnd = (): number => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  return Array.from({ length: count }, () => {
    const radius = Math.pow(rnd(), 0.62); // biased to the centre: a body, not a disc of dust
    const angle = rnd() * Math.PI * 2;
    // Colour by sector and depth, not per speck: a hue that varies with position reads as a lit
    // body, while a random hue per speck reads as confetti.
    // Band by angle: the wheel is fixed in space, so the cloud reads as light dispersed through
    // glass rather than as recoloured dust.
    const band = Math.floor(((angle / (Math.PI * 2)) % 1) * BANDS) % BANDS;
    return {
      angle,
      radius,
      speed: (0.06 + rnd() * 0.16) * (0.55 + radius * 0.75),
      phase: rnd() * Math.PI * 2,
      size: 1.9 + rnd() * 2.9,
      spin: (rnd() - 0.5) * 2.4,
      band,
      alpha: 0.26 + rnd() * 0.62,
    };
  });
};

export function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const specks = buildSpecks(window.innerWidth < 768 ? 1800 : 6400);

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let started = 0;
    let running = false;
    let visible = true;

    const resize = (): void => {
      const box = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(box.width));
      height = Math.max(1, Math.floor(box.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (seconds: number): void => {
      context.clearRect(0, 0, width, height);

      // An ellipse, because the hero is wide: a circle here would leave dead corners.
      // On a phone the copy fills the frame, so the body sits low and small behind it.
      const narrow = width < 768;
      const centreX = width * (narrow ? 0.56 : 0.66);
      const centreY = height * (narrow ? 0.74 : 0.5);
      const radiusY = narrow ? Math.min(height * 0.3, width * 0.62) : Math.min(height * 0.46, width * 0.28);
      const radiusX = narrow ? radiusY * 1.1 : radiusY * (width > 900 ? 1.12 : 1);

      // Inner glow first: without it the specks read as dust on black rather than a body.
      const glow = context.createRadialGradient(
        centreX,
        centreY,
        0,
        centreX,
        centreY,
        Math.max(radiusX, radiusY),
      );
      glow.addColorStop(0, 'rgba(123, 0, 255, 0.16)');
      glow.addColorStop(0.45, 'rgba(0, 221, 170, 0.11)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      context.globalCompositeOperation = 'lighter';

      for (let band = 0; band < BANDS; band += 1) {
        context.fillStyle = BAND_COLOURS[band] ?? SPECTRUM[0]!;
        context.beginPath();

        for (const speck of specks) {
          if (speck.band !== band) continue;

          const angle = speck.angle + seconds * speck.speed;
          // wobble: the edge breathes instead of spinning as a rigid disc
          const wobble =
            1 +
            0.07 * Math.sin(seconds * 0.45 + speck.phase) +
            0.11 * Math.sin(3 * (speck.angle + seconds * 0.08) + speck.phase * 0.4);
          const radial = speck.radius * wobble;

          const x = centreX + Math.cos(angle) * radial * radiusX;
          const y = centreY + Math.sin(angle) * radial * radiusY;

          // thin the field towards the rim, so the body has a soft boundary
          context.globalAlpha = speck.alpha * (1 - radial * 0.8);

          const turn = angle + speck.spin + Math.PI / 2;
          const cos = Math.cos(turn) * speck.size;
          const sin = Math.sin(turn) * speck.size;

          context.moveTo(x + cos, y + sin);
          context.lineTo(x - cos * 0.5 - sin * 0.87, y - sin * 0.5 + cos * 0.87);
          context.lineTo(x - cos * 0.5 + sin * 0.87, y - sin * 0.5 - cos * 0.87);
        }

        context.fill();
      }

      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
    };

    const loop = (now: number): void => {
      if (!started) started = now;
      draw((now - started) / 1000);
      if (running) frame = window.requestAnimationFrame(loop);
    };

    const start = (): void => {
      if (running || reduced.matches) return;
      running = true;
      frame = window.requestAnimationFrame(loop);
    };

    const stop = (): void => {
      running = false;
      window.cancelAnimationFrame(frame);
    };

    resize();
    draw(0);

    if (!reduced.matches) start();

    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible) start();
        else stop();
      },
      { threshold: 0 },
    );
    observer.observe(canvas);

    const onVisibility = (): void => {
      if (document.hidden) stop();
      else if (visible) start();
    };

    const onResize = (): void => {
      resize();
      draw(0);
    };

    const onMotionChange = (): void => {
      if (reduced.matches) {
        stop();
        draw(0);
      } else if (visible) {
        start();
      }
    };

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    reduced.addEventListener('change', onMotionChange);

    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onMotionChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full opacity-60 [mask-image:radial-gradient(70%_62%_at_66%_50%,#000_38%,rgba(0,0,0,0.55)_66%,transparent_100%)] md:opacity-100"
    />
  );
}
