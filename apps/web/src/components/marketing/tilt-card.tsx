'use client';

import { useCallback, useRef, type ElementType, type ReactNode } from 'react';

/**
 * A card that tilts toward the pointer.
 *
 * The motion is written straight to CSS custom properties on the element — no React
 * state, no re-render per pointer event. A mousemove handler that calls setState is how
 * a "premium" card ends up feeling worse than a static one on a modest laptop.
 *
 * `--tilt-x` / `--tilt-y` drive the rotation, `--mx` / `--my` drive a radial highlight
 * that follows the cursor (see `.tilt-surface` in globals.css). Everything is a
 * transform and an opacity, so it stays on the compositor.
 *
 * Reduced motion is handled in CSS, not here: the media query overrides the transform,
 * which also covers a user who changes the setting mid-session.
 */

interface TiltCardProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly as?: ElementType;
  /** Maximum rotation in degrees at the card's edge. */
  readonly max?: number;
}

export function TiltCard({ children, className = '', as: Tag = 'div', max = 5 }: TiltCardProps) {
  const ref = useRef<HTMLElement | null>(null);

  const reset = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const el = ref.current;
      if (!el) return;

      // Touch has no hover: a tilt under a finger is just a jitter.
      if (event.pointerType !== 'mouse') return;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;

      el.style.setProperty('--tilt-y', `${(x - 0.5) * max * 2}deg`);
      el.style.setProperty('--tilt-x', `${(0.5 - y) * max * 2}deg`);
      el.style.setProperty('--mx', `${(x * 100).toFixed(2)}%`);
      el.style.setProperty('--my', `${(y * 100).toFixed(2)}%`);
    },
    [max],
  );

  return (
    <Tag
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      onBlur={reset}
      className={`tilt-surface ${className}`}
    >
      {children}
    </Tag>
  );
}
