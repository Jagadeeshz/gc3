'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

/**
 * The path a client takes, as a ribbon.
 *
 * The layout idea comes from a stock infographic the client supplied — a winding path with stages on
 * it. Nothing else does: that template's ground was near-white, its callouts were lorem, and its
 * people were cutout stock photography, none of which belongs on this site. What is kept is the
 * serpentine, rebuilt as SVG so it is sharp at any width and carries our own four steps.
 *
 * The numbered markers are drawn *inside* the SVG, on the path, rather than positioned in CSS beside
 * it. That is the difference between a ribbon that threads its stages and one that merely passes
 * behind them: a marker can't drift from the curve, because both come from the same coordinates.
 */

const STEPS = [
  {
    n: '01',
    title: 'A scoping conversation',
    body: 'Thirty minutes on the outcome, not the org chart. We size the pod from what has to ship, not from a rate card.',
  },
  {
    n: '02',
    title: 'Your pod and your pool',
    body: 'A named pod, a published credit pool and a commitment per priority, agreed before the first request.',
  },
  {
    n: '03',
    title: 'Meet the pod manager',
    body: 'The manager who owns the account is introduced before work starts, and stays accountable for the output.',
  },
  {
    n: '04',
    title: 'Go live in the portal',
    body: 'The subscription, the roster and the queue are already in place. The first request ships from it.',
  },
] as const;

/** markers sit on the path; the card below each one is the same column of the grid */
const NODES = [
  { x: 150, y: 180, n: '01' },
  { x: 450, y: 70, n: '02' },
  { x: 750, y: 180, n: '03' },
  { x: 1050, y: 70, n: '04' },
] as const;

const PATH =
  'M -30 190 C 60 190 92 180 150 180 S 390 70 450 70 S 690 180 750 180 S 990 70 1050 70 S 1170 78 1230 74';

export function JourneyRibbon() {
  return (
    <section className="jr" aria-label="How a pod starts">
      <div className="nova-shell">
        <div className="jr__head">
          <p className="jr__eyebrow">From first call</p>
          <h2 className="jr__title">A path, not a procurement cycle.</h2>
          <p className="jr__lede">
            No statement of work for each piece of work. The pod is composed once against the outcome,
            and everything after that moves through it as requests.
          </p>
        </div>

        <div className="jr__track">
          <svg
            className="jr__ribbon"
            viewBox="0 0 1200 240"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient id="jr-prism" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#3300ff" />
                <stop offset="32%" stopColor="#0055ff" />
                <stop offset="62%" stopColor="#00bfff" />
                <stop offset="86%" stopColor="#00ddaa" />
                <stop offset="100%" stopColor="#b4ffe6" />
              </linearGradient>
            </defs>

            <path d={PATH} fill="none" stroke="url(#jr-prism)" strokeWidth="26" strokeLinecap="round" opacity="0.3" />
            <path d={PATH} fill="none" stroke="url(#jr-prism)" strokeWidth="2" strokeLinecap="round" opacity="0.9" />

            {NODES.map((node) => (
              <g key={node.x}>
                <circle cx={node.x} cy={node.y} r="19" fill="#0d0c11" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
                <text
                  x={node.x}
                  y={node.y + 4}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12"
                  fontFamily="ui-monospace, monospace"
                  letterSpacing="0.5"
                >
                  {node.n}
                </text>
              </g>
            ))}

            <circle r="4" fill="#eaf6ff">
              <animateMotion dur="10s" repeatCount="indefinite" path={PATH} />
            </circle>
          </svg>

          <ol className="jr__steps">
            {STEPS.map((s) => (
              <li key={s.n} className="jr__step">
                {/* the numbers live inside the ribbon on desktop; on a phone the ribbon is gone,
                    so the marker is restated as a plain label or the sequence disappears */}
                <span className="jr__step-n" aria-hidden="true">
                  {s.n}
                </span>
                <h3 className="jr__step-title">{s.title}</h3>
                <p className="jr__step-body">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="jr__foot">
          <p>Four steps, and the queue is live on the last one.</p>
          <Link href="/how-it-works" className="jr__link">
            See the full path
            <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.9} />
          </Link>
        </div>
      </div>
    </section>
  );
}
