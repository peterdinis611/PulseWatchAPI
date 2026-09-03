import {
  GLOBAL_MODULE_METADATA,
  MODULE_METADATA,
} from '@nestjs/common/constants';
import { JobsModule } from '../jobs.module';
import { JobsService } from '../jobs.service';

describe('JobsModule', () => {
  it('is global', () => {
    expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, JobsModule)).toBe(true);
  });

  it('provides and exports JobsService', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      JobsModule,
    ) as unknown[];
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      JobsModule,
    ) as unknown[];

    expect(providers).toEqual(expect.arrayContaining([JobsService]));
    expect(exports).toEqual(expect.arrayContaining([JobsService]));
  });
});
