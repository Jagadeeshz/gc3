import { Coins, ShieldCheck, UserCheck, type LucideIcon } from 'lucide-react';

/**
 * The three commitments, as glowing cards.
 *
 * The card treatment is ported from the supplied reference: an 8px gradient
 * border drawn with `background-clip`, a blurred copy of that gradient behind
 * the frame as the glow, and a staggered rise on entry. The gradients are gold,
 * because this site is black and gold, and they come from tokens so the palette
 * stays in one place.
 *
 * Content is GC³'s own: the three things a client is actually buying.
 */

type GlowCard = {
  title: string;
  description: string;
  icon: LucideIcon;
  gradientVar: string;
};

const CARDS: readonly GlowCard[] = [
  {
    title: 'One owner',
    description:
      'A single named manager is accountable for your pod, from the first request to the last invoice. Escalation is a person, not a mailbox.',
    icon: UserCheck,
    gradientVar: 'var(--glow-gold-1)',
  },
  {
    title: 'One pool',
    description:
      'A published credit pool, replenished monthly. Work draws from it, and the pod absorbs the scheduling — no seats, no timesheets.',
    icon: Coins,
    gradientVar: 'var(--glow-gold-2)',
  },
  {
    title: 'One record',
    description:
      'Every request, deliverable and invoice carries the actor and the date. The same record the delivery team works from, scoped to your organisation.',
    icon: ShieldCheck,
    gradientVar: 'var(--glow-gold-3)',
  },
];

export function GlowCards({ showHeader = true }: { readonly showHeader?: boolean } = {}) {
  return (
    <section id="commitments" className="border-b border-hairline bg-transparent py-20 sm:py-24">
      <div className="shell">
        {showHeader ? (
          <div className="reveal max-w-[62ch]">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-gold-light)]">
              What you are buying
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.025em] text-ghost">
              Three commitments, and each one has a screen behind it.
            </h2>
          </div>
        ) : null}

        <div className="mt-14 grid w-full grid-cols-1 justify-items-center gap-10 md:grid-cols-3 md:gap-3 lg:gap-3">
          {CARDS.map((card) => {
            const Icon = card.icon;

            return (
              <article key={card.title} className="glow-card group">
                {/* The glow: the card's own gradient, blurred, behind the frame. */}
                <div
                  aria-hidden="true"
                  className="glow-card__glow"
                  style={{ backgroundImage: card.gradientVar }}
                />

                {/* The frame: 8px transparent border with the gradient painted into it. */}
                <div
                  className="glow-card__frame"
                  style={{
                    backgroundImage: `linear-gradient(#1a1a1c, #1a1a1c), ${card.gradientVar}`,
                  }}
                >
                  <div className="glow-card__body">
                    <span className="text-white/90">
                      <Icon aria-hidden size={32} strokeWidth={2.5} />
                    </span>

                    <div>
                      <h3 className="mb-3 font-display text-xl font-medium tracking-tight text-white">
                        {card.title}
                      </h3>
                      <p className="text-[14px] font-normal leading-[1.6] text-[#a8a8ad] selection:bg-white/20">
                        {card.description}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
