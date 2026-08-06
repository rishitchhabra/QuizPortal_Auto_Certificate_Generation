// BullMQ queue producer (used by the API to enqueue certificate jobs).
// The worker process builds its own Worker instance against the same queue name.

import { Queue } from 'bullmq';
import { config } from './config.js';
import { redisConnection } from './redis.js';

let queue = null;

export function getQueue() {
  if (!queue) {
    queue = new Queue(config.certificateQueueName, {
      connection: redisConnection(),
      defaultJobOptions: {
        attempts: config.jobMaxAttempts,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000
      }
    });
    queue.on('error', (err) => {
      console.error('[queue] Redis error:', err.message);
    });
  }
  return queue;
}

export async function enqueueCertificateJob({ jobId, templateId, data }) {
  await getQueue().add('generate', { jobId, templateId, data }, { jobId });
  return jobId;
}

export async function closeQueue() {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
