import { MODULE_METADATA } from '@nestjs/common/constants';
import { HealthModule } from '../health.module';
import { HealthResolver } from '../health.resolver';
import { HealthService } from '../health.service';

describe('HealthModule', () => {
  it('provides HealthResolver and HealthService', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      HealthModule,
    ) as unknown[];

    expect(providers).toEqual(
      expect.arrayContaining([HealthResolver, HealthService]),
    );
  });

  it('exports HealthService', () => {
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      HealthModule,
    ) as unknown[];

    expect(exports).toEqual(expect.arrayContaining([HealthService]));
  });
});
