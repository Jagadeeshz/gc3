// Enqueues one real event job while the API is stopped, so the durability claim
// can be demonstrated rather than asserted: the job must sit in Redis and be
// delivered by the worker the API starts afterwards.
//
//   tsx scripts/enqueue-live-event.ts <organizationId> <requestId>
import 'dotenv/config';
import { createDurableQueue } from '../src/queue/durable-queue';

const [organizationId, requestId, rawDelay] = process.argv.slice(2);
const delayMs = Number(rawDelay ?? 0);

if (!organizationId || !requestId) {
  console.error('usage: enqueue-live-event.ts <organizationId> <requestId> [delayMs]');
  process.exit(2);
}

const queue = createDurableQueue({
  name: 'gc3-work',
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  prefix: process.env.QUEUE_PREFIX ?? 'gc3',
});

await queue.add(
  'event',
  {
    kind: 'request_status_updated',
    organizationId,
    requestId,
    fromStatus: 'IN_REVIEW',
    toStatus: 'DELIVERED',
  },
  delayMs > 0 ? { delayMs } : {},
);

console.log(JSON.stringify({ enqueued: true, counts: await queue.counts() }));
await queue.close();
