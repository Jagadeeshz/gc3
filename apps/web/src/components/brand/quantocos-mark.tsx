import { QuantocosQ } from './quantocos-q';

/**
 * The Quantocos wordmark: the ring mark, then the name.
 *
 * The Q used to be a text glyph with the spectrum gradient painted on it, which is why it never
 * matched the company mark — the real one is a ring with a chrome sphere closing the break, not
 * a letter. It is drawn as SVG now (see quantocos-q.tsx) and set alongside the word instead of
 * standing in for its first letter.
 *
 * The mark is optical, not typographic: the sphere sits at the baseline, so the ring is centred
 * on the word's x-height rather than its baseline. Hence `items-center` and a small downward
 * nudge on the ring instead of baseline alignment.
 */
export function QuantocosMark({
  className,
  size = 'md',
  withSuffix = false,
}: {
  readonly className?: string;
  readonly size?: 'sm' | 'md' | 'lg';
  /** Renders the "GC³" product suffix after the company name. */
  readonly withSuffix?: boolean;
}) {
  const { text, mark } = {
    sm: { text: 'text-[13px]', mark: 18 },
    md: { text: 'text-[15px]', mark: 21 },
    lg: { text: 'text-[18px]', mark: 25 },
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-[3px] font-sans font-medium tracking-[-0.01em] leading-none text-warm ${text}${className ? ` ${className}` : ''}`}
    >
      <QuantocosQ size={mark} className="shrink-0 translate-y-[1px]" />
      <span aria-hidden="true" className="font-medium italic">
        uantocos
      </span>
      {withSuffix ? (
        <span aria-hidden="true" className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
          GC³
        </span>
      ) : null}
      <span className="sr-only">Quantocos{withSuffix ? ' GC3' : ''}</span>
    </span>
  );
}
