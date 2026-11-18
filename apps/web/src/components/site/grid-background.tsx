/**
 * The site ground.
 *
 * One fixed, non-interactive layer behind every route: a 48px architectural
 * grid plus two very large ambient washes, one gold and one neutral, drifting
 * slowly. It replaces the drifting node lattice — the grid is the same idea at a
 * fraction of the cost, and a grid is what the glass surfaces want to sit on.
 *
 * Rendering rules:
 *  · the washes animate only `transform` and `opacity`, so they stay on the
 *    compositor and never trigger layout;
 *  · both stop dead under prefers-reduced-motion (handled in globals.css by
 *    targeting the same class names);
 *  · opaque sections paint over it, which is how the hero stays clean.
 */
export function GridBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void">
      {/* 48px grid */}
      <div className="blueprint absolute inset-0 opacity-[0.5]" />

      {/* Ambient washes: gold and graphite, drifting slowly in opposite directions. */}
      <div className="site-wash site-wash--gold absolute -left-[18%] -top-[22%] size-[70vw] rounded-full" />
      <div className="site-wash site-wash--graphite absolute -bottom-[28%] -right-[16%] size-[62vw] rounded-full [animation-delay:-14s]" />

      {/* Vignette so the grid fades at the edges rather than stopping at them. */}
      <div className="absolute inset-0 [background:radial-gradient(120%_90%_at_50%_0%,transparent_35%,rgba(13,12,17,0.65)_100%)]" />
    </div>
  );
}
