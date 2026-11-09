/**
 * Hero background: the pod workforce standing in the void.
 *
 * The artwork is a keyed cutout of a marble figure group — a manager, specialists, and the
 * paired agent at the laptop — so the hero shows the thing being sold rather than an abstract
 * shape. The key was done offline in key-workforce.py: brightness × inverse-saturation, then
 * a morphological opening to drop the neon bars, then a crop at the plinth line to remove the
 * wordmark, the glass pedestals and the floor reflection.
 *
 * Around it runs the prism aurora — a rotating conic bloom, two spectrum rings and a scatter of
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
      <div className="absolute right-[5%] top-[47%] hidden -translate-y-1/2 lg:block">
        <div className="relative aspect-square w-[clamp(380px,50vw,700px)]">
          <div className="aurora-core absolute inset-[8%] rounded-full opacity-[0.22]" />

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

          {/* The figures sit in front of the aurora, masked at the base so the cutout dissolves
              into the void instead of ending on a hard line. */}
          <img
            src="/images/gc3-pod-workforce.png"
            alt=""
            width={796}
            height={484}
            loading="eager"
            decoding="async"
            className="absolute bottom-[3%] left-1/2 w-[92%] max-w-none -translate-x-1/2 [filter:drop-shadow(0_24px_60px_rgba(0,0,0,0.65))] [mask-image:linear-gradient(to_bottom,#000_78%,transparent_100%)]"
          />
        </div>
      </div>

      {/* mobile: the group at reduced scale, no rings and no particles — a 600px orbit on a
          phone is noise behind the type */}
      <div className="absolute inset-x-0 bottom-0 lg:hidden">
        <div className="relative mx-auto w-[112%] max-w-none translate-x-[2%]">
          <div className="aurora-core absolute inset-x-[12%] top-8 aspect-square rounded-full opacity-[0.18]" />
          <img
            src="/images/gc3-pod-workforce.png"
            alt=""
            width={796}
            height={484}
            loading="eager"
            decoding="async"
            className="relative w-full opacity-55 [mask-image:linear-gradient(to_bottom,#000_66%,transparent_100%)]"
          />
          {/* Scrim: at phone width the act links sit over the marble, so the artwork has to
              give way rather than the type losing contrast. */}
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-obsidian via-obsidian/85 to-transparent" />
        </div>
      </div>
    </div>
  );
}
