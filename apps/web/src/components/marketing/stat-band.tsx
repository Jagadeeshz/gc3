/**
 * The proof band.
 *
 * ServiceNow's pattern, used honestly: four facts, stated as numbers, sitting
 * directly under the hero so a reader who trusts figures more than adjectives has
 * something to check. Nothing here animates and nothing is a claim we cannot
 * point at.
 */

const STATS = [
  { value: '6', label: 'Capability pods', note: 'published, priced' },
  { value: '3', label: 'Clients per pod', note: 'strict maximum' },
  { value: '48–120h', label: 'Delivery commitments', note: 'per priority' },
  { value: '1:1', label: 'Agent per specialist', note: 'every pod' },
] as const;

export function StatBand() {
  return (
    <section aria-label="Platform at a glance" className="border-b border-hairline bg-obsidian-soft/60">
      <div className="reveal-stagger shell grid grid-cols-2 gap-y-8 py-9 sm:py-10 lg:grid-cols-4">
        {STATS.map((stat, index) => (
          <div
            key={stat.label}
            className={[
              'px-0 lg:px-7',
              index > 0 ? 'lg:border-l lg:border-hairline' : '',
              index % 2 === 1 ? 'border-l border-hairline pl-5 lg:pl-7' : '',
            ].join(' ')}
          >
            <p className="font-display text-[clamp(1.6rem,2.6vw,2.1rem)] font-semibold leading-none tracking-[-0.01em] text-ghost">
              {stat.value}
            </p>
            <p className="mt-2 text-[12px] text-ghost">{stat.label}</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted">
              {stat.note}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
