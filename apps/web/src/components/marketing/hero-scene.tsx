import { Fragment } from 'react';

/**
 * The hero's isometric scene.
 *
 * A drawn pod rig: platform, gantry, containers, specialists and agents, with four
 * hotspots that name the parts of the model on hover. Everything is SVG strokes and
 * CSS transforms — no images, no canvas, no animation library, nothing to hydrate.
 *
 * Deliberately drawn rather than photographed: GC³ sells a composed team, and a
 * line-art cutaway shows the composition in a way a stock photo of people cannot.
 *
 * Motion (see globals.css):
 *   .bob        — tokens breathing on their stanchions
 *   .dash-flow  — signals travelling the connections
 *   .drift      — the whole rig settling against the grid
 * All are gated behind prefers-reduced-motion; the drawing is complete without them.
 */

const HOTSPOTS = [
  {
    id: 'manager',
    x: 300,
    y: 232,
    label: 'Manager',
    body: 'One owner, accountable for the outcome. Does not rotate per ticket.',
  },
  {
    id: 'specialist',
    x: 520,
    y: 300,
    label: 'Specialist',
    body: 'A named human specialist on a standing pod — not a queue assignment.',
  },
  {
    id: 'agent',
    x: 700,
    y: 236,
    label: 'Paired agent',
    body: 'One supervised agent per specialist. The pairing is the control.',
  },
  {
    id: 'credits',
    x: 880,
    y: 300,
    label: 'Credit pool',
    body: '120 / 240 / 360 credits a month, scoped before work starts.',
  },
] as const;

/** A token on a stanchion: the unit of the hybrid workforce. */
function Token({
  x,
  y,
  label,
  face,
  delay,
}: {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly face: 'human' | 'agent';
  readonly delay: number;
}) {
  const stroke = face === 'human' ? '#94a3b8' : '#34d399';
  const fill = face === 'human' ? 'transparent' : 'rgba(52,211,153,0.08)';

  return (
    <g transform={`translate(${x} ${y})`}>
      {/* stanchion */}
      <line x1="0" y1="0" x2="0" y2="34" stroke="#1e293b" strokeWidth="1" />
      <ellipse cx="0" cy="36" rx="13" ry="4" fill="rgba(30,41,59,0.7)" />

      <g className="bob" style={{ animationDelay: `${delay}s` }}>
        <path
          d="M0 -26 L22 -14 L22 12 L0 24 L-22 12 L-22 -14 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {face === 'human' ? (
          <>
            <circle cx="0" cy="-6" r="4.5" stroke={stroke} strokeWidth="1.2" fill="none" />
            <path d="M-7 8 Q0 0 7 8" stroke={stroke} strokeWidth="1.2" fill="none" />
          </>
        ) : (
          <>
            <rect x="-7" y="-9" width="14" height="11" rx="2.5" stroke={stroke} strokeWidth="1.2" fill="none" />
            <circle cx="-3" cy="-3.5" r="1.1" fill={stroke} />
            <circle cx="3" cy="-3.5" r="1.1" fill={stroke} />
            <line x1="0" y1="-16" x2="0" y2="-9" stroke={stroke} strokeWidth="1.2" />
            <circle cx="0" cy="-17.5" r="1.4" fill={stroke} />
          </>
        )}
      </g>

      <text
        x="0"
        y="52"
        textAnchor="middle"
        fill="#64748b"
        fontSize="8"
        fontFamily="ui-monospace, monospace"
        letterSpacing="1.2"
      >
        {label}
      </text>
    </g>
  );
}

export function HeroScene() {
  return (
    <div className="pointer-events-none absolute right-0 top-0 hidden h-[600px] w-[64%] overflow-hidden lg:block" aria-hidden="true">
      <div className="absolute inset-0 opacity-[0.95]">
        <svg viewBox="0 0 1200 520" className="h-full w-full" preserveAspectRatio="xMidYMax meet">
          <defs>
            <linearGradient id="rig-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8eef7" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#e8eef7" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Isometric floor: two families of hairlines, drifting very slowly. */}
          <g className="drift" stroke="#1e293b" strokeWidth="0.8" opacity="0.75">
            {Array.from({ length: 13 }, (_, index) => (
              <line key={`a${index}`} x1={120 + index * 84} y1="300" x2={-180 + index * 84} y2="520" />
            ))}
            {Array.from({ length: 9 }, (_, index) => (
              <line key={`b${index}`} x1={-180 + index * 84} y1="300" x2={120 + index * 84} y2="520" />
            ))}
          </g>

          <g transform="translate(0 26)">
            {/* ------------------------------------------------------------------ rig */}
            {/* deck */}
            <path
              d="M300 250 L560 190 L820 250 L560 310 Z"
              fill="rgba(14,21,35,0.85)"
              stroke="#334155"
              strokeWidth="1.3"
            />
            <path d="M300 250 L560 310 L560 336 L300 276 Z" fill="rgba(9,13,22,0.95)" stroke="#1e293b" strokeWidth="1.1" />
            <path d="M820 250 L560 310 L560 336 L820 276 Z" fill="rgba(9,13,22,0.95)" stroke="#1e293b" strokeWidth="1.1" />

            {/* gantry */}
            <g stroke="#334155" strokeWidth="1.3" fill="none">
              <path d="M470 236 L470 120 L650 120 L650 236" />
              <path d="M500 120 L500 96 L620 96 L620 120" />
              <path d="M540 96 L540 70 L580 70 L580 96" />
            </g>
            <rect x="525" y="52" width="70" height="18" rx="3" fill="rgba(52,211,153,0.1)" stroke="#34d399" strokeWidth="1.2" />

            {/* container modules on the deck */}
            <g stroke="#334155" strokeWidth="1.2" fill="rgba(11,17,28,0.95)">
              <path d="M380 236 L440 222 L500 236 L440 250 Z" />
              <path d="M380 236 L440 250 L440 274 L380 260 Z" />
              <path d="M500 236 L440 250 L440 274 L500 260 Z" />

              <path d="M620 236 L680 222 L740 236 L680 250 Z" />
              <path d="M620 236 L680 250 L680 274 L620 260 Z" />
              <path d="M740 236 L680 250 L680 274 L740 260 Z" />
            </g>

            {/* service lane markings */}
            <g stroke="#1e293b" strokeWidth="1" strokeDasharray="4 8">
              <line x1="470" y1="284" x2="650" y2="284" />
              <line x1="460" y1="296" x2="660" y2="296" />
            </g>

            {/* connections with travelling signals */}
            <g stroke="#1e293b" strokeWidth="1.1" fill="none">
              <path d="M300 232 C 380 210, 440 250, 520 300" />
              <path d="M520 300 C 600 320, 660 280, 700 236" />
              <path d="M700 236 C 780 260, 840 290, 880 300" />
              <path d="M470 200 C 520 190, 620 190, 650 200" />
            </g>
            <g stroke="#34d399" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.75">
              <path className="dash-flow" d="M300 232 C 380 210, 440 250, 520 300" />
              <path className="dash-flow" style={{ animationDelay: '1.4s' }} d="M520 300 C 600 320, 660 280, 700 236" />
              <path className="dash-flow" style={{ animationDelay: '2.8s' }} d="M700 236 C 780 260, 840 290, 880 300" />
            </g>

            {/* workforce tokens */}
            <Token x={300} y={232} label="MANAGER" face="human" delay={0} />
            <Token x={520} y={300} label="SPECIALIST" face="human" delay={0.7} />
            <Token x={700} y={236} label="PAIRED AGENT" face="agent" delay={1.4} />
            <Token x={880} y={300} label="CREDIT POOL" face="agent" delay={2.1} />

            {/* hotspots: keyboard-reachable, tooltip on hover or focus */}
            {HOTSPOTS.map((spot) => (
              <g key={spot.id} className="hero-hotspot pointer-events-auto" tabIndex={0} role="note" aria-label={`${spot.label}. ${spot.body}`}>
                <circle cx={spot.x} cy={spot.y - 44} r="11" fill="transparent" />
                <circle
                  cx={spot.x}
                  cy={spot.y - 44}
                  r="3.2"
                  fill="#34d399"
                  className="pulse-dot"
                  style={{ animationDelay: `${spot.x % 7 * 0.3}s` }}
                />
                <circle cx={spot.x} cy={spot.y - 44} r="8" fill="none" stroke="#34d399" strokeWidth="0.8" opacity="0.35" />

                <g
                  className="tip"
                  transform={`translate(${spot.x + 16} ${spot.y - 92})`}
                >
                  <rect width="212" height="52" rx="8" fill="rgba(9,13,22,0.97)" stroke="#1e293b" />
                  <rect width="212" height="52" rx="8" fill="none" stroke="#34d399" strokeOpacity="0.25" />
                  <text x="12" y="19" fill="#e8eef7" fontSize="9.5" fontFamily="ui-monospace, monospace" letterSpacing="1.3">
                    {spot.label.toUpperCase()}
                  </text>
                  <foreignObject x="12" y="24" width="188" height="24">
                    <p className="m-0 text-[8.5px] leading-[1.35] text-slate-400">{spot.body}</p>
                  </foreignObject>
                </g>
              </g>
            ))}
          </g>

          {/* ground haze so the rig sits in space rather than floating */}
          <rect x="0" y="380" width="1200" height="140" fill="url(#rig-fade)" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}
