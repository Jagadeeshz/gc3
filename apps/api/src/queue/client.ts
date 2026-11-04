import { env } from '../config/env';
import { createDurableQueue, type DurableQueue } from './durable-queue';

/**
 * The application's durable queue, or null when the in-process driver is active.
 *
 * Deliberately a lazy singleton owned by this module and nothing else: the event
 * dispatcher asks it to enqueue, the worker module asks it to start a worker, and
 * neither of them imports the other.
 */
let queue: DurableQueue | null = null;

export function durableDispatchEnabled(): boolean {
  return env.EVENT_QUEUE_DRIVER === 'redis';
}

export function getDurableQueue(): DurableQueue {
  if (!durableDispatchEnabled()) {
    throw new Error('Durable dispatch is disabled — set EVENT_QUEUE_DRIVER=redis');
  }

  if (!env.REDIS_URL) {
    throw new Error('EVENT_QUEUE_DRIVER=redis requires REDIS_URL');
  }

  queue ??= createDurableQueue({
    name: 'gc3-work',
    url: env.REDIS_URL,
    prefix: env.QUEUE_PREFIX,
  });

  return queue;
}

export async function closeDurableQueue(): Promise<void> {
  if (queue) {
    const closing = queue;
    queue = null;
    await closing.close();
  }
}
