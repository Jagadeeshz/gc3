/**
 * The Quantocos Q.
 *
 * Not a letter with a gradient painted on it — the actual mark is a ring whose stroke carries
 * the spectrum, broken at the lower right, with a chrome sphere sitting in the break as the
 * tail. Which is why the CSS glyph never looked right: a Q's tail is a stroke, and this one is
 * a ball.
 *
 * Drawn as SVG rather than assembled from divs because the stroke has to follow a curve and the
 * hue has to follow the curve with it. The ring is 36 short arcs, each in its own interpolated
 * spectrum colour, rather than one arc with a linear gradient: a linear gradient would run
 * left-to-right across the glyph, and the mark's whole character is that the hue turns with the
 * ring. Same technique as the hero field, for the same reason.
 *
 * Sizes are set by the caller; everything here is in a 48-unit box so it scales cleanly from a
 * 22px header mark to a 44px footer one.
 */

const SPECTRUM = [
  '#FF2200',
  '#FF8800',
  '#FFDD00',
  '#AAFF00',
  '#00DDAA',
  '#0099FF',
  '#3300FF',
  '#7B00FF',
];

const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
};

const STOPS = SPECTRUM.map(hexToRgb);

const colourAt = (fraction: number): string => {
  const position = ((fraction % 1) + 1) % 1 * STOPS.length;
  const from = STOPS[Math.floor(position) % STOPS.length]!;
  const to = STOPS[(Math.floor(position) + 1) % STOPS.length]!;
  const mix = position - Math.floor(position);

  return `rgb(${Math.round(from[0] + (to[0] - from[0]) * mix)},${Math.round(
    from[1] + (to[1] - from[1]) * mix,
  )},${Math.round(from[2] + (to[2] - from[2]) * mix)})`;
};

const SIZE = 48;
const CENTRE = SIZE / 2;
const RADIUS = 17;
const STROKE = 6.4;
const SEGMENTS = 36;

/** Degrees, screen coordinates (y down). The break sits at the lower right, as in the mark. */
const GAP_START = 20;
const GAP_END = 63;

/**
 * Hue is mapped from the absolute angle plus an offset, so red lands at the top right and the
 * sweep runs orange → yellow → green → teal → blue → violet clockwise back to red. Without the
 * offset the wheel sits wherever the arc happens to start, which put red at the bottom left.
 */
const HUE_OFFSET = 80;
const SWEEP = 360 - (GAP_END - GAP_START);

const pointAt = (degrees: number, radius: number): { x: number; y: number } => {
  const radians = (degrees * Math.PI) / 180;
  return { x: CENTRE + Math.cos(radians) * radius, y: CENTRE + Math.sin(radians) * radius };
};

const ARCS = Array.from({ length: SEGMENTS }, (_, index) => {
  const from = GAP_END + (SWEEP * index) / SEGMENTS;
  const to = GAP_END + (SWEEP * (index + 1)) / SEGMENTS;
  const start = pointAt(from, RADIUS);
  const end = pointAt(to, RADIUS);

  return {
    id: `q-arc-${index}`,
    d: `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${RADIUS} ${RADIUS} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    // hue advances with the ring, not with the segment index
    colour: colourAt((((from + to) / 2 + HUE_OFFSET) % 360) / 360),
  };
});

/** The sphere closes the break and sits a shade proud of the stroke, as in the mark. */
const TAIL = pointAt((GAP_START + GAP_END) / 2, RADIUS);

export function QuantocosQ({ size = 24, className }: { readonly size?: number; readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      fill="none"
      className={className}
    >
      {ARCS.map((arc) => (
        <path
          key={arc.id}
          d={arc.d}
          stroke={arc.colour}
          strokeWidth={STROKE}
          strokeLinecap="butt"
        />
      ))}

      <defs>
        <radialGradient id="q-sphere" cx="34%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="46%" stopColor="#EDF0F4" />
          <stop offset="100%" stopColor="#9FA8B4" />
        </radialGradient>
      </defs>

      {/* a hairline of void under the sphere keeps it from welding to the ring */}
      <circle cx={TAIL.x} cy={TAIL.y} r={8} fill="#080B12" opacity="0.95" />
      <circle cx={TAIL.x} cy={TAIL.y} r={7.2} fill="url(#q-sphere)" />
    </svg>
  );
}
