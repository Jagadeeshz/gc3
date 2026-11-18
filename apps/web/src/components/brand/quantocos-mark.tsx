/**
 * The Quantocos lockup.
 *
 * The shipped artwork, used as delivered: the gradient wordmark with the
 * "Explore Possibilities." line beneath it. The supplied PNG had a white ground,
 * which reads as a white rectangle on this site's obsidian, so the background is
 * knocked out to transparency in the asset itself and the nav places the image
 * directly on the page.
 *
 * The accessible name lives on the wrapper, not the image: a screen reader hears
 * "Quantocos" once, never the file name and never a second copy of the suffix.
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
  const height = { sm: 18, md: 24, lg: 30 }[size];

  return (
    <span
      className={`inline-flex items-center gap-2 ${className ?? ''}`}
      role="img"
      aria-label={`Quantocos${withSuffix ? ' GC3' : ''}`}
    >
      <img
        src="/brand/quantocos-wordmark.png"
        alt=""
        height={height}
        style={{ height }}
        width={Math.round((488 / 98) * height)}
        className="w-auto select-none"
        draggable={false}
      />
      {withSuffix ? (
        <span aria-hidden="true" className="font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
          GC³
        </span>
      ) : null}
    </span>
  );
}
