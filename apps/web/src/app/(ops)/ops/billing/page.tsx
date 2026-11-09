'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeIndianRupee,
  BanknoteArrowDown,
  CircleAlert,
  FilePlus2,
  Landmark,
  Receipt,
} from 'lucide-react';
import type { FinanceOverview, Invoice, InvoiceStatus } from '@gc3/types';
import {
  ApiClientError,
  changeInvoiceStatus,
  fetchFinanceOverview,
  generateInvoice,
} from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import {
  currentPeriodKey,
  formatDate,
  formatMoney,
  invoiceStatusLabel,
  invoiceStatusTone,
  previousPeriodKey,
} from '@/components/portal/status';

/**
 * Finance console (Phase 4, platform side).
 *
 * MRR, the tier mix behind it, what is billed versus settled, and the tenant
 * ledger. Generation and the status buttons are `finance:manage` actions — the
 * server enforces that, so a read-only viewer simply sees the API refuse them.
 *
 * Note what is *not* here: nothing settles an invoice automatically. Marking one
 * PAID is a human act that records who said the money arrived.
 */
const STATUS_ORDER: readonly InvoiceStatus[] = ['DRAFT', 'ISSUED', 'OVERDUE', 'PAID', 'VOID'];

const STATUS_TONE: Record<InvoiceStatus, string> = {
  DRAFT: 'border-white/15 bg-white/5 text-muted',
  ISSUED: 'border-gold/35 bg-gold/10 text-gold-light',
  OVERDUE: 'border-red-400/35 bg-red-400/10 text-red-300',
  PAID: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300',
  VOID: 'border-white/15 bg-white/5 text-muted',
};

export default function OpsBillingPage() {
  const { session } = useSession();
  const token = session?.accessToken;

  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [period, setPeriod] = useState(previousPeriodKey());

  const canManage = useMemo(() => {
    const role = session?.actor.platformRole;
    return role === 'PLATFORM_ADMIN' || role === 'FINANCE_MANAGER';
  }, [session?.actor.platformRole]);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setOverview(await fetchFinanceOverview(token));
    } catch (loadError) {
      setError(
        loadError instanceof ApiClientError
          ? loadError.status === 403
            ? 'This console needs finance access (finance:read).'
            : loadError.message
          : 'Could not load the finance overview.',
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function bill(organizationId: string, name: string) {
    if (!token) {
      return;
    }

    setBusy(organizationId);
    setNotice(null);

    try {
      const invoice = await generateInvoice(token, organizationId, { period });
      setNotice(`${invoice.number} generated for ${name} — ${formatMoney(invoice.totalCents, invoice.currency)}.`);
      await load();
    } catch (billError) {
      setNotice(
        billError instanceof ApiClientError
          ? `${name}: ${billError.message}`
          : `Could not bill ${name}.`,
      );
    } finally {
      setBusy(null);
    }
  }

  async function move(invoice: Invoice, status: 'ISSUED' | 'PAID' | 'VOID') {
    if (!token) {
      return;
    }

    setBusy(invoice.id);
    setNotice(null);

    try {
      const updated = await changeInvoiceStatus(token, invoice.organizationId, invoice.id, status);
      setNotice(`${updated.number} is now ${updated.status}.`);
      await load();
    } catch (moveError) {
      setNotice(
        moveError instanceof ApiClientError
          ? moveError.message
          : `Could not move ${invoice.number}.`,
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading && !overview) {
    return <p className="text-sm text-muted">Loading finance console…</p>;
  }

  if (error && !overview) {
    return (
      <div className="flex items-start gap-3 rounded-[14px] border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-200">
        <CircleAlert aria-hidden className="mt-0.5 size-4" strokeWidth={1.75} />
        {error}
      </div>
    );
  }

  if (!overview) {
    return <p className="text-sm text-muted">No finance data.</p>;
  }

  return (
    <div className="grid gap-7">
      <header className="grid gap-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Platform · Finance
        </p>
        <h1 className="font-display text-2xl font-semibold text-warm">Billing operations</h1>
        <p className="text-sm text-muted">
          Recurring revenue across every tenant, what has been billed, and what is still outstanding.
        </p>
      </header>

      {notice ? (
        <div className="rounded-[14px] border border-gold/30 bg-gold/5 px-4 py-2.5 text-xs text-gold-light">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Monthly recurring revenue',
            value: formatMoney(overview.mrrCents),
            hint: `${overview.organizations} active subscription${overview.organizations === 1 ? '' : 's'}`,
            icon: Landmark,
          },
          {
            label: 'Outstanding',
            value: formatMoney(overview.invoices.outstandingCents),
            hint: `${overview.invoices.issued} issued · ${overview.invoices.overdue} overdue`,
            icon: Receipt,
          },
          {
            label: 'Settled',
            value: formatMoney(overview.invoices.paidCents),
            hint: `${overview.invoices.paid} paid invoice${overview.invoices.paid === 1 ? '' : 's'}`,
            icon: BanknoteArrowDown,
          },
          {
            label: 'Drafts',
            value: String(overview.invoices.draft),
            hint: 'Generated, not yet issued',
            icon: FilePlus2,
          },
        ].map((card) => {
          const Icon = card.icon;

          return (
            <article key={card.label} className="rounded-[14px] border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted">{card.label}</p>
                <Icon aria-hidden className="size-4 text-gold-light" strokeWidth={1.75} />
              </div>
              <p className="mt-2 font-display text-xl font-semibold text-warm">{card.value}</p>
              <p className="mt-1 text-[11px] text-muted">{card.hint}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Tier mix</h2>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Plan</th>
                <th className="px-4 py-2.5 text-right font-medium">Tenants</th>
                <th className="px-4 py-2.5 text-right font-medium">MRR</th>
              </tr>
            </thead>
            <tbody>
              {overview.byTier.length > 0 ? (
                overview.byTier.map((row) => (
                  <tr key={row.tierCode} className="border-t border-white/10">
                    <td className="px-4 py-3 text-warm">{row.tierName}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted">
                      {row.organizations}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-warm">
                      {formatMoney(row.mrrCents)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-4 text-xs text-muted" colSpan={3}>
                    No active subscriptions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Tenant ledger
          </h2>
          <label className="flex items-center gap-2 text-[11px] text-muted">
            Bill period
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value || previousPeriodKey())}
              max={currentPeriodKey()}
              className="rounded-lg border border-white/12 bg-graphite px-2 py-1 font-mono text-[11px] text-warm focus:border-gold/60 focus:outline-none"
            />
          </label>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Tenant</th>
                <th className="px-4 py-2.5 font-medium">Plan</th>
                <th className="px-4 py-2.5 text-right font-medium">Requests</th>
                <th className="px-4 py-2.5 text-right font-medium">Storage</th>
                <th className="px-4 py-2.5 text-right font-medium">MRR</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {overview.tenants.map((tenant) => (
                <tr key={tenant.id} className="border-t border-white/10">
                  <td className="px-4 py-3 text-warm">{tenant.name}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      {tenant.tierCode ?? 'no plan'}
                    </span>
                    {tenant.status && tenant.status !== 'ACTIVE' ? (
                      <span className="ml-2 rounded-full border border-red-400/30 bg-red-400/10 px-1.5 py-0.5 text-[9px] uppercase text-red-300">
                        {tenant.status}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted">
                    {tenant.requestsThisPeriod}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted">
                    {tenant.storageMbThisPeriod} MB
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-warm">
                    {formatMoney(tenant.mrrCents)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => void bill(tenant.id, tenant.name)}
                        disabled={busy === tenant.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] text-warm transition-colors hover:border-gold/50 hover:text-gold-light disabled:opacity-50"
                      >
                        <BadgeIndianRupee aria-hidden className="size-3" strokeWidth={1.9} />
                        {busy === tenant.id ? 'Billing…' : `Bill ${period}`}
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted">read only</span>
                    )}
                  </td>
                </tr>
              ))}
              {overview.tenants.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-xs text-muted" colSpan={6}>
                    No tenants yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Recent invoices
          </h2>
          <p className="flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.1em] text-muted">
            {STATUS_ORDER.map((status) => (
              <span key={status} className={`rounded-full border px-2 py-0.5 ${STATUS_TONE[status]}`}>
                {invoiceStatusLabel(status)}
                {status === 'DRAFT'
                  ? ` ${overview.invoices.draft}`
                  : status === 'ISSUED'
                    ? ` ${overview.invoices.issued}`
                    : status === 'OVERDUE'
                      ? ` ${overview.invoices.overdue}`
                      : status === 'PAID'
                        ? ` ${overview.invoices.paid}`
                        : ` ${overview.invoices.void}`}
              </span>
            ))}
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Invoice</th>
                <th className="px-4 py-2.5 font-medium">Tenant</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 font-medium">Due</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {overview.recent.map((invoice) => (
                <tr key={invoice.id} className="border-t border-white/10">
                  <td className="px-4 py-3 font-mono text-xs text-warm">{invoice.number}</td>
                  <td className="px-4 py-3 text-xs text-muted">{invoice.organizationName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${STATUS_TONE[invoice.status]}`}
                    >
                      {invoiceStatusLabel(invoice.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-warm">
                    {formatMoney(invoice.totalCents, invoice.currency)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {invoice.dueAt ? formatDate(invoice.dueAt) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage ? (
                      <div className="flex justify-end gap-1.5">
                        {invoice.status === 'DRAFT' ? (
                          <button
                            type="button"
                            onClick={() => void move(invoice, 'ISSUED')}
                            disabled={busy === invoice.id}
                            className="rounded-lg border border-gold/40 px-2 py-0.5 text-[11px] text-gold-light hover:bg-gold/10 disabled:opacity-50"
                          >
                            Issue
                          </button>
                        ) : null}
                        {invoice.status === 'ISSUED' || invoice.status === 'OVERDUE' ? (
                          <button
                            type="button"
                            onClick={() => void move(invoice, 'PAID')}
                            disabled={busy === invoice.id}
                            className="rounded-lg border border-emerald-400/40 px-2 py-0.5 text-[11px] text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-50"
                          >
                            Mark paid
                          </button>
                        ) : null}
                        {invoice.status !== 'PAID' && invoice.status !== 'VOID' ? (
                          <button
                            type="button"
                            onClick={() => void move(invoice, 'VOID')}
                            disabled={busy === invoice.id}
                            className="rounded-lg border border-white/15 px-2 py-0.5 text-[11px] text-muted hover:text-warm disabled:opacity-50"
                          >
                            Void
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted">read only</span>
                    )}
                  </td>
                </tr>
              ))}
              {overview.recent.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-xs text-muted" colSpan={6}>
                    No invoices have been generated yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-muted">
          Marking an invoice paid records which user settled it. Nothing in the platform settles an
          invoice on its own — there is no payment processor in this build.
        </p>
      </section>
    </div>
  );
}
