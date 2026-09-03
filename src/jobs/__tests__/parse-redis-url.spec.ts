import { redisConnectionFromUrl } from '../parse-redis-url';

describe('redisConnectionFromUrl', () => {
  it('parses host and default port', () => {
    expect(redisConnectionFromUrl('redis://127.0.0.1')).toEqual({
      host: '127.0.0.1',
      port: 6379,
    });
  });

  it('parses password, db and tls', () => {
    expect(
      redisConnectionFromUrl('rediss://user:s%40cret@redis.internal:6380/2'),
    ).toEqual({
      host: 'redis.internal',
      port: 6380,
      username: 'user',
      password: 's@cret',
      db: 2,
      tls: {},
    });
  });

  it('rejects non-redis URLs', () => {
    expect(() => redisConnectionFromUrl('http://localhost:6379')).toThrow(
      'REDIS_URL must use redis:// or rediss://',
    );
  });
});
