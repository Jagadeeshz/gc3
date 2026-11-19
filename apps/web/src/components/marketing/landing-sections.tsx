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
 * The catalogue band states every pod with its real pool and composition, and the record
 * band states the three commitments. No testimonials: the reference cycled quotes from
 * fictional companies.
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

const RECORDS = [
  {
    label: 'One owner',
    title: 'A named manager, start to invoice.',
    body: 'Escalation is a person rather than a mailbox, and that person scoped the pod — so nothing has to be explained twice.',
  },
  {
    label: 'One pool',
    title: 'A published credit pool, monthly.',
    body: 'Work draws from the pool and the pod absorbs the scheduling. No seats, no timesheets, no per-piece quotes.',
  },
  {
    label: 'One record',
    title: 'Every request and invoice, attributable.',
    body: 'The same rows the delivery team works from, scoped to your organisation and dated to the actor who touched them.',
  },
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

      {/* ---------------------------------------------------------- record */}
      <section className="nr" aria-label="What you are buying">
        <div className="nova-shell">
          <div className="nr__head">
            <div>
              <p className="nc__label">What you are buying</p>
              <h2 className="nr__title">Three commitments.</h2>
            </div>
          </div>

          <div className="nr__ticker" aria-label="What a subscription buys">
          <div className="nr__ticker-track">
              {[0, 1, 2].map((i) => (
                <span key={i} aria-hidden={i > 0}>
                  Not a rate card and not a retainer. These three are what a subscription actually buys, and
                  each one is visible in the portal from the first week.
                  <em aria-hidden="true"> · </em>
                </span>
              ))}
            </div>
          </div>

          <div className="nr__grid">
            {RECORDS.map((r) => (
              <div key={r.label} className="nr__cell">
                <p className="nr__label">{r.label}</p>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </div>
            ))}
          </div>

          <div className="nr__foot">
            <p>Up to three clients per pod · never more</p>
            <Link href="/why-a-pod" className="nc__link">
              Compare the three ways
              <ArrowUpRight aria-hidden className="size-3" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
