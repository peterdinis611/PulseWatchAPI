import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_CACHE_MAX_ENTRIES,
  DEFAULT_CACHE_TTL_MS,
  USER_CACHE_TTL_MS,
} from './cache.constants';

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value == null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.trunc(parsed);
}

@Injectable()
export class CacheService {
  private readonly store = new Map<string, CacheEntry>();
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;
  readonly userTtlMs: number;

  constructor(config: ConfigService) {
    this.defaultTtlMs = parsePositiveInt(
      config.get<string>('CACHE_TTL_MS'),
      DEFAULT_CACHE_TTL_MS,
    );
    this.userTtlMs = parsePositiveInt(
      config.get<string>('CACHE_USER_TTL_MS'),
      USER_CACHE_TTL_MS,
    );
    this.maxEntries = parsePositiveInt(
      config.get<string>('CACHE_MAX_ENTRIES'),
      DEFAULT_CACHE_MAX_ENTRIES,
    );
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return structuredClone(entry.value) as T;
  }

  set<T>(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    if (ttlMs <= 0) {
      return;
    }
    this.evictExpired();
    this.store.set(key, {
      value: structuredClone(value),
      expiresAt: Date.now() + ttlMs,
    });
    this.evictOverflow();
  }

  del(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  async wrap<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs = this.defaultTtlMs,
  ): Promise<T> {
    if (ttlMs <= 0) {
      return factory();
    }

    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const inFlight = this.pending.get(key);
    if (inFlight) {
      return structuredClone(await inFlight) as T;
    }

    const pending = factory()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        this.pending.delete(key);
      });

    this.pending.set(key, pending);
    return structuredClone(await pending);
  }

  size(): number {
    this.evictExpired();
    return this.store.size;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  private evictOverflow(): void {
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.store.delete(oldest);
    }
  }
}
