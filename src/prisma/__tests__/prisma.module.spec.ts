import {
  GLOBAL_MODULE_METADATA,
  MODULE_METADATA,
} from '@nestjs/common/constants';
import { PrismaModule } from '../prisma.module';
import { PrismaService } from '../prisma.service';

describe('PrismaModule', () => {
  it('is global', () => {
    expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, PrismaModule)).toBe(
      true,
    );
  });

  it('provides and exports PrismaService', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      PrismaModule,
    ) as unknown[];
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      PrismaModule,
    ) as unknown[];

    expect(providers).toEqual(expect.arrayContaining([PrismaService]));
    expect(exports).toEqual(expect.arrayContaining([PrismaService]));
  });
});
