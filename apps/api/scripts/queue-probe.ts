// Cross-process durability probe, used by the queue test suite.
//
// Deliberately a *separate process*: the only convincing proof that a queued job
// survives a restart is that one process puts it in Redis, exits, and a different
// process finds it afterwards.
//
//   tsx scripts/queue-probe.ts produce <prefix> <count>
//   tsx scripts/queue-probe.ts consume <prefix> <count>
import 'dotenv/config';
import { createDurableQueue } from '../src/queue/durable-queue';

const [mode, prefix, rawCount] = process.argv.slice(2);
const count = Number(rawCount ?? 1);

if (!mode || !prefix) {
  console.error('usage: queue-probe.ts <produce|consume> <prefix> <count>');
  process.exit(2);
}

const queue = createDurableQueue({
  name: 'gc3-work',
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  prefix,
});

if (mode === 'produce') {
  for (let index = 0; index < count; index += 1) {
    await queue.add('event', { marker: `probe-${index}` });
  }

  console.log(JSON.stringify({ mode, queued: await queue.counts() }));
  await queue.close();
  // No worker ever started here: the jobs are now Redis's problem.
  process.exit(0);
}

const seen: string[] = [];
queue.startWorker(async (job) => {
  seen.push((job.data as { marker?: string }).marker ?? 'unknown');

  if (seen.length >= count) {
    console.log(JSON.stringify({ mode, consumed: seen }));
    // Exit from inside a job handler on purpose: closing the worker here would wait
    // for this very job to finish, which is a deadlock. The durable queue does not
    // need a graceful close to prove the point.
    process.exit(0);
  }
});

setTimeout(() => {
  console.log(JSON.stringify({ mode, timeout: true, consumed: seen }));
  process.exit(1);
}, 15_000).unref();
