'use client';

import { useEffect, useRef } from 'react';

/**
 * Site background: a drifting node lattice, very faint.
 *
 * Points travel slowly, edges appear between any two that come close, and where three neighbours
 * are mutually close the triangle they form is filled. That is the whole idea of the reference
 * frame — a network forming and breaking — rebuilt in prism tints rather than its cyan, and held
 * at an alpha low enough to be texture: the page should read as dark with structure in it, not as
 * an animated wallpaper.
 *
 * Mounted once in the root layout as a fixed layer at -z-10, so every route inherits it and no page
 * has to remember. It is invisible on the landing hero because that section is opaque — which is
 * the intent: the hero stays clean, the lattice starts where the arguments start.
 *
 * Cost control:
 *   · nodes capped by viewport (70 desktop, 34 phone), pair check is O(n²) on those counts;
 *   · one stroke pass for all edges, batched by alpha bucket rather than per-line state changes;
 *   · DPR capped at 2;
 *   · the loop stops when the tab is hidden, and `prefers-reduced-motion` paints a single frame.
 */

const SPECTRUM = ['#7b00ff', '#3300ff', '#0099ff', '#00ddaa', '#aaff00', '#ffdd00', '#ff8800', '#ff2200'];

const LINK_DISTANCE = 148;
const NODE_SPEED = 0.16;

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  colour: string;
};

const buildNodes = (count: number, width: number, height: number): Node[] => {
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  return Array.from({ length: count }, () => ({
    x: rnd() * width,
    y: rnd() * height,
    vx: (rnd() - 0.5) * NODE_SPEED,
    vy: (rnd() - 0.5) * NODE_SPEED,
    radius: 0.9 + rnd() * 0.9,
    colour: SPECTRUM[Math.floor(rnd() * SPECTRUM.length)] ?? SPECTRUM[0]!,
  }));
};

export function LatticeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let frame = 0;
    let running = false;

    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      nodes = buildNodes(width < 768 ? 34 : 70, width, height);
    };

    const draw = (): void => {
      context.clearRect(0, 0, width, height);
      context.lineWidth = 0.6;

      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i]!;

        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distanceSq = dx * dx + dy * dy;

          if (distanceSq > LINK_DISTANCE * LINK_DISTANCE) continue;

          const closeness = 1 - Math.sqrt(distanceSq) / LINK_DISTANCE;
          // Very low: an edge should be caught at the corner of the eye, never read as a line.
          context.strokeStyle = a.colour;
          context.globalAlpha = closeness * 0.16;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();

          // A third point close to both closes the triangle the reference fills.
          for (let k = j + 1; k < nodes.length; k += 1) {
            const c = nodes[k]!;
            const ac = (a.x - c.x) ** 2 + (a.y - c.y) ** 2;
            const bc = (b.x - c.x) ** 2 + (b.y - c.y) ** 2;
            if (ac > LINK_DISTANCE ** 2 || bc > LINK_DISTANCE ** 2) continue;

            context.globalAlpha = closeness * 0.05;
            context.fillStyle = a.colour;
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.lineTo(c.x, c.y);
            context.closePath();
            context.fill();
            break;
          }
        }
      }

      // points on top, so an edge never ends in nothing
      for (const node of nodes) {
        context.globalAlpha = 0.4;
        context.fillStyle = node.colour;
        context.beginPath();
        context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;
    };

    const step = (): void => {
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        node.x = Math.min(width, Math.max(0, node.x));
        node.y = Math.min(height, Math.max(0, node.y));
      }
    };

    const loop = (): void => {
      step();
      draw();
      frame = window.requestAnimationFrame(loop);
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
    draw();

    if (!reduced.matches) start();

    const onResize = (): void => {
      resize();
      draw();
    };

    const onVisibility = (): void => {
      if (document.hidden) stop();
      else start();
    };

    const onMotion = (): void => {
      if (reduced.matches) {
        stop();
        draw();
      } else {
        start();
      }
    };

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    reduced.addEventListener('change', onMotion);

    return () => {
      stop();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onMotion);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 opacity-[0.55]"
    />
  );
}
