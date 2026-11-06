'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, CreditCard, Info, Layers, ShieldCheck } from 'lucide-react';
import type { Invoice, Paginated, SubscriptionOverview, SubscriptionTier } from '@gc3/types';
import {
  ApiClientError,
  fetchSubscription,
  fetchTiers,
  listInvoices,
} from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { PodCatalogue } from '@/components/pricing/pod-catalogue';
import { activeRoles } from '@/lib/session';
import {
  formatDate,
  formatMoney,
  invoiceStatusLabel,
  invoiceStatusTone,
} from '@/components/portal/status';
import {
  EmptyState,
  ErrorNote,
  Loading,
  Meter,
  PageHeader,
  Panel,
  RestrictedPanel,
} from '@/components/portal/kit';

/**
 * My Subscription — owner only.
 *
 * The plan in force, the allowances being consumed this period, and what the
 * other tiers would cost. Everything here is read from
 * `GET /subscription` and `GET /subscription/tiers`; nothing is hard-coded, so if
 * a price changes in the catalogue this page changes with it.
 *
 * A member never reaches this route: the nav does not link it, and this component
 * renders a restriction panel for a non-owner rather than firing calls the API
 * would refuse.
 */
export default function SubscriptionPage() {
  const { session } = useSession();
  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;
  const isOwner = session ? activeRoles(session).includes('CLIENT_OWNER') : false;

  const [plan, setPlan] = useState<SubscriptionOverview | null>(null);
  const [tiers, setTiers] = useState<readonly SubscriptionTier[]>([]);
  const [invoices, setInvoices] = useState<Paginated<Invoice> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !organizationId || !isOwner) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [overview, catalogue, history] = await Promise.all([
        fetchSubscription(token, organizationId),
        fetchTiers(token, organizationId).catch(() => [] as SubscriptionTier[]),
        listInvoices(token, organizationId, { pageSize: 6 }).catch(
          () => ({ items: [], total: 0, page: 1, pageSize: 6 }) as Paginated<Invoice>,
        ),
      ]);

      setPlan(overview);
      setTiers(catalogue);
      setInvoices(history);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : 'Could not load your subscription.',
      );
    } finally {
      setLoading(false);
    }
  }, [token, organizationId, isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isOwner) {
    return (
      <RestrictedPanel
        title="Subscription is managed by the account owner"
        body="Billing and plan details are visible to client owners. Ask an owner on your team if you need the paperwork."
        href="/overview"
        label="Back to overview"
      />
    );
  }

  if (loading) return <Loading label="Loading your subscription…" />;
  if (error) return <ErrorNote message={error} />;
  if (!plan) return <ErrorNote message="No plan is attached to this workspace yet." />;

  const { tier, subscription, period, usage } = plan;
  const otherTiers = tiers.filter((candidate) => candidate.code !== tier.code);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Subscription"
        title="My Subscription"
        description={`${tier.name} plan · billed monthly · current period ${period.label}.`}
        actions={
          <Link
            href="/billing"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-100 transition-colors hover:border-gold/40"
          >
            <CreditCard aria-hidden className="size-3.5" strokeWidth={1.75} />
            Billing &amp; invoices
          </Link>
        }
      />
      <div className="flex flex-wrap items-start gap-2 rounded-[10px] border border-[#1E293B] bg-[#0B1220]/60 px-3.5 py-3">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0 text-emerald-300" strokeWidth={1.75} />
        <p className="text-[11px] leading-relaxed text-slate-400">
          <span className="text-slate-200">Two price models, both real.</span> This workspace bills
          against the metered platform plan below — requests, storage and API calls. Capability pods are
          sold separately on monthly credit pools with a standing team, and moving onto one is a
          commercial change your account team makes. Nothing on this page is an estimate.
        </p>
      </div>


      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Panel title="Active package" subtitle="What you are on, and what it includes">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-display text-xl font-semibold text-slate-100">{tier.name}</p>
              <p className="mt-1 max-w-[46ch] text-xs text-slate-400">
                {tier.description ?? 'Monthly subscription, billed per calendar month.'}
              </p>
            </div>
            <span className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-300">
              {subscription.status}
            </span>
          </div>

          <p className="mt-5 font-display text-2xl font-semibold tabular-nums text-slate-100">
            {formatMoney(tier.monthlyPriceCents, tier.currency)}
            <span className="ml-1 text-xs font-normal text-slate-400">/ month</span>
          </p>

          <dl className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {[
              { label: 'Requests included', value: `${tier.requestsIncluded}` },
              { label: 'Storage included', value: `${tier.storageMbIncluded.toLocaleString('en-IN')} MB` },
              { label: 'API calls included', value: `${tier.apiCallsIncluded.toLocaleString('en-IN')}` },
              { label: 'Seats included', value: `${tier.seatsIncluded}` },
            ].map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-[#1E293B] pb-2">
                <dt className="text-[11px] text-slate-400">{row.label}</dt>
                <dd className="font-mono text-xs tabular-nums text-slate-100">{row.value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400">
            <CalendarClock aria-hidden className="size-3.5 text-gold-light" strokeWidth={1.75} />
            Renews {formatDate(subscription.currentPeriodEnd)} · started {formatDate(subscription.startedAt)}
          </p>
        </Panel>

        <Panel title="Allowance this period" subtitle={period.label}>
          <div className="grid gap-4">
            {usage.map((meter) => (
              <Meter
                key={meter.key}
                label={
                  meter.key === 'REQUESTS'
                    ? 'Service requests'
                    : meter.key === 'STORAGE_KB'
                      ? 'Deliverable storage'
                      : 'API calls'
                }
                used={meter.quantity}
                included={meter.included}
                unit={meter.unit}
                percent={meter.percentUsed}
                state={meter.state}
              />
            ))}
          </div>
          <p className="mt-4 text-[11px] text-slate-400">
            Counters reset on the first of each month. Anything beyond the allowance is billed as a
            separate line on that month&rsquo;s invoice.
          </p>
        </Panel>
      </div>

      <Panel
        title="Other plans"
        subtitle="Changing plan is a commercial decision — your account manager makes it with you"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {otherTiers.length === 0 ? (
            <p className="text-xs text-slate-400">No other plans are published.</p>
          ) : (
            otherTiers.map((candidate) => (
              <article key={candidate.id} className="rounded-[10px] border border-[#1E293B] px-4 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-100">{candidate.name}</p>
                  <Layers aria-hidden className="size-3.5 text-gold-light" strokeWidth={1.75} />
                </div>
                <p className="mt-1 font-mono text-xs tabular-nums text-slate-400">
                  {formatMoney(candidate.monthlyPriceCents, candidate.currency)} / month
                </p>
                <p className="mt-2 text-[11px] text-slate-400">
                  {candidate.requestsIncluded} requests · {candidate.storageMbIncluded.toLocaleString('en-IN')} MB ·{' '}
                  {candidate.apiCallsIncluded.toLocaleString('en-IN')} calls
                </p>
              </article>
            ))
          )}
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck aria-hidden className="size-3.5 text-gold-light" strokeWidth={1.75} />
          Plan changes are audited and take effect from the next billing period.
        </p>
      </Panel>

      <Panel
        title="Recent invoices"
        subtitle={invoices ? `${invoices.total} on file` : undefined}
        action={
          <Link href="/billing" className="text-[11px] text-emerald-300 underline-offset-4 hover:underline">
            All invoices
          </Link>
        }
      >
        {!invoices || invoices.items.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No invoices yet"
            body="Your first invoice is generated at the end of the billing period and will appear here with a download link."
            action={{ href: '/billing', label: 'Open billing' }}
          />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="py-2 font-medium">Invoice</th>
                <th className="py-2 font-medium">Period</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 text-right font-medium">Total</th>
                <th className="py-2 text-right font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {invoices.items.map((invoice) => (
                <tr key={invoice.id} className="border-t border-[#1E293B]">
                  <td className="py-2.5 font-mono text-slate-100">{invoice.number}</td>
                  <td className="py-2.5 text-slate-400">{invoice.periodStart.slice(0, 10)}</td>
                  <td className="py-2.5">
                    <span
                      className={[
                        'rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]',
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
                  <td className="py-2.5 text-right font-mono tabular-nums text-slate-100">
                    {formatMoney(invoice.totalCents, invoice.currency)}
                  </td>
                  <td className="py-2.5 text-right text-slate-400">
                    {invoice.dueAt ? formatDate(invoice.dueAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel
        title="Capability pods"
        subtitle="The commercial catalogue this workspace can move to"
      >
        <p className="mb-4 text-[11px] leading-relaxed text-slate-400">
          Your subscription currently bills against the metered platform plan above. Capability pods
          are sold on credit pools with a standing team — moving onto one is a commercial action taken
          by your account team, not a self-serve button, because it changes the contract.
        </p>
        <PodCatalogue token={token} />
      </Panel>
    </div>
  );
}
