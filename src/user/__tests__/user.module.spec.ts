import { MODULE_METADATA } from '@nestjs/common/constants';
import { UserModule } from '../user.module';
import { UserResolver } from '../user.resolver';
import { UserService } from '../user.service';

describe('UserModule', () => {
  it('provides UserService and UserResolver', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      UserModule,
    ) as unknown[];

    expect(providers).toEqual(
      expect.arrayContaining([UserService, UserResolver]),
    );
  });

  it('exports UserService', () => {
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      UserModule,
    ) as unknown[];

    expect(exports).toEqual(expect.arrayContaining([UserService]));
  });
});
