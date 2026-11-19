'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

/**
 * The three bands the stage runs behind.
 *
 * Editorial rather than decorative: one headline, one lede, two actions, and a strip of
 * four numbers. The reference's guide lines, pinned feature list and outlined headline
 * boxes were replaced because they carried no information — a front page has to read on
 * hierarchy and restraint, not ornament.
 *
 * One band over the stage now. The catalogue and the three commitments were removed at the
 * client's request, so the hero carries the proposition and the scrolling figures, and the
 * sections below carry the evidence.
 */

const PROMPTS = [
  'Compose a pod for our Q3 brand campaign.',
  'Show the credit burn on the Growth pod.',
  'What is the commitment clock on my open requests?',
];

const FACTS = [
  { label: 'Capability pods', value: '6' },
  { label: 'Entry price', value: '$3,000' },
  { label: 'Clients per pod', value: '3 max' },
  { label: 'Commitments', value: '8–168h' },
];

function useTyping(prompts: readonly string[]) {
  const [text, setText] = useState('');
  const state = useRef({ i: 0, chars: 0, deleting: false, wait: 0 });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setText(prompts[0] ?? '');
      return;
    }
    let timer = 0;
    const step = () => {
      const s = state.current;
      const full = prompts[s.i % prompts.length] ?? '';
      if (s.wait > 0) {
        s.wait -= 1;
        timer = window.setTimeout(step, 40);
        return;
      }
      if (!s.deleting) {
        s.chars += 1;
        setText(full.slice(0, s.chars));
        if (s.chars >= full.length) {
          s.deleting = true;
          s.wait = 70;
        }
        timer = window.setTimeout(step, 40);
      } else {
        s.chars -= 2;
        if (s.chars <= 0) {
          s.chars = 0;
          s.deleting = false;
          s.i += 1;
          s.wait = 8;
        }
        setText(full.slice(0, Math.max(0, s.chars)));
        timer = window.setTimeout(step, 16);
      }
    };
    timer = window.setTimeout(step, 700);
    return () => window.clearTimeout(timer);
  }, [prompts]);

  return text;
}

export function LandingSections() {
  const typed = useTyping(PROMPTS);

  return (
    <div className="nova-sections">
      {/* ------------------------------------------------------------ hero */}
      <section className="nh" aria-label="Introduction">
        <div className="nova-shell nh__grid">
          <div>
            <p className="nh__eyebrow">Quantocos · capability pods</p>
            <h1 className="nh__title">
              Your challenges.
              <span>Our solutions.</span>
            </h1>
            <p className="nh__lede">
              One standing team composed around one outcome, on a published credit pool — sold as a
              subscription rather than a scope, with the manager named before the first request.
            </p>
            <div className="nh__actions">
              <Link href="/pricing" className="nh__btn">
                See published pricing
                <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={2} />
              </Link>
              <Link href="/how-it-works" className="nh__btn nh__btn--ghost">
                How a pod starts
              </Link>
            </div>
          </div>

          <div className="nh__console-wrap">
          <aside className="nh__console" aria-label="Example request">
            <div className="nh__console-head">
              <span>Request</span>
              <span className="nh__console-dot">Routing</span>
            </div>
            <p className="nh__console-text">
              {typed}
              <span className="nh__caret" aria-hidden="true" />
            </p>
            <p className="nh__console-meta">Routed to the Growth pod · owner named on day one</p>
          </aside>
          </div>
        </div>

        <div className="nh__ticker" aria-label="Key figures">
          <div className="nh__ticker-track">
            {[...FACTS, ...FACTS].map((f, i) => (
              <span key={`${f.label}-${i}`} className="nh__ticker-item" aria-hidden={i >= FACTS.length}>
                <span className="nh__ticker-label">{f.label}</span>
                <span className="nh__ticker-value">{f.value}</span>
              </span>
            ))}
          </div>
        </div>

      </section>

    </div>
  );
}
