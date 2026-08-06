// Shared Redis connection options for BullMQ (producer in the API, consumer in
// the worker). Kept in one place so both processes always resolve the same
// connection. Supports redis:// URLs with credentials + db, optional TLS for
// managed providers, and optional AUTH via REDIS_PASSWORD.

import { config } from './config.js';

export function redisConnection() {
  const url = new URL(config.redisUrl);
  const opts = {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: config.redisPassword || (url.password ? decodeURIComponent(url.password) : undefined),
    db: url.pathname && url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    tls: config.redisTls
      ? { ca: config.redisTlsCa ? Buffer.from(config.redisTlsCa, 'base64') : undefined }
      : undefined
  };
  if (!opts.username) delete opts.username;
  if (!opts.password) delete opts.password;
  return opts;
}
