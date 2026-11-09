/**
 * Hero background: the prism aurora.
 *
 * A rotating conic prism masked to a soft disc, spectrum rings and a scatter of particles.
 * The figure group that briefly sat in front of it is gone; the hero carries type and light
 * only.
 *
 * The aurora — a rotating conic bloom, two spectrum rings and a scatter of
 * particles — held at low opacity so it reads as light on the figures rather than as a second
 * subject competing with them.
 *
 * Everything animates on transform and opacity only, so nothing here triggers layout. All of
 * it is decoration and aria-hidden; reduced motion freezes the rings instead of removing them.
 */

const PARTICLES = Array.from({ length: 26 }, (_, index) => {
  const angle = (index * 137.508 * Math.PI) / 180; // golden angle: even spread, no clumps
  const radius = 150 + (index % 6) * 52;
  const size = 1.4 + (index % 4) * 0.6;
  const hue = ['#7B00FF', '#3300FF', '#0055FF', '#0099FF', '#00DDAA', '#AAFF00', '#FFDD00', '#FF8800', '#FF2200'][index % 9];

  return {
    left: `${50 + Math.cos(angle) * (radius / 5.4)}%`,
    top: `${50 + Math.sin(angle) * (radius / 6.2)}%`,
    size: `${size}px`,
    colour: hue,
    delay: `${(index % 9) * 0.55}s`,
    duration: `${8 + (index % 5) * 1.8}s`,
    drift: `${index % 2 === 0 ? -1 : 1}`,
  };
});

const RINGS = [
  { size: 'clamp(340px, 44vw, 600px)', duration: '66s', opacity: 0.34 },
  { size: 'clamp(440px, 58vw, 780px)', duration: '94s', opacity: 0.2 },
] as const;

export function HeroAurora() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* prism bloom — teal, warm, violet. Low enough that the marble stays the subject. */}
      <div className="absolute inset-0 [background:radial-gradient(42%_40%_at_68%_46%,rgba(0,221,170,0.10),transparent_72%)]" />
      <div className="absolute inset-0 [background:radial-gradient(32%_30%_at_82%_66%,rgba(255,136,0,0.07),transparent_74%)]" />
      <div className="absolute inset-0 [background:radial-gradient(34%_32%_at_56%_72%,rgba(123,0,255,0.08),transparent_74%)]" />

      {/* desktop: the workforce, aurora behind it */}
      <div className="absolute right-[1%] top-1/2 hidden -translate-y-1/2 lg:block">
        <div className="relative aspect-square w-[clamp(380px,50vw,700px)]">
          <div className="aurora-core absolute inset-[10%] rounded-full opacity-[0.13]" />

          {RINGS.map((ring) => (
            <div key={ring.size} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div
                className="aurora-ring rounded-full"
                style={{ width: ring.size, height: ring.size, animationDuration: ring.duration, opacity: ring.opacity }}
              />
            </div>
          ))}

          {PARTICLES.map((particle, index) => (
            <span
              key={index}
              className="aurora-particle absolute rounded-full"
              style={{
                left: particle.left,
                top: particle.top,
                width: particle.size,
                height: particle.size,
                background: particle.colour,
                animationDelay: particle.delay,
                animationDuration: particle.duration,
                ['--drift' as string]: particle.drift,
              }}
            />
          ))}

        </div>
      </div>

      {/* mobile: the bloom alone — the figure group is gone from the composition, so the
          phone keeps only the light behind the type */}
      <div className="absolute inset-0 lg:hidden">
        <div className="aurora-core absolute left-1/2 -top-10 aspect-square w-[clamp(300px,92vw,460px)] -translate-x-1/2 rounded-full opacity-30" />
      </div>
    </div>
  );
}
