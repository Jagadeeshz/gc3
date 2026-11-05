import { hostname } from 'node:os';
import IORedis from 'ioredis';
import { env } from '../config/env';

/**
 * Worker heartbeat.
 *
 * The queue can say what is *pending*; only a heartbeat can say whether anything
 * is still *working*. A worker that dies leaves jobs sitting in `waiting` and
 * looks healthy from the counts alone — which is exactly the failure this exists
 * to catch.
 *
 * The beat is written to Redis with a TTL so a dead process expires on its own
 * rather than leaving a stale "I am fine" behind. When Redis is not configured
 * (the in-process driver) the beat lives in memory, which still answers the only
 * question that matters here: are the background loops running in this process?
 */
export interface Heartbeat {
  readonly pid: number;
  readonly hostname: string;
  readonly startedAt: string;
  readonly lastSeenAt: string;
  readonly intervalSeconds: number;
  readonly driver: 'redis' | 'memory';
}

const KEY_PREFIX = 'heartbeat:worker';

let memoryBeat: Heartbeat | null = null;
let redis: IORedis | null = null;
let timer: NodeJS.Timeout | null = null;

function keyFor(): string {
  return `${env.QUEUE_PREFIX}:${KEY_PREFIX}`;
}

function connection(): IORedis | null {
  if (env.EVENT_QUEUE_DRIVER !== 'redis' || !env.REDIS_URL) {
    return null;
  }

  redis ??= new IORedis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
  return redis;
}

function stamp(): Heartbeat {
  return {
    pid: process.pid,
    hostname: hostname(),
    startedAt: memoryBeat?.startedAt ?? new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    intervalSeconds: env.WORKER_HEARTBEAT_INTERVAL_SECONDS,
    driver: env.EVENT_QUEUE_DRIVER,
  };
}

async function writeBeat(): Promise<void> {
  const beat = stamp();
  memoryBeat = beat;

  const client = connection();

  if (!client) {
    return;
  }

  try {
    // TTL is generous enough to survive one slow tick, tight enough that a dead
    // process stops claiming to be alive within a minute.
    await client.set(keyFor(), JSON.stringify(beat), 'EX', env.WORKER_HEARTBEAT_TTL_SECONDS);
  } catch {
    // A heartbeat that cannot reach Redis must never take the API down; the
    // in-memory copy still answers reads from this process.
  }
}

/** Starts beating. Safe to call twice — the second call is a no-op. */
export function startHeartbeat(): void {
  if (timer) {
    return;
  }

  void writeBeat();
  timer = setInterval(() => void writeBeat(), env.WORKER_HEARTBEAT_INTERVAL_SECONDS * 1_000);
  timer.unref?.();
}

export async function stopHeartbeat(): Promise<void> {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  const client = connection();

  if (client) {
    try {
      await client.del(keyFor());
      await client.quit();
    } catch {
      // Closing a broken connection is not worth a crash on the way out.
    } finally {
      redis = null;
    }
  }

  memoryBeat = null;
}

/**
 * The freshest beat this process can see.
 *
 * Redis first, because that is the copy a second worker would also write; memory
 * as the fallback, so a Redis-less deployment still reports honestly.
 */
export async function readHeartbeat(): Promise<Heartbeat | null> {
  const client = connection();

  if (client) {
    try {
      const raw = await client.get(keyFor());

      if (raw) {
        return JSON.parse(raw) as Heartbeat;
      }
    } catch {
      // fall through to the in-memory beat
    }
  }

  return memoryBeat;
}
