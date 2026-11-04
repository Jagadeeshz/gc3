// Enqueues an arbitrary job into the durable queue — used to prove that a
// scheduled job name the API registers (retry-sweep, sla-sweep) is really handled
// by the worker, without waiting for the schedule to come round.
//
//   tsx scripts/enqueue-job.ts <jobName> [jsonData]
import 'dotenv/config';
import { createDurableQueue } from '../src/queue/durable-queue';

const [jobName, rawData] = process.argv.slice(2);

if (!jobName) {
  console.error('usage: enqueue-job.ts <jobName> [jsonData]');
  process.exit(2);
}

const queue = createDurableQueue({
  name: 'gc3-work',
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  prefix: process.env.QUEUE_PREFIX ?? 'gc3',
});

const jobId = await queue.add(jobName, rawData ? JSON.parse(rawData) : {});

console.log(JSON.stringify({ enqueued: jobName, jobId, counts: await queue.counts() }));
await queue.close();
