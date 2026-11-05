import { describe, expect, it } from 'vitest';
import { API, authGet, createMember, createOrganization, createStaff } from './helpers/api';
import { buildQueueReport, workerStatus } from '../src/observability/queue-health';

const NOW = Date.parse('2026-11-05T10:00:00.000Z');

function report(overrides: Partial<Parameters<typeof buildQueueReport>[0]> = {}) {
  return buildQueueReport({
    driver: 'redis',
    queueName: 'gc3-work',
    counts: { waiting: 0, active: 0, delayed: 0, failed: 0, completed: 12 },
    paused: false,
    schedulers: [
      { id: 'retry-sweep', everyMs: 300_000, nextRunAt: NOW + 60_000 },
      { id: 'sla-sweep', everyMs: 300_000, nextRunAt: NOW + 60_000 },
    ],
    heartbeat: {
      pid: 4242,
      hostname: 'worker-1',
      startedAt: '2026-11-05T09:00:00.000Z',
      lastSeenAt: new Date(NOW - 5_000).toISOString(),
    },
    now: NOW,
    heartbeatIntervalSeconds: 15,
    backlogThreshold: 50,
    ...overrides,
  });
}

describe('buildQueueReport — what an operator is told', () => {
  it('is silent when the queue is drained and the worker is beating', () => {
    const health = report();

    expect(health.alerts).toHaveLength(0);
    expect(health.worker.status).toBe('UP');
    expect(health.worker.ageSeconds).toBe(5);
    expect(health.driver).toBe('redis');
  });

  it('calls a missing heartbeat critical — a dead worker looks idle, not broken', () => {
    const health = report({ heartbeat: null });

    expect(health.worker.status).toBe('ABSENT');
    expect(health.alerts.map((alert) => alert.code)).toContain('WORKER_HEARTBEAT_MISSING');
    expect(health.alerts.find((alert) => alert.code === 'WORKER_HEARTBEAT_MISSING')?.level).toBe(
      'CRITICAL',
    );
  });

  it('calls a stale heartbeat critical, and says how stale', () => {
    const health = report({
      heartbeat: {
        pid: 4242,
        hostname: 'worker-1',
        startedAt: '2026-11-05T09:00:00.000Z',
        lastSeenAt: new Date(NOW - 120_000).toISOString(),
      },
    });

    const alert = health.alerts.find((entry) => entry.code === 'WORKER_HEARTBEAT_STALE');

    expect(health.worker.status).toBe('STALE');
    expect(health.worker.ageSeconds).toBe(120);
    expect(alert?.level).toBe('CRITICAL');
    expect(alert?.message).toContain('120s');
  });

  it('bounds staleness at twice the beat interval', () => {
    const fresh = workerStatus({
      heartbeat: { pid: 1, hostname: 'h', startedAt: '', lastSeenAt: new Date(NOW - 30_000).toISOString() },
      now: NOW,
      heartbeatIntervalSeconds: 15,
      driver: 'redis',
      inline: false,
    });
    const late = workerStatus({
      heartbeat: { pid: 1, hostname: 'h', startedAt: '', lastSeenAt: new Date(NOW - 31_000).toISOString() },
      now: NOW,
      heartbeatIntervalSeconds: 15,
      driver: 'redis',
      inline: false,
    });

    expect(fresh.status).toBe('UP');
    expect(late.status).toBe('STALE');
  });

  it('reports the in-process driver as inline, and says what that costs', () => {
    const health = report({ driver: 'memory', queueName: 'in-process', schedulers: [] });

    expect(health.worker.status).toBe('INLINE');
    const alert = health.alerts.find((entry) => entry.code === 'DURABLE_DISPATCH_DISABLED');

    expect(alert?.level).toBe('INFO');
    expect(alert?.message).toContain('lost on restart');
  });

  it('warns on a backlog and stays quiet below the threshold', () => {
    expect(report({ counts: { waiting: 50, active: 0, delayed: 0, failed: 0, completed: 0 } }).alerts)
      .toHaveLength(0);

    const backed = report({ counts: { waiting: 51, active: 0, delayed: 0, failed: 0, completed: 0 } });
    const alert = backed.alerts.find((entry) => entry.code === 'QUEUE_BACKLOG');

    expect(alert?.level).toBe('WARNING');
    expect(alert?.message).toContain('51 jobs are waiting');
  });

  it('calls failed jobs critical, because nothing retries them but the sweep', () => {
    const health = report({ counts: { waiting: 0, active: 0, delayed: 0, failed: 2, completed: 3 } });

    expect(health.alerts.find((entry) => entry.code === 'JOBS_FAILING')?.level).toBe('CRITICAL');
  });

  it('flags a paused queue', () => {
    const health = report({ paused: true });

    expect(health.alerts.find((entry) => entry.code === 'QUEUE_PAUSED')?.level).toBe('CRITICAL');
  });

  it('flags a durable queue whose sweeps are not scheduled', () => {
    const health = report({ schedulers: [] });
    const alert = health.alerts.find((entry) => entry.code === 'SCHEDULER_MISSING');

    expect(alert?.level).toBe('WARNING');
    expect(alert?.message).toMatch(/retry-sweep|sla-sweep/);
  });

  it('carries the scheduler detail through, so the console can show the next run', () => {
    const health = report();

    expect(health.schedulers).toHaveLength(2);
    expect(health.schedulers[0]).toMatchObject({ id: 'retry-sweep', everyMs: 300_000 });
    expect(health.schedulers[0]?.nextRunAt).toBe(NOW + 60_000);
  });
});

describe('GET /ops/queue/stats', () => {
  it('requires a token and platform operations access', async () => {
    await authGet(`${API}/ops/queue/stats`, 'not-a-token').expect(401);

    const organization = await createOrganization();
    const client = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    await authGet(`${API}/ops/queue/stats`, client.token).expect(403);
  });

  it('returns the live report to an operations manager', async () => {
    const manager = await createStaff('OPERATIONS_MANAGER');

    const response = await authGet(`${API}/ops/queue/stats`, manager.token).expect(200);
    const health = response.body.data;

    expect(['redis', 'memory']).toContain(health.driver);
    expect(typeof health.queueName).toBe('string');
    expect(health.counts).toEqual(
      expect.objectContaining({
        waiting: expect.any(Number),
        active: expect.any(Number),
        failed: expect.any(Number),
      }),
    );
    expect(['UP', 'STALE', 'ABSENT', 'INLINE']).toContain(health.worker.status);
    expect(Array.isArray(health.alerts)).toBe(true);
    expect(expect.any(String) && health.checkedAt).toBeTruthy();

    // Whatever it says, every alert must be actionable: a code, a level, a sentence.
    for (const alert of health.alerts) {
      expect(alert.code).toBeTruthy();
      expect(['INFO', 'WARNING', 'CRITICAL']).toContain(alert.level);
      expect(alert.message.length).toBeGreaterThan(10);
    }
  });
});
