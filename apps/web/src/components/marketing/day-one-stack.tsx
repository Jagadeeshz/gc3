import { Check } from 'lucide-react';

/**
 * "What you have on day one", as a scroll-stacked deck.
 *
 * The pattern from the motion-site references: each card pins near the top of
 * the viewport at a slightly deeper offset than the last, so scrolling hands one
 * card off to the next instead of sliding a grid past the reader. Depth is CSS
 * only — a view() timeline shrinks and dims a card as it leaves — so there is no
 * scroll listener, no animation library, and the section still reads as a plain
 * list where `position: sticky` or `animation-timeline` is unsupported.
 */

type Card = {
  title: string;
  body: string;
  meta: string;
};

const DAY_ONE: readonly Card[] = [
  {
    title: 'A workspace that is already populated',
    body: 'The subscription, the pod roster and the request queue exist before you sign in. Nothing is configured per client, and nothing is empty on the first morning.',
    meta: 'Day one',
  },
  {
    title: 'One manager with the account',
    body: 'The manager who scoped the pod runs it. Escalation is a name, not a mailbox, and the person answering already knows what the outcome is meant to be.',
    meta: 'Named',
  },
  {
    title: 'Commitments attached to work',
    body: 'Every request carries its window — urgent 8 hours through low 168 hours — and shows when it is at risk before it breaches, not after.',
    meta: 'Measured',
  },
  {
    title: 'Records you can hand to finance',
    body: 'Invoices, deliverables and approvals are per tenant, dated, and attributable to the person who acted. Nothing has to be reconciled from email.',
    meta: 'Per tenant',
  },
];

export function DayOneStack() {
  return (
    <ol className="dayone-stack">
      {DAY_ONE.map((card, index) => (
        <li key={card.title} className="dayone-card" style={{ '--i': index } as React.CSSProperties}>
          <div className="b-surface dayone-card__inner">
            <div className="dayone-card__top">
              <span className="dayone-card__index">{String(index + 1).padStart(2, '0')}</span>
              <span className="dayone-card__meta">{card.meta}</span>
            </div>

            <h3 className="dayone-card__title">{card.title}</h3>
            <p className="dayone-card__body">{card.body}</p>

            <p className="dayone-card__foot">
              <Check aria-hidden className="size-3.5 shrink-0 text-[color:var(--color-gold-light)]" strokeWidth={2.2} />
              In place before the first request
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
