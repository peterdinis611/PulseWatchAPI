import { CacheKeys } from '../cache.keys';
import { CacheService } from '../cache.service';
import { createTestCacheService } from './create-test-cache';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = createTestCacheService();
  });

  it('returns a cloned value until it expires', () => {
    const user = { id: 'user-1', name: 'Ada' };
    cache.set('user', user, 60_000);

    const first = cache.get<typeof user>('user');
    expect(first).toEqual(user);
    first!.name = 'mutated';
    expect(cache.get<typeof user>('user')).toEqual(user);
  });

  it('misses after ttl', () => {
    jest.useFakeTimers();
    cache.set('k', 'v', 1000);
    jest.advanceTimersByTime(1001);
    expect(cache.get('k')).toBeUndefined();
    jest.useRealTimers();
  });

  it('wraps a factory and reuses the result', async () => {
    const factory = jest.fn().mockResolvedValue('payload');

    await expect(cache.wrap('k', factory, 60_000)).resolves.toBe('payload');
    await expect(cache.wrap('k', factory, 60_000)).resolves.toBe('payload');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent wraps for the same key', async () => {
    let resolveFactory: (value: string) => void = () => undefined;
    const factory = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFactory = resolve;
        }),
    );

    const first = cache.wrap('k', factory, 60_000);
    const second = cache.wrap('k', factory, 60_000);
    resolveFactory('once');

    await expect(Promise.all([first, second])).resolves.toEqual([
      'once',
      'once',
    ]);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('skips the cache when ttl is 0', async () => {
    const factory = jest.fn().mockResolvedValue('payload');

    await expect(cache.wrap('k', factory, 0)).resolves.toBe('payload');
    await expect(cache.wrap('k', factory, 0)).resolves.toBe('payload');
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('does not cache a rejected factory', async () => {
    const factory = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue('ok');

    await expect(cache.wrap('k', factory, 60_000)).rejects.toThrow('boom');
    await expect(cache.wrap('k', factory, 60_000)).resolves.toBe('ok');
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('invalidates by prefix', () => {
    cache.set(CacheKeys.monitorsList('user-1'), ['a'], 60_000);
    cache.set(CacheKeys.monitorItem('user-1', 'm-1'), { id: 'm-1' }, 60_000);
    cache.set(CacheKeys.monitorsList('user-2'), ['b'], 60_000);

    cache.invalidatePrefix(CacheKeys.monitorsPrefix('user-1'));

    expect(cache.get(CacheKeys.monitorsList('user-1'))).toBeUndefined();
    expect(cache.get(CacheKeys.monitorItem('user-1', 'm-1'))).toBeUndefined();
    expect(cache.get(CacheKeys.monitorsList('user-2'))).toEqual(['b']);
  });

  it('evicts oldest entries when over max size', () => {
    const small = new CacheService({
      get: (key: string) => (key === 'CACHE_MAX_ENTRIES' ? '2' : undefined),
    } as never);

    small.set('a', 1, 60_000);
    small.set('b', 2, 60_000);
    small.set('c', 3, 60_000);

    expect(small.get('a')).toBeUndefined();
    expect(small.get('b')).toBe(2);
    expect(small.get('c')).toBe(3);
  });
});
