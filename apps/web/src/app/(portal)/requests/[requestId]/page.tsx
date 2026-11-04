'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Deliverable,
  RequestComment,
  ServiceRequest,
  ServiceRequestStatus,
} from '@gc3/types';
import { SERVICE_REQUEST_TRANSITIONS } from '@gc3/types';
import { Badge } from '@gc3/ui';
import {
  addComment,
  ApiClientError,
  changeRequestStatus,
  getRequest,
  listComments,
  listDeliverables,
  updateDeliverableStatus,
} from '@/lib/api-client';
import { activeRoles } from '@/lib/session';
import { useSession } from '@/lib/session-context';
import {
  deliverableStatusLabel,
  deliverableStatusTone,
  formatDate,
  priorityLabel,
  requestStatusLabel,
  requestStatusTone,
} from '@/components/portal/status';

export default function RequestDetailPage() {
  const params = useParams<{ requestId: string }>();
  const requestId = params.requestId;
  const { session } = useSession();

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [comments, setComments] = useState<RequestComment[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draftComment, setDraftComment] = useState('');

  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;

  const load = useCallback(async () => {
    if (!token || !organizationId || !requestId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [loadedRequest, loadedComments, loadedDeliverables] = await Promise.all([
        getRequest(token, organizationId, requestId),
        listComments(token, organizationId, requestId),
        listDeliverables(token, organizationId, requestId),
      ]);

      setRequest(loadedRequest);
      setComments(loadedComments);
      setDeliverables(loadedDeliverables);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : 'Could not load this request',
      );
    } finally {
      setLoading(false);
    }
  }, [token, organizationId, requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  // UI affordance only — the API enforces deliverable:review regardless.
  const canReview = useMemo(() => {
    if (!session) {
      return false;
    }

    if (session.actor.platformRole) {
      return true;
    }

    const roles = activeRoles(session);
    return roles.includes('CLIENT_OWNER') || roles.includes('CLIENT_APPROVER');
  }, [session]);

  const nextStatuses = request ? SERVICE_REQUEST_TRANSITIONS[request.status] : [];

  async function onTransition(status: ServiceRequestStatus) {
    if (!token || !organizationId || !request) {
      return;
    }

    setBusy(`status:${status}`);
    setActionError(null);

    try {
      const updated = await changeRequestStatus(token, organizationId, request.id, status);
      setRequest(updated);
      await load();
    } catch (caught) {
      setActionError(
        caught instanceof ApiClientError ? caught.message : 'Could not change the status',
      );
    } finally {
      setBusy(null);
    }
  }

  async function onComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !organizationId || !request || draftComment.trim().length === 0) {
      return;
    }

    setBusy('comment');
    setActionError(null);

    try {
      await addComment(token, organizationId, request.id, draftComment.trim());
      setDraftComment('');
      const refreshed = await listComments(token, organizationId, request.id);
      setComments(refreshed);
    } catch (caught) {
      setActionError(
        caught instanceof ApiClientError ? caught.message : 'Could not post the comment',
      );
    } finally {
      setBusy(null);
    }
  }

  async function onDeliverableStatus(deliverable: Deliverable, status: Deliverable['status']) {
    if (!token || !organizationId || !request) {
      return;
    }

    setBusy(`deliverable:${deliverable.id}:${status}`);
    setActionError(null);

    try {
      await updateDeliverableStatus(token, organizationId, request.id, deliverable.id, status);
      const refreshed = await listDeliverables(token, organizationId, request.id);
      setDeliverables(refreshed);
    } catch (caught) {
      setActionError(
        caught instanceof ApiClientError ? caught.message : 'Could not update the deliverable',
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading request…</p>;
  }

  if (error || !request) {
    return (
      <div>
        <p className="rounded-lg border border-red-400/35 bg-red-400/10 px-3 py-2 text-xs text-red-300">
          {error ?? 'Request not found'}
        </p>
        <Link href="/requests" className="mt-4 inline-block text-sm text-gold-light hover:underline">
          ← Back to requests
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/requests" className="text-xs text-muted hover:text-warm">
        ← All requests
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {request.reference}
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-[-0.01em] text-warm">
            {request.title}
          </h1>
        </div>
        <Badge tone={requestStatusTone(request.status)}>
          {requestStatusLabel(request.status)}
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Priority', value: priorityLabel(request.priority) },
          { label: 'Created', value: formatDate(request.createdAt) },
          { label: 'Submitted', value: formatDate(request.submittedAt) },
          { label: 'Due', value: formatDate(request.dueAt) },
        ].map((item) => (
          <div key={item.label} className="rounded-[12px] border border-white/10 bg-graphite/85 p-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              {item.label}
            </p>
            <p className="mt-1 text-sm text-warm">{item.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-5 rounded-[14px] border border-white/10 bg-graphite/85 p-5">
        <h2 className="text-sm font-semibold text-warm">Description</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
          {request.description}
        </p>
      </section>

      {actionError ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-400/35 bg-red-400/10 px-3 py-2 text-xs text-red-300"
        >
          {actionError}
        </p>
      ) : null}

      {nextStatuses.length > 0 ? (
        <section className="mt-5 rounded-[14px] border border-white/10 bg-graphite/85 p-5">
          <h2 className="text-sm font-semibold text-warm">Move this request</h2>
          <p className="mt-1 text-xs text-muted">
            Only transitions the workflow allows are offered; the API rejects the rest with 409.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {nextStatuses.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => void onTransition(status)}
                disabled={busy !== null}
                className="min-h-9 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-warm transition-colors hover:border-gold/40 hover:bg-white/10 disabled:opacity-50"
              >
                {busy === `status:${status}` ? 'Moving…' : `→ ${requestStatusLabel(status)}`}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-[14px] border border-white/10 bg-graphite/85 p-5">
          <h2 className="text-sm font-semibold text-warm">Comments</h2>

          {comments.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No comments yet.</p>
          ) : (
            <ul className="mt-3 grid gap-2.5">
              {comments.map((comment) => (
                <li
                  key={comment.id}
                  className="rounded-[10px] border border-white/10 bg-white/[0.02] px-3.5 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      {comment.isInternal ? 'Internal note' : 'Client visible'}
                    </span>
                    <span className="text-[11px] text-muted">{formatDate(comment.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-warm">{comment.body}</p>
                </li>
              ))}
            </ul>
          )}

          <form className="mt-4 grid gap-2" onSubmit={onComment}>
            <textarea
              rows={3}
              value={draftComment}
              onChange={(event) => setDraftComment(event.target.value)}
              placeholder="Add a comment…"
              className="rounded-lg border border-white/12 bg-graphite-elevated px-3 py-2.5 text-sm text-warm placeholder:text-muted/60 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25"
            />
            <button
              type="submit"
              disabled={busy !== null || draftComment.trim().length === 0}
              className="w-fit min-h-9 rounded-lg border border-gold-deep/40 bg-[linear-gradient(180deg,#E2C777_0%,#D9B65D_100%)] px-3.5 py-1.5 text-xs font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'comment' ? 'Posting…' : 'Post comment'}
            </button>
          </form>
        </section>

        <section className="rounded-[14px] border border-white/10 bg-graphite/85 p-5">
          <h2 className="text-sm font-semibold text-warm">Deliverables</h2>

          {deliverables.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing delivered against this request yet.</p>
          ) : (
            <ul className="mt-3 grid gap-2.5">
              {deliverables.map((deliverable) => (
                <li
                  key={deliverable.id}
                  className="rounded-[10px] border border-white/10 bg-white/[0.02] px-3.5 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-warm">{deliverable.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {deliverable.approvedAt
                          ? `Approved ${formatDate(deliverable.approvedAt)}`
                          : 'Awaiting approval'}
                      </p>
                    </div>
                    <Badge tone={deliverableStatusTone(deliverable.status)}>
                      {deliverableStatusLabel(deliverable.status)}
                    </Badge>
                  </div>

                  {canReview ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {deliverable.status !== 'APPROVED' && deliverable.status !== 'RELEASED' ? (
                        <button
                          type="button"
                          onClick={() => void onDeliverableStatus(deliverable, 'APPROVED')}
                          disabled={busy !== null}
                          className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-warm hover:bg-white/10 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      ) : null}
                      {deliverable.status === 'APPROVED' ? (
                        <button
                          type="button"
                          onClick={() => void onDeliverableStatus(deliverable, 'RELEASED')}
                          disabled={busy !== null}
                          className="rounded-md border border-gold/40 bg-gold/12 px-2.5 py-1 text-[11px] text-gold-light hover:bg-gold/20 disabled:opacity-50"
                        >
                          Release to client
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-muted">
                      Approval is done by the client owner or approver.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
