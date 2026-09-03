import { MODULE_METADATA } from '@nestjs/common/constants';
import { NotificationModule } from '../notification.module';
import { NotificationResolver } from '../notification.resolver';
import { NotificationService } from '../notification.service';

describe('NotificationModule', () => {
  it('provides NotificationService and NotificationResolver', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      NotificationModule,
    ) as unknown[];

    expect(providers).toEqual(
      expect.arrayContaining([NotificationService, NotificationResolver]),
    );
  });

  it('exports NotificationService', () => {
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      NotificationModule,
    ) as unknown[];

    expect(exports).toEqual(expect.arrayContaining([NotificationService]));
  });
});
