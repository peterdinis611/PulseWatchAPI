import {
  GLOBAL_MODULE_METADATA,
  MODULE_METADATA,
} from '@nestjs/common/constants';
import { LoggerModule } from '../logger.module';
import { LoggerService } from '../logger.service';

describe('LoggerModule', () => {
  it('is global', () => {
    expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, LoggerModule)).toBe(
      true,
    );
  });

  it('provides and exports LoggerService', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      LoggerModule,
    ) as unknown[];
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      LoggerModule,
    ) as unknown[];

    expect(providers).toEqual(expect.arrayContaining([LoggerService]));
    expect(exports).toEqual(expect.arrayContaining([LoggerService]));
  });
});
