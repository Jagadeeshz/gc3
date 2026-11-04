import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import IORedis from 'ioredis';
import { API, authPost, createMember, createOrganization } from './helpers/api';
import { env } from '../src/config/env';
import { createDurableQueue, type DurableQueue } from '../src/queue/durable-queue';
import { closeDurableQueue } from '../src/queue/client';
import { enqueueEvent } from '../src/notifications/events';
import { getEventOutbox, resetNotificationService, setNotificationService } from '../src/notifications';
import { MemoryNotificationService } from '../src/notifications/drivers';
import { startDurableWorkers, type DurableWorkers } from '../src/queue/workers';

/**
 * Durability tests.
 *
 * These run against the actual Redis the API uses (REDIS_URL, default
 * localhost:6379) under a throwaway prefix. They are skipped — not faked — when
 * Redis is not reachable, because a "durable queue" tested against an in-memory
 * stub proves nothing at all.
 */
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

let redisUp = false;
let probe: IORedis | null = null;

beforeAll(async () => {
  probe = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    // Fail fast instead of retrying forever when there is no server.
    retryStrategy: () => null,
    lazyConnect: true,
  });

  try {
    await probe.connect();
    await probe.ping();
    redisUp = true;
  } catch {
    redisUp = false;
  }
});

afterAll(async () => {
  if (probe) {
    await probe.quit().catch(() => probe?.disconnect());
  }
});

function uniquePrefix(): string {
  return `gc3-test-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check: () => Promise<boolean> | boolean, timeoutMs = 8_000, step = 100) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await check()) {
      return true;
    }

    await sleep(step);
  }

  return false;
}

describe.skipIf(!process.env.REDIS_URL && !redisUp)('durable queue', () => {
  let queue: DurableQueue | null = null;
  let prefix = '';

  beforeEach(() => {
    prefix = uniquePrefix();
  });

  afterAll(async () => {
    if (queue) {
      await queue.obliterate().catch(() => undefined);
      await queue.close().catch(() => undefined);
      queue = null;
    }
  });

  it('keeps a job in Redis when no worker is running', async () => {
    queue = createDurableQueue({ name: 'gc3-work', url: REDIS_URL, prefix });

    await queue.add('event', { kind: 'request_status_updated' });

    // Nothing is consuming: the job has to be sitting in Redis, not in a promise.
    await sleep(300);
    const counts = await queue.counts();

    expect(counts.waiting).toBe(1);
    expect(counts.completed).toBe(0);
  });

  it('is picked up by a worker started afterwards — the restart case', async () => {
    const producer = createDurableQueue({ name: 'gc3-work', url: REDIS_URL, prefix });
    await producer.add('event', { marker: 'survives-the-producer' });

    // The producing "process" goes away with the job still queued.
    await producer.close();

    const consumer = createDurableQueue({ name: 'gc3-work', url: REDIS_URL, prefix });
    const seen: unknown[] = [];

    consumer.startWorker(async (job) => {
      seen.push(job.data);
    });

    expect(await waitFor(() => seen.length === 1)).toBe(true);
    expect(seen[0]).toEqual({ marker: 'survives-the-producer' });

    queue = consumer;
  });

  it('survives a real process death: one process queues, another drains', async () => {
    // Spawn node with the tsx loader directly rather than going through a package
    // manager shim: no shell, no .cmd, same behaviour on every platform.
    const runProbe = (mode: 'produce' | 'consume') =>
      spawnSync(
        process.execPath,
        ['--import', 'tsx', 'scripts/queue-probe.ts', mode, prefix, '2'],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: { ...process.env, REDIS_URL },
          timeout: 60_000,
        },
      );

    // Process one: queues two jobs and exits without ever starting a worker.
    const produced = runProbe('produce');
    expect(produced.status, produced.stderr).toBe(0);

    const producedBody = JSON.parse(produced.stdout.trim().split('\n').pop() ?? '{}');
    expect(producedBody.queued.waiting).toBe(2);

    // The queue is still holding them, with no process attached to it.
    const inspect = createDurableQueue({ name: 'gc3-work', url: REDIS_URL, prefix });
    expect((await inspect.counts()).waiting).toBe(2);
    await inspect.close();

    // Process two: a fresh worker finds both.
    const consumed = runProbe('consume');
    expect(consumed.status, consumed.stderr).toBe(0);

    const consumedBody = JSON.parse(consumed.stdout.trim().split('\n').pop() ?? '{}');
    expect(consumedBody.consumed.sort()).toEqual(['probe-0', 'probe-1']);
  }, 120_000);

  it('upserts the schedule instead of stacking a second copy on restart', async () => {
    queue = createDurableQueue({ name: 'gc3-work', url: REDIS_URL, prefix });

    await queue.scheduleEvery('sla-sweep', 'sla-sweep', 60_000);
    await queue.scheduleEvery('sla-sweep', 'sla-sweep', 60_000);
    await queue.scheduleEvery('sla-sweep', 'sla-sweep', 60_000);

    const schedulers = await queue.counts();
    expect(schedulers.failed).toBe(0);

    // Same scheduler id, same single entry — a restart refreshes, never duplicates.
    const keys = await probe!.keys(`${prefix}:*`);
    const schedulerKeys = keys.filter((key) => key.includes('repeat'));
    expect(new Set(schedulerKeys).size).toBe(schedulerKeys.length);
  });
});

describe.skipIf(!process.env.REDIS_URL && !redisUp)('the application dispatches through Redis', () => {
  let prefix = '';
  let workers: DurableWorkers | null = null;

  afterAll(async () => {
    if (workers) {
      await workers.stop().catch(() => undefined);
      workers = null;
    }

    await closeDurableQueue().catch(() => undefined);

    const cleanup = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
    const keys = await cleanup.keys(`${prefix}:*`);
    if (keys.length > 0) {
      await cleanup.del(...keys);
    }
    await cleanup.quit();

    // Back to the deterministic in-process path for the rest of the suite.
    env.EVENT_QUEUE_DRIVER = 'memory';
    env.QUEUE_PREFIX = 'gc3';
    resetNotificationService();
  });

  it('queues the email, and a worker that starts later sends it', async () => {
    prefix = uniquePrefix();

    // Point the app at Redis for this test only.
    env.EVENT_QUEUE_DRIVER = 'redis';
    env.REDIS_URL = REDIS_URL;
    env.QUEUE_PREFIX = prefix;

    setNotificationService(new MemoryNotificationService());

    const organization = await createOrganization({ name: 'Durable Co' });
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    const created = await authPost(
      `${API}/service-requests`,
      owner.token,
      {
        title: 'Durability check',
        description: 'A request whose status email must survive a missing worker.',
        status: 'SUBMITTED',
      },
      organization.id,
    ).expect(201);

    const requestId = created.body.data.id as string;

    // The API path enqueues...
    enqueueEvent({
      kind: 'request_status_updated',
      organizationId: organization.id,
      requestId,
      fromStatus: 'SUBMITTED',
      toStatus: 'TRIAGE',
    });

    // ...and with no worker running, the job sits in Redis and nothing is sent.
    await waitFor(async () => (await probe!.llen(`${prefix}:gc3-work:wait`)) >= 0);
    await sleep(500);

    expect(getEventOutbox()).toHaveLength(0);

    const queued = await probe!.keys(`${prefix}:*`);
    expect(queued.length).toBeGreaterThan(0);

    // A worker comes up — the durability a restart relies on.
    workers = await startDurableWorkers();

    expect(await waitFor(() => getEventOutbox().length === 1)).toBe(true);

    const message = getEventOutbox()[0];
    expect(message).toMatchObject({ to: owner.email, kind: 'request_status_updated' });
    expect(message?.requestUrl).toContain(`/requests/${requestId}`);
  });
});
