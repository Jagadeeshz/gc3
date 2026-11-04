'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Deliverable,
  DeliverableVersion,
  RequestComment,
  ServiceCategory,
  ServiceRequest,
  ServiceRequestPriority,
  ServiceRequestStatus,
} from '@gc3/types';
import { SERVICE_REQUEST_TRANSITIONS } from '@gc3/types';
import { Badge } from '@gc3/ui';
import {
  addComment,
  ApiClientError,
  changeRequestStatus,
  createDeliverable,
  getRequest,
  listCategories,
  listComments,
  listDeliverables,
  listDeliverableVersions,
  updateDeliverable,
  updateDeliverableStatus,
  updateRequest,
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
  const [commentIsInternal, setCommentIsInternal] = useState(false);
  const [deliverableForm, setDeliverableForm] = useState({
    title: '',
    description: '',
    fileUrl: '',
  });
  const [showDeliverableForm, setShowDeliverableForm] = useState(false);
  const [editingDeliverableId, setEditingDeliverableId] = useState<string | null>(null);
  const [deliverableEditForm, setDeliverableEditForm] = useState({
    title: '',
    description: '',
    fileUrl: '',
    changeNote: '',
  });
  const [versions, setVersions] = useState<Record<string, DeliverableVersion[]>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [categories, setCategories] = useState<readonly ServiceCategory[]>([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    priority: ServiceRequestPriority;
    categoryId: string;
  }>({ title: '', description: '', priority: 'NORMAL', categoryId: '' });

  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;

  const load = useCallback(async () => {
    if (!token || !organizationId || !requestId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [loadedRequest, loadedComments, loadedDeliverables, loadedCategories] =
        await Promise.all([
          getRequest(token, organizationId, requestId),
          listComments(token, organizationId, requestId),
          listDeliverables(token, organizationId, requestId),
          listCategories(token, organizationId),
        ]);

      setRequest(loadedRequest);
      setComments(loadedComments);
      setDeliverables(loadedDeliverables);
      setCategories(loadedCategories);
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

  /** Staff who hold `deliverable:create`. Clients never produce deliverables. */
  const canCreateDeliverable = useMemo(() => {
    const role = session?.actor.platformRole ?? null;
    return role !== null
      ? ['PLATFORM_ADMIN', 'OPERATIONS_MANAGER', 'POD_MANAGER', 'SPECIALIST'].includes(role)
      : false;
  }, [session]);

  /** Only staff may author internal notes; the API downgrades the flag for clients. */
  const canWriteInternal = useMemo(() => Boolean(session?.actor.platformRole), [session]);

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
      await addComment(
        token,
        organizationId,
        request.id,
        draftComment.trim(),
        canWriteInternal && commentIsInternal,
      );
      setDraftComment('');
      setCommentIsInternal(false);
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

  function startEditing() {
    if (!request) {
      return;
    }

    setEditing(true);
    setActionError(null);
    setEditForm({
      title: request.title,
      description: request.description,
      priority: request.priority,
      categoryId: request.categoryId ?? '',
    });
  }

  async function onSaveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !organizationId || !request) {
      return;
    }

    setBusy('edit');
    setActionError(null);

    try {
      const updated = await updateRequest(token, organizationId, request.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        priority: editForm.priority,
        // '' means "no category"; the API distinguishes null from omitted.
        categoryId: editForm.categoryId === '' ? null : editForm.categoryId,
      });

      setRequest(updated);
      setEditing(false);
    } catch (caught) {
      setActionError(
        caught instanceof ApiClientError ? caught.message : 'Could not save the changes',
      );
    } finally {
      setBusy(null);
    }
  }

  async function onCreateDeliverable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !organizationId || !request) {
      return;
    }

    setBusy('deliverable:create');
    setActionError(null);

    try {
      await createDeliverable(token, organizationId, request.id, {
        title: deliverableForm.title.trim(),
        ...(deliverableForm.description.trim()
          ? { description: deliverableForm.description.trim() }
          : {}),
        ...(deliverableForm.fileUrl.trim() ? { fileUrl: deliverableForm.fileUrl.trim() } : {}),
      });

      setDeliverableForm({ title: '', description: '', fileUrl: '' });
      setShowDeliverableForm(false);

      const refreshed = await listDeliverables(token, organizationId, request.id);
      setDeliverables(refreshed);
    } catch (caught) {
      setActionError(
        caught instanceof ApiClientError ? caught.message : 'Could not create the deliverable',
      );
    } finally {
      setBusy(null);
    }
  }

  function startDeliverableEdit(deliverable: Deliverable) {
    setEditingDeliverableId(deliverable.id);
    setDeliverableEditForm({
      title: deliverable.title,
      description: deliverable.description ?? '',
      fileUrl: deliverable.fileUrl ?? '',
      changeNote: '',
    });
    setActionError(null);
    setNotice(null);
  }

  async function onSaveDeliverableEdit(
    event: React.FormEvent<HTMLFormElement>,
    deliverable: Deliverable,
  ) {
    event.preventDefault();

    if (!token || !organizationId || !request) {
      return;
    }

    setBusy(`deliverable:edit:${deliverable.id}`);
    setActionError(null);
    setNotice(null);

    try {
      const result = await updateDeliverable(
        token,
        organizationId,
        request.id,
        deliverable.id,
        {
          title: deliverableEditForm.title.trim(),
          description: deliverableEditForm.description.trim() === ''
            ? null
            : deliverableEditForm.description.trim(),
          fileUrl: deliverableEditForm.fileUrl.trim() === ''
            ? null
            : deliverableEditForm.fileUrl.trim(),
          ...(deliverableEditForm.changeNote.trim()
            ? { changeNote: deliverableEditForm.changeNote.trim() }
            : {}),
        },
      );

      setDeliverables((current) =>
        current.map((item) => (item.id === deliverable.id ? result.deliverable : item)),
      );
      setEditingDeliverableId(null);

      // Force a refetch of this deliverable's history if it is open.
      setVersions((current) => {
        const next = { ...current };
        delete next[deliverable.id];
        return next;
      });

      setNotice(
        result.approvalReset
          ? `Saved as version ${result.deliverable.version}. The previous approval was cleared — this deliverable is back to Pending and needs signing off again.`
          : `Saved as version ${result.deliverable.version}.`,
      );
    } catch (caught) {
      setActionError(
        caught instanceof ApiClientError ? caught.message : 'Could not save the deliverable',
      );
    } finally {
      setBusy(null);
    }
  }

  async function toggleVersions(deliverable: Deliverable) {
    if (!token || !organizationId || !request) {
      return;
    }

    if (versions[deliverable.id]) {
      setVersions((current) => {
        const next = { ...current };
        delete next[deliverable.id];
        return next;
      });
      return;
    }

    setBusy(`deliverable:versions:${deliverable.id}`);

    try {
      const loaded = await listDeliverableVersions(
        token,
        organizationId,
        request.id,
        deliverable.id,
      );

      setVersions((current) => ({ ...current, [deliverable.id]: loaded }));
    } catch (caught) {
      setActionError(
        caught instanceof ApiClientError ? caught.message : 'Could not load version history',
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
        <div className="flex items-center gap-2">
          <Badge tone={requestStatusTone(request.status)}>
            {requestStatusLabel(request.status)}
          </Badge>
          {request.status !== 'CLOSED' && request.status !== 'CANCELLED' ? (
            <button
              type="button"
              onClick={startEditing}
              disabled={editing || busy !== null}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-warm transition-colors hover:border-gold/40 hover:bg-white/10 disabled:opacity-50"
            >
              Edit
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Priority', value: priorityLabel(request.priority) },
          {
            label: 'Category',
            value:
              categories.find((category) => category.id === request.categoryId)?.name ?? '—',
          },
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

      {editing ? (
        <form
          className="mt-5 rounded-[14px] border border-gold/30 bg-graphite/85 p-5"
          onSubmit={onSaveEdit}
        >
          <h2 className="text-sm font-semibold text-warm">Edit request</h2>

          <label className="mt-4 grid gap-1.5">
            <span className="text-xs font-medium text-muted">Title</span>
            <input
              required
              minLength={3}
              maxLength={200}
              value={editForm.title}
              onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
              className="rounded-lg border border-white/12 bg-graphite-elevated px-3 py-2.5 text-sm text-warm focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25"
            />
          </label>

          <label className="mt-3 grid gap-1.5">
            <span className="text-xs font-medium text-muted">Description</span>
            <textarea
              required
              minLength={10}
              rows={5}
              maxLength={20_000}
              value={editForm.description}
              onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
              className="rounded-lg border border-white/12 bg-graphite-elevated px-3 py-2.5 text-sm text-warm focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25"
            />
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted">Priority</span>
              <select
                value={editForm.priority}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    priority: event.target.value as ServiceRequestPriority,
                  })
                }
                className="rounded-lg border border-white/12 bg-graphite-elevated px-3 py-2.5 text-sm text-warm focus:border-gold/60 focus:outline-none"
              >
                {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as ServiceRequestPriority[]).map((value) => (
                  <option key={value} value={value}>
                    {value.charAt(0) + value.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted">Category</span>
              <select
                value={editForm.categoryId}
                onChange={(event) => setEditForm({ ...editForm, categoryId: event.target.value })}
                className="rounded-lg border border-white/12 bg-graphite-elevated px-3 py-2.5 text-sm text-warm focus:border-gold/60 focus:outline-none"
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy !== null}
              className="min-h-10 rounded-[10px] border border-gold-deep/40 bg-[linear-gradient(180deg,#E2C777_0%,#D9B65D_100%)] px-4 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === 'edit' ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setActionError(null);
              }}
              disabled={busy !== null}
              className="min-h-10 rounded-[10px] border border-white/15 bg-white/5 px-4 py-2 text-sm text-warm hover:bg-white/10 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <section className="mt-5 rounded-[14px] border border-white/10 bg-graphite/85 p-5">
          <h2 className="text-sm font-semibold text-warm">Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
            {request.description}
          </p>
        </section>
      )}

      {notice ? (
        <p className="mt-4 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold-light">
          {notice}
        </p>
      ) : null}

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
              placeholder={commentIsInternal ? 'Add an internal note…' : 'Add a comment…'}
              className="rounded-lg border border-white/12 bg-graphite-elevated px-3 py-2.5 text-sm text-warm placeholder:text-muted/60 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25"
            />
            {canWriteInternal ? (
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={commentIsInternal}
                  onChange={(event) => setCommentIsInternal(event.target.checked)}
                  className="size-4 rounded border-white/20 bg-graphite-elevated accent-gold"
                />
                Internal note — hidden from the client
              </label>
            ) : (
              <p className="text-[11px] text-muted">
                Your comments are visible to the GC3 delivery team.
              </p>
            )}
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-warm">Deliverables</h2>
            {canCreateDeliverable && !showDeliverableForm ? (
              <button
                type="button"
                onClick={() => setShowDeliverableForm(true)}
                className="rounded-md border border-gold/40 bg-gold/12 px-2.5 py-1 text-[11px] text-gold-light hover:bg-gold/20"
              >
                + Add deliverable
              </button>
            ) : null}
          </div>

          {canCreateDeliverable && showDeliverableForm ? (
            <form
              className="mt-3 grid gap-2 rounded-[10px] border border-gold/30 bg-white/[0.02] p-3"
              onSubmit={onCreateDeliverable}
            >
              <input
                required
                minLength={3}
                maxLength={200}
                value={deliverableForm.title}
                onChange={(event) =>
                  setDeliverableForm({ ...deliverableForm, title: event.target.value })
                }
                placeholder="Deliverable title"
                className="rounded-lg border border-white/12 bg-graphite-elevated px-3 py-2 text-sm text-warm placeholder:text-muted/60 focus:border-gold/60 focus:outline-none"
              />
              <input
                maxLength={1000}
                value={deliverableForm.description}
                onChange={(event) =>
                  setDeliverableForm({ ...deliverableForm, description: event.target.value })
                }
                placeholder="Short description (optional)"
                className="rounded-lg border border-white/12 bg-graphite-elevated px-3 py-2 text-sm text-warm placeholder:text-muted/60 focus:border-gold/60 focus:outline-none"
              />
              <input
                type="url"
                maxLength={500}
                value={deliverableForm.fileUrl}
                onChange={(event) =>
                  setDeliverableForm({ ...deliverableForm, fileUrl: event.target.value })
                }
                placeholder="https://files.example.com/output.pdf (optional)"
                className="rounded-lg border border-white/12 bg-graphite-elevated px-3 py-2 font-mono text-xs text-warm placeholder:text-muted/60 focus:border-gold/60 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy !== null}
                  className="rounded-md border border-gold-deep/40 bg-[linear-gradient(180deg,#E2C777_0%,#D9B65D_100%)] px-3 py-1.5 text-[11px] font-medium text-ink disabled:opacity-50"
                >
                  {busy === 'deliverable:create' ? 'Adding…' : 'Add deliverable'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeliverableForm(false);
                    setDeliverableForm({ title: '', description: '', fileUrl: '' });
                  }}
                  disabled={busy !== null}
                  className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-warm hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

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
                      <p className="truncate text-sm text-warm">
                        {deliverable.title}
                        <span className="ml-2 rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                          v{deliverable.version}
                        </span>
                      </p>
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

                  {deliverable.fileUrl ? (
                    <a
                      href={deliverable.fileUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 inline-block text-[11px] text-gold-light hover:underline"
                    >
                      Open attached file ↗
                    </a>
                  ) : null}

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {canCreateDeliverable && editingDeliverableId !== deliverable.id ? (
                      <button
                        type="button"
                        onClick={() => startDeliverableEdit(deliverable)}
                        disabled={busy !== null}
                        className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-warm hover:bg-white/10 disabled:opacity-50"
                      >
                        Edit content
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void toggleVersions(deliverable)}
                      disabled={busy !== null}
                      className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-warm hover:bg-white/10 disabled:opacity-50"
                    >
                      {versions[deliverable.id]
                        ? 'Hide history'
                        : `History (v${deliverable.version})`}
                    </button>
                  </div>

                  {editingDeliverableId === deliverable.id ? (
                    <form
                      className="mt-2.5 grid gap-2 rounded-lg border border-gold/30 bg-black/20 p-3"
                      onSubmit={(event) => void onSaveDeliverableEdit(event, deliverable)}
                    >
                      <input
                        required
                        minLength={3}
                        maxLength={200}
                        value={deliverableEditForm.title}
                        onChange={(event) =>
                          setDeliverableEditForm({
                            ...deliverableEditForm,
                            title: event.target.value,
                          })
                        }
                        placeholder="Title"
                        className="rounded-md border border-white/12 bg-graphite-elevated px-2.5 py-1.5 text-xs text-warm focus:border-gold/60 focus:outline-none"
                      />
                      <input
                        maxLength={1000}
                        value={deliverableEditForm.description}
                        onChange={(event) =>
                          setDeliverableEditForm({
                            ...deliverableEditForm,
                            description: event.target.value,
                          })
                        }
                        placeholder="Description"
                        className="rounded-md border border-white/12 bg-graphite-elevated px-2.5 py-1.5 text-xs text-warm focus:border-gold/60 focus:outline-none"
                      />
                      <input
                        type="url"
                        maxLength={500}
                        value={deliverableEditForm.fileUrl}
                        onChange={(event) =>
                          setDeliverableEditForm({
                            ...deliverableEditForm,
                            fileUrl: event.target.value,
                          })
                        }
                        placeholder="https://files.example.com/replacement.pdf"
                        className="rounded-md border border-white/12 bg-graphite-elevated px-2.5 py-1.5 font-mono text-[11px] text-warm focus:border-gold/60 focus:outline-none"
                      />
                      <input
                        maxLength={500}
                        value={deliverableEditForm.changeNote}
                        onChange={(event) =>
                          setDeliverableEditForm({
                            ...deliverableEditForm,
                            changeNote: event.target.value,
                          })
                        }
                        placeholder="Why this changed (optional, recorded on the version)"
                        className="rounded-md border border-white/12 bg-graphite-elevated px-2.5 py-1.5 text-xs text-warm focus:border-gold/60 focus:outline-none"
                      />
                      {deliverable.status === 'APPROVED' || deliverable.status === 'RELEASED' ? (
                        <p className="text-[11px] text-gold-light">
                          This deliverable is already {deliverable.status.toLowerCase()}. Saving will
                          clear the approval and return it to Pending.
                        </p>
                      ) : null}
                      <div className="flex gap-1.5">
                        <button
                          type="submit"
                          disabled={busy !== null}
                          className="rounded-md border border-gold-deep/40 bg-[linear-gradient(180deg,#E2C777_0%,#D9B65D_100%)] px-3 py-1.5 text-[11px] font-medium text-ink disabled:opacity-50"
                        >
                          {busy === `deliverable:edit:${deliverable.id}`
                            ? 'Saving…'
                            : 'Save new version'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDeliverableId(null)}
                          disabled={busy !== null}
                          className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-warm hover:bg-white/10 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {versions[deliverable.id] ? (
                    <ol className="mt-2.5 grid gap-1.5 border-l border-gold/25 pl-3">
                      {versions[deliverable.id]!.map((version) => (
                        <li key={version.id} className="text-[11px] text-muted">
                          <span className="font-mono uppercase tracking-[0.08em] text-warm">
                            v{version.version}
                          </span>{' '}
                          · {formatDate(version.createdAt)}
                          {version.changeNote ? ` · ${version.changeNote}` : ''}
                          {version.fileUrl ? (
                            <a
                              href={version.fileUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="ml-1 text-gold-light hover:underline"
                            >
                              file ↗
                            </a>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  ) : null}

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
