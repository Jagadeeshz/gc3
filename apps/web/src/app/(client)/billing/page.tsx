'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, BadgeIndianRupee, CircleAlert, Receipt, TrendingUp } from 'lucide-react';
import type { Invoice, InvoiceDetail, Paginated, SubscriptionOverview } from '@gc3/types';
import {
  ApiClientError,
  downloadInvoice,
  fetchInvoice,
  fetchSubscription,
  listInvoices,
} from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import {
  formatDate,
  formatMoney,
  invoiceStatusLabel,
  invoiceStatusTone,
} from '@/components/portal/status';

/**
 * Billing (Phase 4, client side).
 *
 * What the tenant is on, what they have used this month, and every bill as a
 * document they can download. Read-only by design: a client owner can see the
 * plan but cannot change it — that is a commercial action (`finance:manage`), and
 * the API refuses it regardless of what the UI offers.
 */
const METER_TONE: Record<string, { bar: string; text: string; label: string }> = {
  OK: { bar: 'bg-emerald-400/70', text: 'text-emerald-300', label: 'Within plan' },
  WARNING: { bar: 'bg-gold/80', text: 'text-gold-light', label: 'Approaching limit' },
  EXCEEDED: { bar: 'bg-red-400/80', text: 'text-red-300', label: 'Limit reached' },
};

const FALLBACK_TONE = { bar: 'bg-emerald-400/70', text: 'text-emerald-300', label: 'Within plan' };

export default function BillingPage() {
  const { session } = useSession();
  const organizationId = session?.activeOrganizationId ?? null;

  const [plan, setPlan] = useState<SubscriptionOverview | null>(null);
  const [invoices, setInvoices] = useState<Paginated<Invoice> | null>(null);
  const [openInvoice, setOpenInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const token = session?.accessToken;

  const load = useCallback(async () => {
    if (!token || !organizationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // The plan is the important half: if invoices fail the page still explains
      // what the tenant is paying for, so the two loads are independent.
      const overview = await fetchSubscription(token, organizationId);
      setPlan(overview);

      try {
        setInvoices(await listInvoices(token, organizationId, { pageSize: 24 }));
      } catch (invoiceError) {
        if (!(invoiceError instanceof ApiClientError)) {
          throw invoiceError;
        }
        setInvoices({ items: [], total: 0, page: 1, pageSize: 24 });
      }
    } catch (loadError) {
      if (loadError instanceof ApiClientError) {
        setError(
          loadError.status === 403
            ? 'Billing is visible to client owners. Ask an owner on your team to share it.'
            : loadError.message,
        );
      } else {
        setError('Could not load billing.');
      }
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function open(id: string) {
    if (!token || !organizationId) {
      return;
    }

    setBusy(id);

    try {
      setOpenInvoice(await fetchInvoice(token, organizationId, id));
    } catch (openError) {
      setNotice(
        openError instanceof ApiClientError ? openError.message : 'Could not open that invoice.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function save(invoice: Invoice) {
    if (!token || !organizationId) {
      return;
    }

    setBusy(invoice.id);
    setNotice(null);

    try {
      await downloadInvoice(token, organizationId, invoice);
      setNotice(`${invoice.number} downloaded.`);
    } catch (downloadError) {
      setNotice(
        downloadError instanceof ApiClientError
          ? downloadError.message
          : 'Could not download that invoice.',
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading && !plan) {
    return <p className="text-sm text-slate-400">Loading billing…</p>;
  }

  if (error && !plan) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-200">
        <CircleAlert aria-hidden className="mt-0.5 size-4" strokeWidth={1.75} />
        {error}
      </div>
    );
  }

  if (!plan) {
    return <p className="text-sm text-slate-400">No plan is attached to this workspace yet.</p>;
  }

  const { tier, subscription, period, usage } = plan;

  return (
    <div className="grid gap-7">
      <header className="grid gap-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">Finance</p>
        <h1 className="font-display text-2xl font-semibold text-slate-100">Billing &amp; plan</h1>
        <p className="text-sm text-slate-400">
          What this workspace is subscribed to, how much of the allowance it has used, and every
          invoice issued to it.
        </p>
      </header>

      {notice ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.07] px-4 py-2.5 text-xs text-amber-200">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-2xl border border-[#1E293B] bg-[#0B1220]/60 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">Plan</p>
              <h2 className="mt-1 font-display text-xl font-semibold text-slate-100">{tier.name}</h2>
              <p className="mt-1 text-xs text-slate-400">
                {tier.description ?? 'Monthly subscription, billed per calendar month.'}
              </p>
            </div>
            <span className="rounded-full border border-gold/35 bg-gold/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-gold-light">
              {subscription.status.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
            <p className="font-display text-2xl font-semibold text-slate-100">
              {formatMoney(tier.monthlyPriceCents, tier.currency)}
              <span className="ml-1 font-sans text-xs font-normal text-slate-400">/ month</span>
            </p>
            <p className="text-xs text-slate-400">
              {period.label} · renews {formatDate(subscription.currentPeriodEnd)}
            </p>
          </div>

          <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <BadgeIndianRupee aria-hidden className="size-3.5 text-gold-light" strokeWidth={1.75} />
            Overages are billed at the end of the month and appear as separate lines on the invoice.
          </p>
        </article>

        <article className="rounded-2xl border border-[#1E293B] bg-[#0B1220]/60 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
            Change your plan
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Upgrades and downgrades are handled by your account manager, so pricing changes always
            have a person behind them.
          </p>
          <p className="mt-4 text-xs text-slate-400">
            Included: {tier.requestsIncluded} requests · {tier.storageMbIncluded.toLocaleString('en-IN')} MB
            storage · {tier.apiCallsIncluded.toLocaleString('en-IN')} API calls · {tier.seatsIncluded} seats.
          </p>
        </article>
      </section>

      <section className="grid gap-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
          Usage this period
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {usage.map((meter) => {
            const tone = METER_TONE[meter.state] ?? FALLBACK_TONE;
            const width = Math.min(meter.percentUsed, 100);

            return (
              <article
                key={meter.key}
                className="rounded-xl border border-[#1E293B] bg-[#0B1220]/60 p-4"
              >
                <p className="text-xs text-slate-400">
                  {meter.key === 'REQUESTS'
                    ? 'Service requests'
                    : meter.key === 'STORAGE_KB'
                      ? 'Storage'
                      : 'API calls'}
                </p>
                <p className="mt-1 font-display text-lg font-semibold text-slate-100">
                  {meter.quantity.toLocaleString('en-IN')}
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    / {meter.included.toLocaleString('en-IN')} {meter.unit}
                  </span>
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full ${tone.bar}`} style={{ width: `${width}%` }} />
                </div>
                <p className={`mt-2 text-[11px] ${tone.text}`}>
                  {tone.label} · {meter.percentUsed}% used
                  {meter.state === 'EXCEEDED' ? ' · overage billed' : ''}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">Invoices</h2>
          <span className="text-xs text-slate-400">{invoices?.total ?? 0} on file</span>
        </div>

        {invoices && invoices.items.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-[#1E293B]">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">Period</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 font-medium">Due</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {invoices.items.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-[#1E293B]">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void open(invoice.id)}
                        disabled={busy === invoice.id}
                        className="font-mono text-xs text-slate-100 underline-offset-4 hover:underline disabled:opacity-50"
                      >
                        {invoice.number}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {invoice.periodStart.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          'rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]',
                          invoiceStatusTone(invoice.status) === 'positive'
                            ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300'
                            : invoiceStatusTone(invoice.status) === 'critical'
                              ? 'border-red-400/35 bg-red-400/10 text-red-300'
                              : invoiceStatusTone(invoice.status) === 'gold'
                                ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
                                : 'border-white/15 bg-white/5 text-slate-400',
                        ].join(' ')}
                      >
                        {invoiceStatusLabel(invoice.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-100">
                      {formatMoney(invoice.totalCents, invoice.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {invoice.dueAt ? formatDate(invoice.dueAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void save(invoice)}
                        disabled={busy === invoice.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] text-slate-100 transition-colors hover:border-emerald-400/40 hover:text-emerald-200 disabled:opacity-50"
                      >
                        <ArrowDownToLine aria-hidden className="size-3" strokeWidth={1.9} />
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/15 px-4 py-6 text-sm text-slate-400">
            <Receipt aria-hidden className="size-4 text-gold-light" strokeWidth={1.75} />
            No invoices yet. Your first bill is generated at the end of the month.
          </div>
        )}
      </section>

      {openInvoice ? (
        <section className="rounded-2xl border border-[#1E293B] bg-[#0B1220]/60 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                Invoice detail
              </p>
              <h3 className="mt-1 font-display text-lg font-semibold text-slate-100">
                {openInvoice.number}
              </h3>
              <p className="text-xs text-slate-400">
                {formatDate(openInvoice.periodStart)} — {formatDate(openInvoice.periodEnd)} ·{' '}
                {invoiceStatusLabel(openInvoice.status)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpenInvoice(null)}
              className="text-xs text-slate-400 underline-offset-4 hover:text-slate-100 hover:underline"
            >
              Close
            </button>
          </div>

          <table className="mt-4 w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
              <tr>
                <th className="py-2 font-medium">Line</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Unit</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {openInvoice.lineItems.map((line) => (
                <tr key={line.id} className="border-t border-[#1E293B]">
                  <td className="py-2 pr-3 text-slate-100">{line.description}</td>
                  <td className="py-2 text-right font-mono text-slate-400">{line.quantity}</td>
                  <td className="py-2 text-right font-mono text-slate-400">
                    {formatMoney(line.unitAmountCents, openInvoice.currency)}
                  </td>
                  <td className="py-2 text-right font-mono text-slate-100">
                    {formatMoney(line.amountCents, openInvoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-[#1E293B] text-slate-100">
              <tr>
                <td className="py-2" colSpan={3}>
                  Subtotal
                </td>
                <td className="py-2 text-right font-mono">
                  {formatMoney(openInvoice.subtotalCents, openInvoice.currency)}
                </td>
              </tr>
              <tr>
                <td className="py-1" colSpan={3}>
                  Tax
                </td>
                <td className="py-1 text-right font-mono">
                  {formatMoney(openInvoice.taxCents, openInvoice.currency)}
                </td>
              </tr>
              <tr className="text-sm">
                <td className="pt-2 font-semibold" colSpan={3}>
                  Total
                </td>
                <td className="pt-2 text-right font-mono font-semibold">
                  {formatMoney(openInvoice.totalCents, openInvoice.currency)}
                </td>
              </tr>
            </tfoot>
          </table>

          {openInvoice.notes ? (
            <p className="mt-3 text-xs text-slate-400">{openInvoice.notes}</p>
          ) : null}
        </section>
      ) : null}

      <p className="flex items-center gap-2 text-[11px] text-slate-400">
        <TrendingUp aria-hidden className="size-3.5 text-gold-light" strokeWidth={1.75} />
        Usage counters reset on the first of each month.
      </p>
    </div>
  );
}
