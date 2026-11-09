'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Deliverable,
  DeliverableVersion,
  FileIntegrityReport,
  RequestComment,
  ServiceCategory,
  ServiceRequest,
  ServiceRequestPriority,
  ServiceRequestStatus,
  StaffCandidate,
  TaskListItem,
  TaskStatus,
} from '@gc3/types';
import { SERVICE_REQUEST_TRANSITIONS } from '@gc3/types';
import { Badge } from '@gc3/ui';
import {
  addComment,
  ApiClientError,
  changeRequestStatus,
  createDeliverable,
  createTask,
  downloadDeliverableFile,
  fetchFileIntegrity,
  fetchStaffCandidates,
  getRequest,
  listCategories,
  listComments,
  listDeliverables,
  listDeliverableVersions,
  listTasks,
  updateDeliverable,
  updateDeliverableStatus,
  updateRequest,
  updateTask,
  uploadDeliverableFile,
} from '@/lib/api-client';
import { activeRoles } from '@/lib/session';
import { useSession } from '@/lib/session-context';
import {
  deliverableStatusLabel,
  deliverableStatusTone,
  formatBytes,
  formatDate,
  priorityLabel,
  requestStatusLabel,
  requestStatusTone,
  shortDigest,
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
  const [attachTarget, setAttachTarget] = useState<string | null>(null);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachNote, setAttachNote] = useState('');
  const [integrity, setIntegrity] = useState<Record<string, FileIntegrityReport>>({});
  const [categories, setCategories] = useState<readonly ServiceCategory[]>([]);
  const [editing, setEditing] = useState(false);
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [staff, setStaff] = useState<StaffCandidate[]>([]);
  const [taskDraft, setTaskDraft] = useState({ title: '', assigneeId: '' });
  const [taskBusy, setTaskBusy] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    priority: ServiceRequestPriority;
    categoryId: string;
  }>({ title: '', description: '', priority: 'NORMAL', categoryId: '' });

  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;
  // Tasks are internal: staff have a platform role, clients never do.
  const isStaff = Boolean(session?.actor.platformRole);

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

      // Staff-only: the internal checklist and who it can be assigned to. A client
      // never calls these paths, and the API answers 403 if they try.
      if (isStaff) {
        const loadedTasks = await listTasks(token, organizationId, requestId);
        setTasks(loadedTasks);
      }
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : 'Could not load this request',
      );
    } finally {
      setLoading(false);
    }

    // The assignee roster is a convenience: if this caller cannot read it, the
    // checklist still works with the assignees already recorded on each task.
    if (isStaff && token && organizationId) {
      try {
        setStaff(await fetchStaffCandidates(token, organizationId));
      } catch {
        setStaff([]);
      }
    }
  }, [token, organizationId, requestId, isStaff]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Staff-only: add a work item to this request. */
  async function addTask(event: React.FormEvent) {
    event.preventDefault();

    if (!token || !organizationId || !requestId || taskDraft.title.trim().length < 3) {
      return;
    }

    setTaskBusy('new');
    setActionError(null);
    setNotice(null);

    try {
      const created = await createTask(token, organizationId, requestId, {
        title: taskDraft.title.trim(),
        ...(taskDraft.assigneeId ? { assigneeId: taskDraft.assigneeId } : {}),
      });

      setTasks((current) => [...current, created]);
      setTaskDraft({ title: '', assigneeId: '' });
      setNotice('Task added.');
    } catch (caught) {
      setActionError(caught instanceof ApiClientError ? caught.message : 'Could not add the task');
    } finally {
      setTaskBusy(null);
    }
  }

  async function setTaskStatus(taskId: string, status: TaskStatus) {
    if (!token || !organizationId) {
      return;
    }

    setTaskBusy(taskId);
    setActionError(null);

    try {
      const updated = await updateTask(token, organizationId, taskId, { status });
      setTasks((current) => current.map((task) => (task.id === taskId ? updated : task)));
    } catch (caught) {
      setActionError(
        caught instanceof ApiClientError ? caught.message : 'Could not change the task status',
      );
    } finally {
      setTaskBusy(null);
    }
  }

  async function assignTask(taskId: string, assigneeId: string | null) {
    if (!token || !organizationId) {
      return;
    }

    setTaskBusy(taskId);
    setActionError(null);

    try {
      const updated = await updateTask(token, organizationId, taskId, { assigneeId });
      setTasks((current) => current.map((task) => (task.id === taskId ? updated : task)));
    } catch (caught) {
      setActionError(caught instanceof ApiClientError ? caught.message : 'Could not reassign the task');
    } finally {
      setTaskBusy(null);
    }
  }

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

  async function onUploadFile(
    event: React.FormEvent<HTMLFormElement>,
    deliverable: Deliverable,
  ) {
    event.preventDefault();

    if (!token || !organizationId || !request || !attachFile) {
      return;
    }

    setBusy(`file:${deliverable.id}`);
    setActionError(null);
    setNotice(null);

    try {
      const receipt = await uploadDeliverableFile(
        token,
        organizationId,
        request.id,
        deliverable.id,
        attachFile,
        attachNote.trim() || undefined,
      );

      setDeliverables((current) =>
        current.map((item) => (item.id === deliverable.id ? receipt.deliverable : item)),
      );
      setVersions((current) => {
        const next = { ...current };
        delete next[deliverable.id];
        return next;
      });
      setIntegrity((current) => {
        const next = { ...current };
        delete next[deliverable.id];
        return next;
      });

      setAttachTarget(null);
      setAttachFile(null);
      setAttachNote('');

      setNotice(
        receipt.approvalReset
          ? `Uploaded ${formatBytes(receipt.integrity.sizeBytes)} as version ${receipt.deliverable.version}. The previous approval was cleared — it is back to Pending and needs signing off again.`
          : `Uploaded ${formatBytes(receipt.integrity.sizeBytes)} as version ${receipt.deliverable.version}. SHA-256 ${shortDigest(receipt.integrity.sha256)}…`,
      );
    } catch (caught) {
      setActionError(caught instanceof ApiClientError ? caught.message : 'Could not upload the file');
    } finally {
      setBusy(null);
    }
  }

  async function onVerifyFile(deliverable: Deliverable) {
    if (!token || !organizationId) {
      return;
    }

    setBusy(`verify:${deliverable.id}`);
    setActionError(null);

    try {
      const report = await fetchFileIntegrity(token, organizationId, deliverable.id);
      setIntegrity((current) => ({ ...current, [deliverable.id]: report }));
    } catch (caught) {
      setActionError(
        caught instanceof ApiClientError ? caught.message : 'Could not verify the stored file',
      );
    } finally {
      setBusy(null);
    }
  }

  async function onDownloadFile(deliverable: Deliverable) {
    if (!token || !organizationId) {
      return;
    }

    setBusy(`download:${deliverable.id}`);
    setActionError(null);

    try {
      const blob = await downloadDeliverableFile(token, organizationId, deliverable.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = deliverable.title.replace(/[^\w.-]+/g, '-') || 'deliverable';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setActionError(
        caught instanceof ApiClientError ? caught.message : 'Could not download the file',
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading request…</p>;
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
      <Link href="/requests" className="text-xs text-slate-400 hover:text-slate-100">
        ← All requests
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
            {request.reference}
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-[-0.01em] text-slate-100">
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
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-100 transition-colors hover:border-emerald-400/40 hover:bg-white/10 disabled:opacity-50"
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
          <div key={item.label} className="rounded-[6px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] p-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
              {item.label}
            </p>
            <p className="mt-1 text-sm text-slate-100">{item.value}</p>
          </div>
        ))}
      </div>

      {editing ? (
        <form
          className="mt-5 rounded-[8px] border border-emerald-400/25 bg-[color:var(--bindu-void-2)] p-5"
          onSubmit={onSaveEdit}
        >
          <h2 className="text-sm font-semibold text-slate-100">Edit request</h2>

          <label className="mt-4 grid gap-1.5">
            <span className="text-xs font-medium text-slate-400">Title</span>
            <input
              required
              minLength={3}
              maxLength={200}
              value={editForm.title}
              onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
              className="rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
            />
          </label>

          <label className="mt-3 grid gap-1.5">
            <span className="text-xs font-medium text-slate-400">Description</span>
            <textarea
              required
              minLength={10}
              rows={5}
              maxLength={20_000}
              value={editForm.description}
              onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
              className="rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
            />
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-400">Priority</span>
              <select
                value={editForm.priority}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    priority: event.target.value as ServiceRequestPriority,
                  })
                }
                className="rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none"
              >
                {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as ServiceRequestPriority[]).map((value) => (
                  <option key={value} value={value}>
                    {value.charAt(0) + value.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-400">Category</span>
              <select
                value={editForm.categoryId}
                onChange={(event) => setEditForm({ ...editForm, categoryId: event.target.value })}
                className="rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none"
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
              className="min-h-10 rounded-[6px] border border-[#8B6410]/60 bg-[linear-gradient(120deg,#F2D582_0%,#C9911A_52%,#8B6410_100%)] px-4 py-2 text-sm font-medium text-[#080B12] disabled:cursor-not-allowed disabled:opacity-60"
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
              className="min-h-10 rounded-[6px] border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100 hover:bg-white/10 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <section className="mt-5 rounded-[8px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] p-5">
          <h2 className="text-sm font-semibold text-slate-100">Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">
            {request.description}
          </p>
        </section>
      )}

      {notice ? (
        <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
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
        <section className="mt-5 rounded-[8px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] p-5">
          <h2 className="text-sm font-semibold text-slate-100">Move this request</h2>
          <p className="mt-1 text-xs text-slate-400">
            Only transitions the workflow allows are offered; the API rejects the rest with 409.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {nextStatuses.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => void onTransition(status)}
                disabled={busy !== null}
                className="min-h-9 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-100 transition-colors hover:border-emerald-400/40 hover:bg-white/10 disabled:opacity-50"
              >
                {busy === `status:${status}` ? 'Moving…' : `→ ${requestStatusLabel(status)}`}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-[8px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] p-5">
          <h2 className="text-sm font-semibold text-slate-100">Comments</h2>

          {comments.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No comments yet.</p>
          ) : (
            <ul className="mt-3 grid gap-2.5">
              {comments.map((comment) => (
                <li
                  key={comment.id}
                  className="rounded-[6px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)]/60 px-3.5 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
                      {comment.isInternal ? 'Internal note' : 'Client visible'}
                    </span>
                    <span className="text-[11px] text-slate-400">{formatDate(comment.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-100">{comment.body}</p>
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
              className="rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-400/60 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
            />
            {canWriteInternal ? (
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={commentIsInternal}
                  onChange={(event) => setCommentIsInternal(event.target.checked)}
                  className="size-4 rounded border-white/20 bg-[color:var(--bindu-void-2)] accent-gold"
                />
                Internal note — hidden from the client
              </label>
            ) : (
              <p className="text-[11px] text-slate-400">
                Your comments are visible to the GC3 delivery team.
              </p>
            )}
            <button
              type="submit"
              disabled={busy !== null || draftComment.trim().length === 0}
              className="w-fit min-h-9 rounded-lg border border-[#8B6410]/60 bg-[linear-gradient(120deg,#F2D582_0%,#C9911A_52%,#8B6410_100%)] px-3.5 py-1.5 text-xs font-medium text-[#080B12] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'comment' ? 'Posting…' : 'Post comment'}
            </button>
          </form>
        </section>

        {/* Internal checklist — staff only. The API refuses this path to clients. */}
        {isStaff ? (
          <section className="rounded-[8px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-100">Internal tasks</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
                {tasks.filter((task) => task.status !== 'DONE' && task.status !== 'CANCELLED').length}{' '}
                open
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              How the pod breaks this request down. Clients never see this list.
            </p>

            {tasks.length === 0 ? (
              <p className="mt-3 text-[11px] text-slate-400">Nothing broken out yet.</p>
            ) : (
              <ul className="mt-3 grid gap-1.5">
                {tasks.map((task) => {
                  const busy = taskBusy === task.id;

                  return (
                    <li
                      key={task.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--bindu-surface-border)] bg-void/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs text-slate-100">{task.title}</p>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
                          {task.assigneeName ?? 'unassigned'}
                          {task.dueAt ? ` · due ${formatDate(task.dueAt)}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <select
                          aria-label={`Assignee for ${task.title}`}
                          disabled={busy}
                          value={task.assigneeId ?? ''}
                          onChange={(event) =>
                            void assignTask(task.id, event.target.value || null)
                          }
                          className="rounded border border-[color:var(--bindu-surface-border)] bg-void px-1.5 py-1 text-[10px] text-slate-100 focus:border-emerald-400/60 focus:outline-none disabled:opacity-50"
                        >
                          <option value="">Unassigned</option>
                          {staff.map((candidate) => (
                            <option key={candidate.userId} value={candidate.userId}>
                              {candidate.fullName}
                            </option>
                          ))}
                        </select>

                        <select
                          aria-label={`Status for ${task.title}`}
                          disabled={busy}
                          value={task.status}
                          onChange={(event) =>
                            void setTaskStatus(task.id, event.target.value as TaskStatus)
                          }
                          className="rounded border border-[color:var(--bindu-surface-border)] bg-void px-1.5 py-1 text-[10px] uppercase tracking-[0.06em] text-slate-100 focus:border-emerald-400/60 focus:outline-none disabled:opacity-50"
                        >
                          {(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'] as TaskStatus[]).map(
                            (status) => (
                              <option key={status} value={status}>
                                {status.replace(/_/g, ' ')}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <form onSubmit={addTask} className="mt-3 flex flex-wrap items-center gap-2">
              <input
                required
                minLength={3}
                value={taskDraft.title}
                onChange={(event) =>
                  setTaskDraft((draft) => ({ ...draft, title: event.target.value }))
                }
                placeholder="Break out a work item…"
                className="min-w-0 flex-1 rounded-lg border border-[color:var(--bindu-surface-border)] bg-void px-3 py-2 text-xs text-slate-100 focus:border-emerald-400/60 focus:outline-none"
              />
              <select
                aria-label="Assign the new task to"
                value={taskDraft.assigneeId}
                onChange={(event) =>
                  setTaskDraft((draft) => ({ ...draft, assigneeId: event.target.value }))
                }
                className="rounded-lg border border-[color:var(--bindu-surface-border)] bg-void px-2 py-2 text-xs text-slate-100 focus:border-emerald-400/60 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {staff.map((candidate) => (
                  <option key={candidate.userId} value={candidate.userId}>
                    {candidate.fullName}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={taskBusy === 'new' || taskDraft.title.trim().length < 3}
                className="rounded-lg border border-emerald-400/40 bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/20 disabled:opacity-50"
              >
                {taskBusy === 'new' ? 'Adding…' : 'Add task'}
              </button>
            </form>
          </section>
        ) : null}

        <section className="rounded-[8px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-100">Deliverables</h2>
            {canCreateDeliverable && !showDeliverableForm ? (
              <button
                type="button"
                onClick={() => setShowDeliverableForm(true)}
                className="rounded-md border border-emerald-400/35 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-200 hover:bg-emerald-400/20"
              >
                + Add deliverable
              </button>
            ) : null}
          </div>

          {canCreateDeliverable && showDeliverableForm ? (
            <form
              className="mt-3 grid gap-2 rounded-[6px] border border-emerald-400/25 bg-[color:var(--bindu-void-2)]/60 p-3"
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
                className="rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/60 focus:border-emerald-400/60 focus:outline-none"
              />
              <input
                maxLength={1000}
                value={deliverableForm.description}
                onChange={(event) =>
                  setDeliverableForm({ ...deliverableForm, description: event.target.value })
                }
                placeholder="Short description (optional)"
                className="rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/60 focus:border-emerald-400/60 focus:outline-none"
              />
              <input
                type="url"
                maxLength={500}
                value={deliverableForm.fileUrl}
                onChange={(event) =>
                  setDeliverableForm({ ...deliverableForm, fileUrl: event.target.value })
                }
                placeholder="https://files.example.com/output.pdf (optional)"
                className="rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-400/60 focus:border-emerald-400/60 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy !== null}
                  className="rounded-md border border-[#8B6410]/60 bg-[linear-gradient(120deg,#F2D582_0%,#C9911A_52%,#8B6410_100%)] px-3 py-1.5 text-[11px] font-medium text-ink disabled:opacity-50"
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
                  className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-slate-100 hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {deliverables.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Nothing delivered against this request yet.</p>
          ) : (
            <ul className="mt-3 grid gap-2.5">
              {deliverables.map((deliverable) => (
                <li
                  key={deliverable.id}
                  className="rounded-[6px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)]/60 px-3.5 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-100">
                        {deliverable.title}
                        <span className="ml-2 rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">
                          v{deliverable.version}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {deliverable.approvedAt
                          ? `Approved ${formatDate(deliverable.approvedAt)}`
                          : 'Awaiting approval'}
                      </p>
                      {deliverable.fileKey ? (
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">
                          {deliverable.fileMimeType} · {formatBytes(deliverable.fileSize)} · sha256{' '}
                          {shortDigest(deliverable.fileSha256)}
                        </p>
                      ) : null}
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
                        className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-100 hover:bg-white/10 disabled:opacity-50"
                      >
                        Edit content
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void toggleVersions(deliverable)}
                      disabled={busy !== null}
                      className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-100 hover:bg-white/10 disabled:opacity-50"
                    >
                      {versions[deliverable.id]
                        ? 'Hide history'
                        : `History (v${deliverable.version})`}
                    </button>

                    {deliverable.fileKey ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void onDownloadFile(deliverable)}
                          disabled={busy !== null}
                          className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-100 hover:bg-white/10 disabled:opacity-50"
                        >
                          {busy === `download:${deliverable.id}` ? 'Downloading…' : 'Download'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onVerifyFile(deliverable)}
                          disabled={busy !== null}
                          className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-100 hover:bg-white/10 disabled:opacity-50"
                        >
                          {busy === `verify:${deliverable.id}` ? 'Checking…' : 'Verify checksum'}
                        </button>
                      </>
                    ) : null}

                    {canCreateDeliverable && attachTarget !== deliverable.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAttachTarget(deliverable.id);
                          setAttachFile(null);
                          setAttachNote('');
                        }}
                        disabled={busy !== null}
                        className="rounded-md border border-emerald-400/35 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-50"
                      >
                        {deliverable.fileKey ? 'Replace file' : 'Attach file'}
                      </button>
                    ) : null}

                    {integrity[deliverable.id] ? (
                      <span
                        className={
                          integrity[deliverable.id]!.ok
                            ? 'self-center text-[11px] text-emerald-300'
                            : 'self-center text-[11px] text-red-300'
                        }
                      >
                        {integrity[deliverable.id]!.ok
                          ? 'Checksum OK — stored bytes match the record'
                          : `Checksum MISMATCH — expected ${shortDigest(integrity[deliverable.id]!.expectedSha256)}…, found ${shortDigest(integrity[deliverable.id]!.actualSha256)}…`}
                      </span>
                    ) : null}
                  </div>

                  {attachTarget === deliverable.id ? (
                    <form
                      className="mt-2.5 grid gap-2 rounded-lg border border-gold/30 bg-black/20 p-3"
                      onSubmit={(event) => void onUploadFile(event, deliverable)}
                    >
                      <input
                        type="file"
                        onChange={(event) => setAttachFile(event.target.files?.[0] ?? null)}
                        className="text-[11px] text-slate-400 file:mr-2 file:rounded file:border file:border-white/15 file:bg-white/5 file:px-2 file:py-1 file:text-[11px] file:text-slate-100"
                      />
                      <input
                        maxLength={500}
                        value={attachNote}
                        onChange={(event) => setAttachNote(event.target.value)}
                        placeholder="Why this file (optional, recorded on the version)"
                        className="rounded-md border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-400/60 focus:outline-none"
                      />
                      <p className="text-[11px] text-slate-400">
                        The bytes are stored and hashed on arrival. If this deliverable has already
                        been approved or released, uploading clears that approval.
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          type="submit"
                          disabled={busy !== null || attachFile === null}
                          className="rounded-md border border-[#8B6410]/60 bg-[linear-gradient(120deg,#F2D582_0%,#C9911A_52%,#8B6410_100%)] px-3 py-1.5 text-[11px] font-medium text-ink disabled:opacity-50"
                        >
                          {busy === `file:${deliverable.id}` ? 'Uploading…' : 'Upload'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachTarget(null);
                            setAttachFile(null);
                            setAttachNote('');
                          }}
                          disabled={busy !== null}
                          className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-slate-100 hover:bg-white/10 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}

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
                        className="rounded-md border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-400/60 focus:outline-none"
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
                        className="rounded-md border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-400/60 focus:outline-none"
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
                        className="rounded-md border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-2.5 py-1.5 font-mono text-[11px] text-slate-100 focus:border-emerald-400/60 focus:outline-none"
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
                        className="rounded-md border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-400/60 focus:outline-none"
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
                          className="rounded-md border border-[#8B6410]/60 bg-[linear-gradient(120deg,#F2D582_0%,#C9911A_52%,#8B6410_100%)] px-3 py-1.5 text-[11px] font-medium text-ink disabled:opacity-50"
                        >
                          {busy === `deliverable:edit:${deliverable.id}`
                            ? 'Saving…'
                            : 'Save new version'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDeliverableId(null)}
                          disabled={busy !== null}
                          className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-slate-100 hover:bg-white/10 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {versions[deliverable.id] ? (
                    <ol className="mt-2.5 grid gap-1.5 border-l border-gold/25 pl-3">
                      {versions[deliverable.id]!.map((version) => (
                        <li key={version.id} className="text-[11px] text-slate-400">
                          <span className="font-mono uppercase tracking-[0.08em] text-slate-100">
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
                          className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-100 hover:bg-white/10 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      ) : null}
                      {deliverable.status === 'APPROVED' ? (
                        <button
                          type="button"
                          onClick={() => void onDeliverableStatus(deliverable, 'RELEASED')}
                          disabled={busy !== null}
                          className="rounded-md border border-emerald-400/35 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-50"
                        >
                          Release to client
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-400">
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
