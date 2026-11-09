'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import type { RequestComment, ServiceRequest } from '@gc3/types';
import { ApiClientError, addComment, listComments, listRequests } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { formatDate, requestStatusLabel } from '@/components/portal/status';
import { EmptyState, ErrorNote, Loading, PageHeader, timeAgo } from '@/components/portal/kit';

/**
 * Messages.
 *
 * Conversations in this platform live on the work they are about: every request
 * carries its own thread. That is not a limitation to work around — it is what
 * keeps context attached to the work, instead of a second inbox nobody can map
 * back to a job.
 *
 * Internal staff notes exist on the same table but the API strips them for a
 * client token, so nothing internal can appear here even by accident.
 */
export default function MessagesPage() {
  const { session } = useSession();
  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;
  const actorId = session?.actor.userId ?? null;

  const [requests, setRequests] = useState<readonly ServiceRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comments, setComments] = useState<readonly RequestComment[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!token || !organizationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const page = await listRequests(token, organizationId, { pageSize: 50 });
      const sorted = [...page.items].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

      setRequests(sorted);
      setSelectedId((current) => current ?? sorted[0]?.id ?? null);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load your messages.');
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  const loadThread = useCallback(
    async (requestId: string) => {
      if (!token || !organizationId) {
        return;
      }

      setThreadLoading(true);

      try {
        setComments(await listComments(token, organizationId, requestId));
      } catch (caught) {
        setError(caught instanceof ApiClientError ? caught.message : 'Could not open that thread.');
        setComments([]);
      } finally {
        setThreadLoading(false);
      }
    },
    [token, organizationId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selectedId) {
      void loadThread(selectedId);
    }
  }, [selectedId, loadThread]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [comments]);

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId],
  );

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !organizationId || !selectedId || draft.trim().length === 0) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      await addComment(token, organizationId, selectedId, draft.trim(), false);
      setDraft('');
      await loadThread(selectedId);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not send that message.');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Loading label="Loading conversations…" />;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Engagement"
        title="Messages"
        description="Every conversation belongs to the work it is about. Internal notes are never shown here."
      />

      {error ? <ErrorNote message={error} /> : null}

      {requests.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          body="A thread opens automatically with your first service request — that is where our pods and you talk about the work."
          action={{ href: '/requests/new', label: 'Raise a request' }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <aside className="overflow-hidden rounded-[6px] border border-[color:var(--bindu-surface-border)]">
            <p className="border-b border-[color:var(--bindu-surface-border)] bg-white/[0.03] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
              Conversations
            </p>
            <ul className="max-h-[520px] overflow-y-auto">
              {requests.map((request) => {
                const active = request.id === selectedId;

                return (
                  <li key={request.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(request.id)}
                      className={[
                        'w-full border-b border-white/6 px-4 py-3 text-left transition-colors',
                        active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]',
                      ].join(' ')}
                    >
                      <p className="truncate text-xs text-slate-100">{request.title}</p>
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400">
                        {request.reference} · {timeAgo(request.updatedAt)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="flex min-h-[520px] flex-col overflow-hidden rounded-[6px] border border-[color:var(--bindu-surface-border)]">
            {selected ? (
              <>
                <header className="border-b border-[color:var(--bindu-surface-border)] bg-white/[0.03] px-5 py-3">
                  <p className="text-sm font-semibold text-slate-100">{selected.title}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
                    {selected.reference} · {requestStatusLabel(selected.status)} · opened{' '}
                    {formatDate(selected.createdAt)}
                  </p>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {threadLoading ? (
                    <p className="text-xs text-slate-400">Loading thread…</p>
                  ) : comments.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No messages yet. Say hello — a real person on the delivery pod reads this.
                    </p>
                  ) : (
                    <ul className="grid gap-3">
                      {comments.map((comment) => {
                        const mine = comment.authorId === actorId;

                        return (
                          <li
                            key={comment.id}
                            className={[
                              'max-w-[85%] rounded-[6px] border px-3.5 py-2.5',
                              mine
                                ? 'ml-auto border-gold/25 bg-gold/[0.07]'
                                : 'border-[color:var(--bindu-surface-border)] bg-white/[0.03]',
                            ].join(' ')}
                          >
                            <p className="text-[10px] uppercase tracking-[0.1em] text-slate-400">
                              {mine ? 'You' : 'GC³ team'} · {timeAgo(comment.createdAt)}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-100">{comment.body}</p>
                          </li>
                        );
                      })}
                      <div ref={endRef} />
                    </ul>
                  )}
                </div>

                <form onSubmit={send} className="border-t border-[color:var(--bindu-surface-border)] px-4 py-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={2}
                      placeholder="Write a reply…"
                      className="flex-1 resize-none rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/60 focus:border-emerald-400/60 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={sending || draft.trim().length === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/20 disabled:opacity-50"
                    >
                      {sending ? (
                        <Loader2 aria-hidden className="size-3.5 animate-spin" strokeWidth={2} />
                      ) : (
                        <Send aria-hidden className="size-3.5" strokeWidth={1.9} />
                      )}
                      Send
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="grid flex-1 place-items-center px-6 text-center text-xs text-slate-400">
                Pick a conversation on the left.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
