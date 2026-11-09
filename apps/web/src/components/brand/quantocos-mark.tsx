/**
 * The Quantocos wordmark.
 *
 * The Q carries the spectrum gradient; the remaining letters stay solid shunya. This is
 * the one place in the product where gradient paint touches a glyph, and it is a
 * deliberate, requested brand exception to BINDU hard rule 3 ("never gradient on text"):
 *
 *   · it is a *logotype*, not body copy or a heading — the rule exists so prose stays
 *     legible, and a single 6–22px glyph is not prose;
 *   · the gradient is the sanctioned spectrum asset, not a decorative blend;
 *   · it is scoped by class, so it cannot leak onto a heading by accident.
 *
 * If the rule is ever enforced without exception, the fix is one line here: render the Q
 * as an SVG path with a spectrum gradient fill (rule 4 permits logo artwork as a file)
 * and drop `.qc-q` from globals.css. Nothing else in the app depends on this.
 */
export function QuantocosMark({
  className,
  size = 'md',
  withSuffix = false,
}: {
  readonly className?: string;
  readonly size?: 'sm' | 'md' | 'lg';
  /** Renders the “GC³” product suffix after the company name. */
  readonly withSuffix?: boolean;
}) {
  const scale = {
    sm: 'text-[13px]',
    md: 'text-[15px]',
    lg: 'text-[18px]',
  }[size];

  return (
    <span
      className={`inline-flex items-baseline font-sans font-medium tracking-[-0.01em] leading-none text-warm ${scale}${className ? ` ${className}` : ''}`}
    >
      {/* Screen readers get the name once, from the label below. */}
      <span aria-hidden="true" className="qc-q">
        Q
      </span>
      <span aria-hidden="true" className="font-medium italic">uantocos</span>
      {withSuffix ? (
        <span aria-hidden="true" className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
          GC³
        </span>
      ) : null}
      <span className="sr-only">Quantocos{withSuffix ? ' GC3' : ''}</span>
    </span>
  );
}
