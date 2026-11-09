/**
 * Hero background: an orbital sphere built from the prism palette.
 *
 * The reference is a particle sphere with rings and a bloom. Two deliberate departures:
 *
 *  - Colour is the raga spectrum, not blue/violet. The hue run is spread across the sphere,
 *    the rings and the particles so no single colour dominates the way the reference's blue
 *    does.
 *  - It is CSS only: one conic gradient, masked rings and ~36 dots animated with transform
 *    and opacity. No canvas, no WebGL, no image asset to download — the whole layer is a few
 *    KB and stays on the compositor, which is what keeps a hero painting at 60fps on a
 *    laptop with no discrete GPU.
 *
 * Everything is aria-hidden decoration. Reduced motion freezes it to a still frame rather
 * than removing it, so the composition does not collapse for those users.
 */

/** Deterministic scatter — seeded from the index, so server and client render identically. */
const PARTICLES = Array.from({ length: 34 }, (_, index) => {
  const angle = (index * 137.508 * Math.PI) / 180; // golden angle: even spread, no clumps
  const radius = 120 + (index % 7) * 46;
  const size = 1.5 + (index % 4) * 0.7;
  const hue = ['#7B00FF', '#3300FF', '#0055FF', '#0099FF', '#00DDAA', '#AAFF00', '#FFDD00', '#FF8800', '#FF2200'][index % 9];

  return {
    left: `${50 + Math.cos(angle) * (radius / 6)}%`,
    top: `${50 + Math.sin(angle) * (radius / 6)}%`,
    size: `${size}px`,
    colour: hue,
    delay: `${(index % 11) * 0.42}s`,
    duration: `${7 + (index % 6) * 1.6}s`,
    drift: `${index % 2 === 0 ? -1 : 1}`,
  };
});

const RINGS = [
  { size: 'clamp(320px, 46vw, 620px)', duration: '54s', opacity: 0.5 },
  { size: 'clamp(420px, 62vw, 820px)', duration: '78s', opacity: 0.32 },
  { size: 'clamp(520px, 78vw, 1040px)', duration: '112s', opacity: 0.22 },
] as const;

export function HeroAurora() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* bloom: three raga washes so the sphere glows without a single dominant hue */}
      <div className="absolute inset-0 [background:radial-gradient(38%_34%_at_72%_30%,rgba(0,221,170,0.10),transparent_70%)]" />
      <div className="absolute inset-0 [background:radial-gradient(30%_28%_at_84%_58%,rgba(255,136,0,0.07),transparent_72%)]" />
      <div className="absolute inset-0 [background:radial-gradient(34%_30%_at_58%_74%,rgba(123,0,255,0.08),transparent_74%)]" />

      {/* the sphere itself: a rotating conic prism, masked to a soft disc */}
      <div className="aurora-stage absolute right-[-6%] top-1/2 hidden -translate-y-1/2 lg:block">
        <div className="relative aspect-square w-[clamp(360px,52vw,720px)]">
          <div className="aurora-core absolute inset-0 rounded-full" />
          <div className="absolute inset-[14%] rounded-full [background:radial-gradient(closest-side,rgba(8,11,18,0.92)_38%,rgba(8,11,18,0.55)_68%,transparent_100%)]" />

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

      {/* mobile: keep the bloom and the particles, drop the rings — a 620px sphere on a phone
          is just a bright smudge behind the type */}
      <div className="absolute inset-0 lg:hidden">
        <div className="aurora-core absolute left-1/2 -top-10 aspect-square w-[clamp(300px,92vw,460px)] -translate-x-1/2 rounded-full opacity-40" />
      </div>
    </div>
  );
}
