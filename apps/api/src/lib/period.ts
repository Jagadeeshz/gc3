/**
 * Billing periods.
 *
 * A period is a calendar month in the tenant's timezone sense, keyed as YYYY-MM.
 * Usage counters are stored per key, so every increment and every invoice
 * generation has to agree on which month a moment belongs to — that agreement
 * lives here and nowhere else.
 */
export interface PeriodBounds {
  /** YYYY-MM. */
  readonly key: string;
  readonly start: Date;
  /** Exclusive: the instant the next period begins. */
  readonly end: Date;
}

/** The period a given instant falls in. */
export function periodFor(date: Date = new Date()): PeriodBounds {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

  return { key: periodKey(start), start, end };
}

/** Parses `YYYY-MM`; throws on anything else so a typo cannot become a billing run. */
export function periodFromKey(key: string): PeriodBounds {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(key);

  if (!match) {
    throw new Error(`Invalid period "${key}" — expected YYYY-MM`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  return { key, start, end };
}

export function periodKey(date: Date): string {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}`;
}

/** "November 2026" — what a label on an invoice should read. */
export function periodLabel(bounds: Pick<PeriodBounds, 'start'>): string {
  return bounds.start.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
