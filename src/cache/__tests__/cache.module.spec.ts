import {
  GLOBAL_MODULE_METADATA,
  MODULE_METADATA,
} from '@nestjs/common/constants';
import { CacheModule } from '../cache.module';
import { CacheService } from '../cache.service';

describe('CacheModule', () => {
  it('is global', () => {
    expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, CacheModule)).toBe(true);
  });

  it('provides and exports CacheService', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      CacheModule,
    ) as unknown[];
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      CacheModule,
    ) as unknown[];

    expect(providers).toEqual(expect.arrayContaining([CacheService]));
    expect(exports).toEqual(expect.arrayContaining([CacheService]));
  });
});
