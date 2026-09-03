import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache.service';

export function createTestCacheService(): CacheService {
  return new CacheService({
    get: () => undefined,
  } as unknown as ConfigService);
}
