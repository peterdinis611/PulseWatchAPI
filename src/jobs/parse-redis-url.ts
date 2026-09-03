export type RedisConnectionOptions = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
};

export function redisConnectionFromUrl(
  urlString: string,
): RedisConnectionOptions {
  const url = new URL(urlString);
  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use redis:// or rediss://');
  }

  const dbPath = url.pathname.replace(/^\//, '');
  const db = dbPath === '' ? undefined : Number(dbPath);
  const username = url.username ? decodeURIComponent(url.username) : undefined;
  const password = url.password ? decodeURIComponent(url.password) : undefined;

  return {
    host: url.hostname || '127.0.0.1',
    port: url.port ? Number(url.port) : 6379,
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
    ...(db !== undefined && Number.isFinite(db) ? { db } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
