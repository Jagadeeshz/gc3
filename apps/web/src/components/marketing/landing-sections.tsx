'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { PODS } from '@/lib/pods';

/**
 * The three sections the landing stage runs behind.
 *
 * Structure follows the reference: an intro with a typing prompt, a feature list and an
 * outlined headline; a product band with a sliding tab strip; and a third band that
 * cycles through three records with arrows and a ghosted preview.
 *
 * The content is ours. The reference's third band was testimonials from fictional
 * companies; those do not ship, so the same interaction cycles the three things a client
 * is actually buying — one owner, one pool, one record — each stated as a fact.
 */

const PROMPTS = [
  'Compose a pod for our Q3 brand campaign.',
  'Show the credit burn on the Growth pod this month.',
  'What is the commitment clock on my open requests?',
  'Draft a creative brief a specialist can start from.',
];

const RECORDS = [
  {
    label: 'ONE OWNER',
    title: 'A named manager, from the first request to the last invoice.',
    body: 'Escalation is a person rather than a mailbox, and that person scoped the pod, so nothing is explained twice.',
    meta: 'Every pod, every plan',
  },
  {
    label: 'ONE POOL',
    title: 'A published credit pool, replenished monthly.',
    body: 'Work draws from the pool and the pod absorbs the scheduling. No seats, no timesheets, no per-piece quotes.',
    meta: 'Published before the first request',
  },
  {
    label: 'ONE RECORD',
    title: 'Every request, deliverable and invoice, attributable.',
    body: 'The same rows the delivery team works from, scoped to your organisation and dated to the actor who touched them.',
    meta: 'Per tenant, in the portal',
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
          s.wait = 65;
        }
        timer = window.setTimeout(step, 38);
      } else {
        s.chars -= 2;
        if (s.chars <= 0) {
          s.chars = 0;
          s.deleting = false;
          s.i += 1;
          s.wait = 6;
        }
        setText(full.slice(0, Math.max(0, s.chars)));
        timer = window.setTimeout(step, 14);
      }
    };
    timer = window.setTimeout(step, 600);
    return () => window.clearTimeout(timer);
  }, [prompts]);

  return text;
}

export function LandingSections() {
  const typed = useTyping(PROMPTS);
  const [record, setRecord] = useState(0);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setTab((t) => (t + 1) % PODS.length), 2400);
    return () => window.clearInterval(id);
  }, []);

  const rec = RECORDS[record] ?? RECORDS[0]!;
  const next = RECORDS[(record + 1) % RECORDS.length] ?? RECORDS[0]!;

  return (
    <div className="nova-sections">
      {/* ---------------------------------------------------------- 1 · intro */}
      <section className="nova-section" aria-label="Introduction">
        <div className="nova-prompt">
          <span className="nova-prompt__tab">.</span>
          <div className="nova-prompt__box">
            <span className="nova-prompt__label">Ask for capability</span>
            <p className="nova-prompt__text">
              {typed}
              <span className="nova-caret" aria-hidden="true" />
            </p>
          </div>
          <p className="nova-prompt__next">Then: assign it, watch the clock, read the record.</p>
        </div>

        <ul className="nova-features" aria-label="What the pods cover">
          {['Creative', 'Growth', 'Strategy', 'Automation'].map((f) => (
            <li key={f}>{f}</li>
          ))}
          <li className="is-dim">And two more</li>
        </ul>

        <div className="nova-headline">
          <p className="nova-eyebrow">Capability, composed</p>
          <h1>
            <span className="nova-headline__line nova-headline__line--a">Your challenges</span>
            <span className="nova-headline__line nova-headline__line--b">Our solutions</span>
          </h1>
          <p className="nova-sub">
            One standing team around one outcome, on a published credit pool — sold as a subscription, not a scope.
          </p>
          <div className="nova-actions">
            <Link href="/pricing" className="nova-btn">
              See published pricing
              <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={2} />
            </Link>
            <Link href="/how-it-works" className="nova-btn nova-btn--ghost">
              How a pod starts
            </Link>
          </div>
        </div>

        <div className="nova-scroll" aria-hidden="true">
          <span>Scroll</span>
          <ArrowDown className="nova-scroll__arrow size-4" strokeWidth={1.8} />
        </div>
        <div className="nova-rule" aria-hidden="true" />
      </section>

      {/* -------------------------------------------------------- 2 · product */}
      <section className="nova-section nova-section--product" aria-label="The six pods">
        <div className="nova-tabs" role="list">
          {PODS.map((pod, i) => (
            <div
              key={pod.name}
              role="listitem"
              className={`nova-tab ${i === tab ? 'is-active' : ''} ${i < tab ? 'is-past' : ''}`}
            >
              <span className="nova-tab__num">{String(i + 1).padStart(2, '0')}</span>
              <span className="nova-tab__label">{pod.name}</span>
            </div>
          ))}
        </div>

        <div className="nova-product-copy">
          <p className="nova-dots" aria-hidden="true">··</p>
          <h2>
            <span className="nova-outline">Six pods</span>
            <span className="nova-outline nova-outline--b">One pool</span>
          </h2>
          <p className="nova-sub">
            Each pod is a standing team on a published credit pool. The higher pod carries the catalogues below it, so
            you buy the capability you need and never the stack.
          </p>
          <Link href="/pods" className="nova-btnnova">
            See all six pods
          </Link>
        </div>
      </section>

      {/* --------------------------------------------------------- 3 · record */}
      <section className="nova-section nova-section--record" aria-label="What you are buying">
        <div className="nova-record-head">
          <span className="nova-record-tag">What you are buying</span>
          <span className="nova-record-count">
            <span>{String(record + 1).padStart(2, '0')}</span>
            <span aria-hidden="true">/</span>
            <span>{String(RECORDS.length).padStart(2, '0')}</span>
          </span>
        </div>

        <div className="nova-record">
          <p className="nova-record-label">{rec.label}</p>
          <h2 className="nova-record-title">{rec.title}</h2>
          <p className="nova-record-body">{rec.body}</p>
          <p className="nova-record-meta">{rec.meta}</p>

          <div className="nova-record-nav">
            <button type="button" aria-label="Previous" onClick={() => setRecord((r) => (r - 1 + RECORDS.length) % RECORDS.length)}>
              <ArrowLeft aria-hidden className="size-4" strokeWidth={1.8} />
            </button>
            <button type="button" aria-label="Next" onClick={() => setRecord((r) => (r + 1) % RECORDS.length)}>
              <ArrowRight aria-hidden className="size-4" strokeWidth={1.8} />
            </button>
            <Link href="/why-a-pod" className="nova-record-link">Compare the three ways</Link>
          </div>
        </div>

        <p className="nova-ghost" aria-hidden="true">{next.title}</p>
      </section>
    </div>
  );
}
