import {
  GLOBAL_MODULE_METADATA,
  MODULE_METADATA,
} from '@nestjs/common/constants';
import { PubSubModule } from '../pubsub.module';
import { PubSubService } from '../pubsub.service';

describe('PubSubModule', () => {
  it('is global', () => {
    expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, PubSubModule)).toBe(
      true,
    );
  });

  it('provides and exports PubSubService', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      PubSubModule,
    ) as unknown[];
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      PubSubModule,
    ) as unknown[];

    expect(providers).toEqual(expect.arrayContaining([PubSubService]));
    expect(exports).toEqual(expect.arrayContaining([PubSubService]));
  });
});
