/**
 * The comparison.
 *
 * Design Pickle's "why not the alternatives" block, applied to a delivery model
 * rather than a design subscription. Three options, five dimensions, one column
 * marked as the recommendation. The middle columns are written fairly: a reader
 * who has an in-house team should not feel the page is arguing with them.
 */

type Row = { dimension: string; inHouse: string; agency: string; pod: string };

const ROWS: readonly Row[] = [
  {
    dimension: 'Time to a working team',
    inHouse: 'A hiring cycle per seat, and a ramp after it',
    agency: 'A pitch, a scope, then a start date',
    pod: 'A composed pod, named before the first request',
  },
  {
    dimension: 'What you pay for',
    inHouse: 'Salaries, benefits and idle capacity',
    agency: 'A retainer against an agreed scope',
    pod: 'A monthly credit pool, used or held',
  },
  {
    dimension: 'Continuity of knowledge',
    inHouse: 'High, until someone leaves',
    agency: 'Rotates with the account team',
    pod: 'One manager and one roster, held across the pod',
  },
  {
    dimension: 'Commercial records',
    inHouse: 'Payroll and internal cost centres',
    agency: 'Invoices, reconciled by hand at quarter end',
    pod: 'Per-tenant invoices and an auditable trail in the portal',
  },
  {
    dimension: 'When demand doubles',
    inHouse: 'Another hiring cycle',
    agency: 'A change request and a new scope',
    pod: 'A second pod, added without renegotiating the first',
  },
];

export function Comparison() {
  return (
    <section id="comparison" className="border-b border-hairline bg-transparent py-20 sm:py-24">
      <div className="shell">
        <div className="reveal max-w-[62ch]">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-gold-light)]">
            Why a pod
          </p>
          <h2 className="mt-3 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.025em] text-ghost">
            The same outcome, three ways of buying it.
          </h2>
        </div>

        <div className="reveal mt-10 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <caption className="sr-only">
              Comparison of an in-house team, a traditional agency and a GC³ capability pod
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-[22%] pb-4 pr-4 font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted">
                  Dimension
                </th>
                <th scope="col" className="w-[24%] pb-4 pr-4 font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted">
                  In-house team
                </th>
                <th scope="col" className="w-[24%] pb-4 pr-4 font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted">
                  Traditional agency
                </th>
                <th scope="col" className="w-[30%] rounded-t-[12px] bg-obsidian-soft px-5 pb-4 pt-5 font-mono text-[9px] uppercase tracking-[0.14em] text-ghost">
                  GC³ capability pod
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, index) => (
                <tr key={row.dimension} className="border-t border-hairline align-top">
                  <th scope="row" className="py-4 pr-4 text-[12.5px] font-medium text-ghost">
                    {row.dimension}
                  </th>
                  <td className="py-4 pr-4 text-[12.5px] leading-[1.65] text-ghost-muted">{row.inHouse}</td>
                  <td className="py-4 pr-4 text-[12.5px] leading-[1.65] text-ghost-muted">{row.agency}</td>
                  <td
                    className={[
                      'bg-obsidian-soft px-5 py-4 text-[12.5px] leading-[1.65] text-ghost',
                      index === ROWS.length - 1 ? 'rounded-b-[12px]' : '',
                    ].join(' ')}
                  >
                    {row.pod}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
